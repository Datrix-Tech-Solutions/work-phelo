import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PermissionRecipient, RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { normalizeEmployeeEmail } from './employee-email';
import { accessFingerprint } from '@work-phelo/internal-auth';
import {
  accessKey,
  assertAccessActor,
  EmployeeAccessService,
} from './employee-access.service';
import { EmployeeImportRowDto } from './dto/bulk-import-employees.dto';
import { BulkImportRowResult } from '../common/bulk-import.types';
import {
  matchByExactName,
  matchEmployeeByFullName,
} from '../common/name-match.util';
import { LeaveService } from '../leave/leave.service';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import {
  InitiateOffboardDto,
  UpdateChecklistDto,
  OffboardReason,
} from './dto/offboard-employee.dto';
import {
  DismissResignationDto,
  SubmitResignationDto,
} from './dto/resignation.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import {
  CreateEmployeeDeductionDto,
  UpdateEmployeeDeductionDto,
} from './dto/employee-deduction.dto';
import {
  CreateEmployeeAllowanceDto,
  UpdateEmployeeAllowanceDto,
} from './dto/employee-allowance.dto';
import { getPaginationParams, buildMeta } from '@work-phelo/utils';
import {
  AllowanceType,
  AssetStatus,
  EmploymentStatus,
  EmployeeDocument,
  PayrollTaxPolicy,
  Prisma,
} from '../../prisma/generated/client';
import {
  assertHrAccess,
  getActorEmployee,
  hasPermissionRule,
  isCompanyAdminUser,
  isEmployeeSelfServiceUser,
} from '../auth/access-scope';
import { NotificationsService } from '../notifications/notifications.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { AvatarUrlResolverService } from '../common/avatar-url-resolver.service';
import { EmployeeDocumentStorageService } from '../common/employee-document-storage.service';
import { CreateEmployeeDocumentDto } from './dto/create-employee-document.dto';
import {
  RESIGNATION_QUEUE,
  RESIGNATION_NOTIFY_JOB,
  ResignationNotifyPayload,
} from './resignation-notification.processor';

const RESIGNATION_NOTIFY_DELAY_MS = 30 * 60 * 1000;
const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;

type ResignationNotificationRecipient = {
  userId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  source: 'MANAGER' | 'APPROVER';
};

type ResignationNotificationRecipients = {
  manager: ResignationNotificationRecipient | null;
  approvers: ResignationNotificationRecipient[];
  all: ResignationNotificationRecipient[];
};

type HrPrismaTx = Prisma.TransactionClient;

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly leaveService: LeaveService,
    private readonly notificationsService: NotificationsService,
    private readonly encryption: FieldEncryptionService,
    private readonly avatarUrlResolver: AvatarUrlResolverService,
    private readonly documentStorage: EmployeeDocumentStorageService,
    @InjectQueue(RESIGNATION_QUEUE)
    private readonly resignationQueue: Queue<ResignationNotifyPayload>,
    @Optional() private readonly access?: EmployeeAccessService,
  ) {}

  private mapEmployeeAssets<T extends { assignedAssets?: unknown[] }>(
    employee: T,
  ) {
    const { assignedAssets, ...rest } = employee;

    return {
      ...rest,
      assets: assignedAssets ?? [],
    };
  }

  private async getUserStatusMap(tenantId: string, userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, string>();
    }

    const uniqueUserIds = Array.from(new Set(userIds));
    const statuses = await this.rabbitmq.authGetUserStatuses({
      tenantId,
      userIds: uniqueUserIds,
    });

    return new Map(statuses.map((status) => [status.userId, status.status]));
  }

  private withUserStatus<T extends { userId?: string | null }>(
    employee: T,
    statusMap: Map<string, string>,
  ) {
    const userStatus = employee.userId
      ? (statusMap.get(employee.userId) ?? null)
      : null;

    return { ...employee, userStatus };
  }

  private isDuplicateEmployeeNumberError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybePrismaError = error as {
      code?: unknown;
      meta?: { target?: unknown };
    };

    if (maybePrismaError.code !== 'P2002') {
      return false;
    }

    const target = maybePrismaError.meta?.target;
    return Array.isArray(target) && target.includes('employeeNumber');
  }

  private async generateEmployeeNumber(tenantId: string) {
    const count = await this.prisma.employee.count({ where: { tenantId } });
    return `EMP-${String(count + 1).padStart(4, '0')}`;
  }

  private async assertValidManagerAssignment(
    tenantId: string,
    managerId: string,
    employeeId?: string,
  ) {
    const manager = await this.prisma.employee.findFirst({
      where: { id: managerId, tenantId },
      select: { id: true, managerId: true },
    });

    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    if (!employeeId) {
      return;
    }

    if (managerId === employeeId) {
      throw new BadRequestException(
        'An employee cannot be assigned as their own manager.',
      );
    }

    const visited = new Set<string>([employeeId]);
    let current: { id: string; managerId: string | null } | null = manager;

    while (current) {
      if (visited.has(current.id)) {
        throw new BadRequestException(
          'This manager assignment would create a reporting cycle.',
        );
      }

      visited.add(current.id);

      if (!current.managerId) {
        break;
      }

      current = await this.prisma.employee.findFirst({
        where: { id: current.managerId, tenantId },
        select: { id: true, managerId: true },
      });
    }
  }

  private async createEmployeeWithUniqueNumber(
    tenantId: string,
    dto: CreateEmployeeDto,
    request?: {
      actor: RequestUser;
      idempotencyKey: string;
      requestHash: string;
    },
  ) {
    let attempt = 0;

    while (attempt < 5) {
      const employeeNumber = await this.generateEmployeeNumber(tenantId);

      try {
        return await this.prisma.$transaction(async (tx) => {
          if (request) {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`employee-create:${tenantId}:${request.idempotencyKey}`}, 0))::text`;
            const prior = await tx.employeeCreateRequest.findUnique({
              where: {
                tenantId_idempotencyKey: {
                  tenantId,
                  idempotencyKey: request.idempotencyKey,
                },
              },
            });
            if (prior) {
              if (
                prior.requestHash !== request.requestHash ||
                prior.actorUserId !== request.actor.id
              )
                throw new ConflictException(
                  'Idempotency key was used for a different request.',
                );
              return tx.employee.findFirstOrThrow({
                where: { id: prior.employeeId, tenantId },
                include: { department: true, branch: true },
              });
            }
          }
          const employee = await tx.employee.create({
            data: {
              tenantId,
              employeeNumber,
              userId: null,
              firstName: dto.firstName,
              lastName: dto.lastName,
              email: dto.email ?? null,
              normalizedEmail: dto.email ?? null,
              emailHash: dto.email ? this.encryption.hmac(dto.email) : null,
              phone: this.encryption.encrypt(dto.phone),
              gender: dto.gender,
              dateOfBirth: dto.dateOfBirth
                ? new Date(dto.dateOfBirth)
                : undefined,
              maritalStatus: dto.maritalStatus,
              nationality: dto.nationality,
              address: this.encryption.encrypt(dto.address),
              city: dto.city,
              region: dto.region,
              emergencyName: this.encryption.encrypt(dto.emergencyName),
              emergencyPhone: this.encryption.encrypt(dto.emergencyPhone),
              emergencyRelation: dto.emergencyRelation,
              jobTitle: dto.jobTitle,
              employmentType: dto.employmentType,
              hireDate: new Date(dto.hireDate),
              probationEndsAt: dto.probationEndsAt
                ? new Date(dto.probationEndsAt)
                : undefined,
              contractEndDate: dto.contractEndDate
                ? new Date(dto.contractEndDate)
                : undefined,
              basicSalary: dto.basicSalary ?? 0,
              nationalId: this.encryption.encrypt(dto.nationalId),
              bankName: this.encryption.encrypt(dto.bankName),
              bankAccountNumber: this.encryption.encrypt(dto.bankAccountNumber),
              bankBranch: this.encryption.encrypt(dto.bankBranch),
              ssnit: this.encryption.encrypt(dto.ssnit),
              tinNumber: this.encryption.encrypt(dto.tinNumber),
              compensationType: dto.compensationType,
              ...(dto.departmentId && { departmentId: dto.departmentId }),
              ...(dto.branchId && { branchId: dto.branchId }),
              ...(dto.managerId && { managerId: dto.managerId }),
            },
            include: { department: true, branch: true },
          });
          await this.leaveService.initializeLeaveBalances(
            tenantId,
            employee.id,
            undefined,
            tx,
          );
          if (dto.recruitmentCandidateId) {
            // The conditions are part of the write, so two requests cannot onboard one candidate.
            const { count } = await tx.recruitmentApplication.updateMany({
              where: {
                tenantId,
                id: dto.recruitmentCandidateId,
                status: 'SUBMITTED',
                onboardedAt: null,
                currentStage: { is: { normalizedName: 'hired' } },
              },
              data: {
                onboardedAt: new Date(),
                onboardedEmployeeId: employee.id,
              },
            });
            if (count !== 1) {
              throw new ConflictException(
                'Only a hired candidate who has not been onboarded can be onboarded.',
              );
            }
          }
          if (request) {
            if (dto.grantSystemAccess) {
              await this.access!.enqueue(
                tx,
                employee,
                request.actor,
                `create:${request.idempotencyKey}`,
                'CREATE',
                dto.email!,
              );
            }
            await tx.employeeCreateRequest.create({
              data: {
                tenantId,
                actorUserId: request.actor.id,
                idempotencyKey: request.idempotencyKey,
                requestHash: request.requestHash,
                employeeId: employee.id,
              },
            });
          }
          return employee;
        });
      } catch (error) {
        if (this.isDuplicateEmployeeNumberError(error)) {
          attempt += 1;
          continue;
        }

        const duplicate = error as {
          code?: string;
          meta?: { target?: unknown };
        };
        const target = JSON.stringify(duplicate?.meta?.target ?? '');
        if (duplicate?.code === 'P2002' && /email/i.test(target)) {
          throw new ConflictException(
            'Employee with this email already exists',
          );
        }

        throw error;
      }
    }

    throw new ConflictException(
      'Could not allocate a unique employee number. Please retry.',
    );
  }

  private validateEmploymentDates(input: {
    hireDate: Date;
    probationEndsAt?: Date;
    contractEndDate?: Date;
  }) {
    if (input.probationEndsAt && input.probationEndsAt < input.hireDate) {
      throw new BadRequestException(
        'Probation end date cannot be before the hire date.',
      );
    }

    if (input.contractEndDate && input.contractEndDate < input.hireDate) {
      throw new BadRequestException(
        'Contract end date cannot be before the hire date.',
      );
    }
  }

  private validatePayrollTaxPolicy(input: {
    taxPolicy?: PayrollTaxPolicy;
    fixedTaxAmount?: number | { toString(): string } | null;
  }) {
    if (
      input.taxPolicy === PayrollTaxPolicy.FIXED_AMOUNT &&
      input.fixedTaxAmount == null
    ) {
      throw new BadRequestException(
        'fixedTaxAmount is required when taxPolicy is FIXED_AMOUNT.',
      );
    }
  }

  private addMonths(date: Date, months: number) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    value.setMonth(value.getMonth() + months);
    return value;
  }

  private async resolveProbationEndDate(
    tenantId: string,
    hireDate: string,
    probationEndsAt?: string,
  ) {
    if (probationEndsAt) {
      return new Date(probationEndsAt);
    }

    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { defaultProbationPeriodMonths: true },
    });

    if (!config?.defaultProbationPeriodMonths) {
      return undefined;
    }

    return this.addMonths(
      new Date(hireDate),
      config.defaultProbationPeriodMonths,
    );
  }

  private assertMinimumEmployeeAge(dateOfBirth: string) {
    const dob = new Date(dateOfBirth);

    if (Number.isNaN(dob.getTime())) {
      throw new BadRequestException('Invalid date of birth.');
    }

    const today = new Date();
    let age = today.getUTCFullYear() - dob.getUTCFullYear();
    const monthDelta = today.getUTCMonth() - dob.getUTCMonth();

    if (
      monthDelta < 0 ||
      (monthDelta === 0 && today.getUTCDate() < dob.getUTCDate())
    ) {
      age -= 1;
    }

    if (age < 18) {
      throw new BadRequestException('Employees must be at least 18 years old.');
    }
  }

  private async upsertOffboardingRecord(
    tx: HrPrismaTx,
    tenantId: string,
    employeeId: string,
    dto: {
      reason: OffboardReason;
      otherReason?: string;
      lastWorkingDate: string;
      exitNotes?: string;
    },
    employee: { hireDate: Date },
  ) {
    if (dto.reason === OffboardReason.OTHER && !dto.otherReason?.trim()) {
      throw new BadRequestException(
        'A specific reason is required when "Other" is selected',
      );
    }

    const lastWorkingDate = new Date(dto.lastWorkingDate);
    if (lastWorkingDate < employee.hireDate) {
      throw new BadRequestException(
        'Last working date cannot be before the employee hire date',
      );
    }

    return tx.offboardingRecord.upsert({
      where: { employeeId },
      create: {
        tenantId,
        employeeId,
        reason: dto.reason,
        otherReason: dto.otherReason,
        lastWorkingDate,
        exitNotes: dto.exitNotes,
        isDraft: true,
      },
      update: {
        reason: dto.reason,
        otherReason: dto.otherReason,
        lastWorkingDate,
        exitNotes: dto.exitNotes,
        isDraft: true,
      },
    });
  }

  async create(
    tenantId: string,
    dto: CreateEmployeeDto,
    options?: { actor: RequestUser; idempotencyKey: string },
  ) {
    if ('userId' in dto || 'tenantId' in dto) {
      throw new BadRequestException(
        'Employee identity linkage is server-managed.',
      );
    }
    if (
      dto.grantSystemAccess !== undefined &&
      typeof dto.grantSystemAccess !== 'boolean'
    ) {
      throw new BadRequestException('grantSystemAccess must be a boolean.');
    }
    dto = { ...dto, email: normalizeEmployeeEmail(dto.email) };
    if (dto.grantSystemAccess) {
      assertAccessActor(options?.actor, tenantId, 'CREATE', 'CREATE');
      if (!dto.email)
        throw new BadRequestException('A valid login email is required.');
      if (!this.access)
        throw new ServiceUnavailableException(
          'Employee access provisioning is unavailable.',
        );
    }
    const request = options
      ? {
          ...options,
          idempotencyKey: accessKey(options.idempotencyKey),
          requestHash: accessFingerprint({
            ...dto,
            grantSystemAccess: dto.grantSystemAccess ?? false,
          }),
        }
      : undefined;
    if (request) {
      if (request.actor.tenantId !== tenantId)
        throw new BadRequestException('Invalid employee tenant scope.');
      const prior = await this.prisma.employeeCreateRequest.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey: request.idempotencyKey,
          },
        },
      });
      if (prior) {
        if (
          prior.requestHash !== request.requestHash ||
          prior.actorUserId !== request.actor.id
        )
          throw new ConflictException(
            'Idempotency key was used for a different request.',
          );
        const employee = await this.prisma.employee.findFirstOrThrow({
          where: { id: prior.employeeId, tenantId },
          include: { department: true, branch: true },
        });
        return this.creationResponse(employee, request);
      }
    }
    // Enforce minimum one department before adding employees
    const deptCount = await this.prisma.department.count({
      where: { tenantId, isActive: true },
    });
    if (deptCount === 0) {
      throw new BadRequestException(
        'Please set up at least one department before adding employees.',
      );
    }

    const existing =
      dto.email && !request
        ? await this.prisma.employee.findFirst({
            where: {
              tenantId,
              OR: [
                { normalizedEmail: dto.email },
                { email: { equals: dto.email, mode: 'insensitive' } },
              ],
            },
          })
        : null;
    if (existing)
      throw new ConflictException('Employee with this email already exists');

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, tenantId },
      });
      if (!dept) throw new NotFoundException('Department not found');
    }

    if (dto.managerId) {
      await this.assertValidManagerAssignment(tenantId, dto.managerId);
    }

    const resolvedProbationEndsAt = await this.resolveProbationEndDate(
      tenantId,
      dto.hireDate,
      dto.probationEndsAt,
    );

    if (dto.dateOfBirth) {
      this.assertMinimumEmployeeAge(dto.dateOfBirth);
    }

    this.validateEmploymentDates({
      hireDate: new Date(dto.hireDate),
      probationEndsAt: resolvedProbationEndsAt,
      contractEndDate: dto.contractEndDate
        ? new Date(dto.contractEndDate)
        : undefined,
    });

    const employee = await this.createEmployeeWithUniqueNumber(
      tenantId,
      {
        ...dto,
        probationEndsAt: resolvedProbationEndsAt?.toISOString(),
      },
      request,
    );
    try {
      await this.leaveService.ensurePublicHolidaysSeededForEmployee(
        tenantId,
        employee.id,
        [employee.hireDate.getFullYear(), employee.hireDate.getFullYear() + 1],
      );
    } catch {
      // Calendar seeding is recoverable and must not undo committed HR records.
      this.logger.warn(
        `Holiday seeding needs retry for employee ${employee.id}`,
      );
    }

    return this.creationResponse(employee, request);
  }

  private async creationResponse<T extends { id: string; tenantId: string }>(
    employee: T,
    request?: { idempotencyKey: string },
  ) {
    const operation = request
      ? await this.prisma.employeeAccessOperation.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: employee.tenantId,
              idempotencyKey: `create:${request.idempotencyKey}`,
            },
          },
        })
      : null;
    return {
      ...this.encryption.decryptEmployeeFields(employee),
      systemAccessOperation:
        operation && this.access
          ? this.access.publicOperation(operation)
          : null,
    };
  }

  /** Creates employees from bulk-import rows sequentially, one row at a time, via the same
   *  create() used by the single-employee form — so leave balance init and
   *  holiday seeding all happen exactly as they would for a manually created employee.
   *  Department is a required lookup: an unresolved name fails the row. Branch and Reporting
   *  Manager are optional lookups: unresolved/ambiguous values are dropped with a warning and
   *  the row still proceeds. Newly created employees are added to the manager-lookup pool so a
   *  later row in the same file can report to someone created earlier in it. */
  async bulkImport(
    tenantId: string,
    rows: EmployeeImportRowDto[],
  ): Promise<BulkImportRowResult[]> {
    const departments = await this.prisma.department.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
    });
    const branches = await this.prisma.branch.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
    });
    const employeeCandidates = await this.prisma.employee.findMany({
      where: { tenantId },
      select: { id: true, firstName: true, lastName: true },
    });

    const results: BulkImportRowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = row.rowNumber ?? i + 1;
      const warnings: string[] = [];

      const department = matchByExactName(row.departmentName, departments);
      if (!department) {
        results.push({
          rowNumber,
          status: 'failed',
          message: `Department "${row.departmentName}" not found`,
          warnings,
        });
        continue;
      }

      let branchId: string | undefined;
      if (row.branchName?.trim()) {
        const branch = matchByExactName(row.branchName, branches);
        if (branch) {
          branchId = branch.id;
        } else {
          warnings.push(`Branch "${row.branchName}" not found — left blank.`);
        }
      }

      let managerId: string | undefined;
      if (row.managerName?.trim()) {
        const match = matchEmployeeByFullName(
          row.managerName,
          employeeCandidates,
        );
        if (match.status === 'found') {
          managerId = match.id;
        } else {
          warnings.push(
            match.status === 'ambiguous'
              ? `Reporting Manager "${row.managerName}" matches multiple employees — left blank.`
              : `Reporting Manager "${row.managerName}" not found — left blank.`,
          );
        }
      }

      try {
        const employee = await this.create(tenantId, {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          gender: row.gender,
          departmentId: department.id,
          branchId,
          jobTitle: row.jobTitle,
          managerId,
          hireDate: row.hireDate,
          employmentType: row.employmentType,
          contractEndDate: row.contractEndDate,
          compensationType: row.compensationType,
          basicSalary: row.basicSalary,
        });
        employeeCandidates.push({
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
        });
        results.push({
          rowNumber,
          status: 'created',
          id: employee.id,
          warnings,
        });
      } catch (err) {
        results.push({
          rowNumber,
          status: 'failed',
          message:
            err instanceof Error ? err.message : 'Failed to create employee',
          warnings,
        });
      }
    }

    return results;
  }

  async findAll(
    tenantId: string,
    query: QueryEmployeesDto,
    actor?: RequestUser,
  ) {
    const { take, skip, page } = getPaginationParams(query);

    const where: Prisma.EmployeeWhereInput = { tenantId };

    if (actor && !isCompanyAdminUser(actor)) {
      const canReadEmployees = hasPermissionRule(actor, 'employees:VIEW');

      if (isEmployeeSelfServiceUser(actor)) {
        // Self-service employees can view the lightweight company directory,
        // but detailed profile access is still enforced in findById().
      } else {
        assertHrAccess(canReadEmployees);
      }
    }

    if (query.status) where.employmentStatus = query.status;
    if (query.type) where.employmentType = query.type;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { employeeNumber: { contains: query.search, mode: 'insensitive' } },
        { jobTitle: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const queryPage = async (db: Prisma.TransactionClient) => {
      let accessTotal: number | undefined;
      let accessStates: Map<string, string> | undefined;
      let accessSnapshotAt: string | null = null;
      if (query.accessStatus) {
        assertAccessActor(actor, tenantId, 'VIEW', 'VIEW');
        if (query.accessStatus !== 'NONE') {
          if (!this.access)
            throw new ServiceUnavailableException(
              'Access filtering unavailable.',
            );
          const filtered = await this.access.filterPage(
            db,
            tenantId,
            where,
            actor!,
            query.accessStatus,
            take,
            skip,
          );
          where.id = { in: filtered.ids };
          accessTotal = filtered.total;
          accessStates = filtered.states;
          accessSnapshotAt = filtered.capturedAt;
        } else {
          const search = query.search ? `%${query.search}%` : null;
          const [matched] = await db.$queryRaw<
            { total: bigint; ids: string[] }[]
          >`
        WITH matches AS NOT MATERIALIZED (
          SELECT e."id", e."createdAt" FROM "hr"."Employee" e
          WHERE e."tenantId" = ${tenantId} AND e."userId" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "hr"."EmployeeAccessOperation" o WHERE o."tenantId" = e."tenantId" AND o."employeeId" = e."id")
          AND (${query.status ?? null}::text IS NULL OR e."employmentStatus"::text = ${query.status ?? null})
          AND (${query.type ?? null}::text IS NULL OR e."employmentType"::text = ${query.type ?? null})
          AND (${query.departmentId ?? null}::text IS NULL OR e."departmentId" = ${query.departmentId ?? null})
          AND (${search}::text IS NULL OR e."firstName" ILIKE ${search} OR e."lastName" ILIKE ${search}
            OR e."email" ILIKE ${search} OR e."employeeNumber" ILIKE ${search} OR e."jobTitle" ILIKE ${search})
        ) SELECT (SELECT count(*) FROM matches) AS total,
          ARRAY(SELECT "id" FROM matches ORDER BY "createdAt" DESC, "id" DESC LIMIT ${take} OFFSET ${skip}) AS ids`;
          where.id = { in: matched.ids };
          accessTotal = Number(matched.total);
        }
      }

      const [employees, total] = await Promise.all([
        db.employee.findMany({
          where,
          take,
          skip: query.accessStatus ? 0 : skip,
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            jobTitle: true,
            employmentStatus: true,
            employmentType: true,
            hireDate: true,
            avatarUrl: true,
            userId: true,
            basicSalary: true,
            compensationType: true,
            taxPolicy: true,
            fixedTaxAmount: true,
            commissionTaxable: true,
            payrollGroupId: true,
            ssnit: true,
            allowances: {
              select: {
                id: true,
                employeeId: true,
                type: true,
                name: true,
                amount: true,
                effectiveFrom: true,
                createdAt: true,
              },
            },
            deductions: {
              select: {
                id: true,
                employeeId: true,
                name: true,
                totalAmount: true,
                monthlyRate: true,
                amountPaid: true,
                startDate: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            department: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        accessTotal === undefined
          ? db.employee.count({ where })
          : Promise.resolve(accessTotal),
      ]);

      const userIds = employees
        .map((employee) => employee.userId)
        .filter((id): id is string => Boolean(id));
      const [statusMap, avatarUrls] = await Promise.all([
        query.accessStatus
          ? Promise.resolve(new Map<string, string>())
          : this.getUserStatusMap(tenantId, userIds),
        this.avatarUrlResolver.resolveMany(
          employees.map((employee) => employee.avatarUrl),
        ),
      ]);
      const employeesWithStatus = employees.map((employee, index) => ({
        ...this.withUserStatus(
          this.encryption.maskListFields({
            ...employee,
            avatarUrl: avatarUrls[index],
          }),
          statusMap,
        ),
        ...(query.accessStatus
          ? {
              accessStatus: accessStates?.get(employee.id) ?? 'NONE',
              userStatus: employee.userId
                ? ((
                    {
                      ACTIVE: 'ACTIVE',
                      SUSPENDED: 'SUSPENDED',
                      INACTIVE: 'INACTIVE',
                      INVITED: 'PENDING_VERIFICATION',
                      INVITE_EXPIRED: 'PENDING_VERIFICATION',
                      PROVISIONING: 'PENDING_VERIFICATION',
                    } as Record<string, string>
                  )[accessStates?.get(employee.id) ?? ''] ?? null)
                : null,
            }
          : {}),
      }));

      return {
        employees: employeesWithStatus,
        meta: buildMeta(page, take, total),
        ...(query.accessStatus ? { accessSnapshotAt } : {}),
      };
    };
    return query.accessStatus
      ? this.prisma.$transaction(queryPage, {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          timeout: 20000,
        })
      : queryPage(this.prisma);
  }

  async findOptions(tenantId: string) {
    return this.prisma.employee.findMany({
      where: {
        tenantId,
        employmentStatus: { not: EmploymentStatus.OFFBOARDED },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        jobTitle: true,
        employmentStatus: true,
        department: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async findById(tenantId: string, id: string, actor?: RequestUser) {
    const [employee, assignedAssets] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { id, tenantId },
        include: {
          department: true,
          branch: true,
          allowances: true,
          deductions: true,
          documents: true,
          leaveBalances: { include: { leaveType: true } },
          offboarding: true,
          resignation: true,
        },
      }),
      this.prisma.asset.findMany({
        where: {
          assignedEmployeeId: id,
          tenantId,
          isActive: true,
          status: AssetStatus.ASSIGNED,
        },
        orderBy: { assignedAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          serialNumber: true,
          condition: true,
          assignedAt: true,
        },
      }),
    ]);
    if (!employee) throw new NotFoundException('Employee not found');
    const decrypted = this.encryption.decryptEmployeeFields(employee);
    const employeeWithAssets = { ...decrypted, assignedAssets };

    const [statusMap, resolvedAvatarUrl] = await Promise.all([
      this.getUserStatusMap(tenantId, employee.userId ? [employee.userId] : []),
      this.avatarUrlResolver.resolve(employeeWithAssets.avatarUrl),
    ]);
    employeeWithAssets.avatarUrl = resolvedAvatarUrl;

    if (!actor) {
      return this.withUserStatus(
        this.mapEmployeeAssets(employeeWithAssets),
        statusMap,
      );
    }

    if (isCompanyAdminUser(actor)) {
      return this.withUserStatus(
        this.mapEmployeeAssets(employeeWithAssets),
        statusMap,
      );
    }

    if (isEmployeeSelfServiceUser(actor)) {
      if (hasPermissionRule(actor, 'employees:VIEW')) {
        return this.withUserStatus(
          this.mapEmployeeAssets(employeeWithAssets),
          statusMap,
        );
      }

      const actorEmployee = await getActorEmployee(
        this.prisma,
        tenantId,
        actor.id,
      );
      assertHrAccess(employee.id === actorEmployee.id);
      return this.withUserStatus(
        this.mapEmployeeAssets(employeeWithAssets),
        statusMap,
      );
    }

    assertHrAccess(hasPermissionRule(actor, 'employees:VIEW'));
    return this.withUserStatus(
      this.mapEmployeeAssets(employeeWithAssets),
      statusMap,
    );
  }

  async findByUserId(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
      include: {
        department: true,
        branch: true,
        allowances: true,
        deductions: true,
        resignation: true,
      },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const [statusMap, assignedAssets] = await Promise.all([
      this.getUserStatusMap(tenantId, employee.userId ? [employee.userId] : []),
      this.prisma.asset.findMany({
        where: {
          assignedEmployeeId: employee.id,
          tenantId,
          isActive: true,
          status: AssetStatus.ASSIGNED,
        },
        orderBy: { assignedAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          serialNumber: true,
          condition: true,
          assignedAt: true,
        },
      }),
    ]);

    const decrypted = this.encryption.decryptEmployeeFields(employee);
    const employeeWithAssets = { ...decrypted, assignedAssets };
    employeeWithAssets.avatarUrl = await this.avatarUrlResolver.resolve(
      employeeWithAssets.avatarUrl,
    );
    return this.withUserStatus(
      this.mapEmployeeAssets(employeeWithAssets),
      statusMap,
    );
  }

  async updateMyProfile(
    tenantId: string,
    dto: UpdateEmployeeDto,
    actor: RequestUser,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId: actor.id, tenantId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');

    return this.update(tenantId, employee.id, dto, actor);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateEmployeeDto,
    actor: RequestUser,
  ) {
    const existing = await this.prisma.employee.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Employee not found');

    const fullUpdateAllowed =
      isCompanyAdminUser(actor) || hasPermissionRule(actor, 'employees:EDIT');

    let updateData: UpdateEmployeeDto = { ...dto };

    if (!fullUpdateAllowed) {
      assertHrAccess(isEmployeeSelfServiceUser(actor));
      const actorEmployee = await getActorEmployee(
        this.prisma,
        tenantId,
        actor.id,
      );
      assertHrAccess(actorEmployee.id === existing.id);

      const {
        firstName,
        lastName,
        phone,
        dateOfBirth,
        gender,
        maritalStatus,
        nationality,
        nationalId,
        address,
        city,
        region,
        emergencyName,
        emergencyPhone,
        emergencyRelation,
        bankName,
        bankAccountNumber,
        bankBranch,
        ssnit,
        tinNumber,
      } = dto;

      updateData = {
        firstName,
        lastName,
        phone,
        dateOfBirth,
        gender,
        maritalStatus,
        nationality,
        nationalId,
        address,
        city,
        region,
        emergencyName,
        emergencyPhone,
        emergencyRelation,
        bankName,
        bankAccountNumber,
        bankBranch,
        ssnit,
        tinNumber,
      };
    }

    const {
      employmentStatus,
      dateOfBirth,
      probationEndsAt,
      contractEndDate,
      hireDate,
      compensationType,
      taxPolicy,
      fixedTaxAmount,
      commissionTaxable,
      ...rest
    } = updateData;

    if (rest.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: rest.branchId, tenantId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    if (rest.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: rest.departmentId, tenantId },
      });
      if (!dept) throw new NotFoundException('Department not found');
    }

    if (rest.managerId) {
      await this.assertValidManagerAssignment(tenantId, rest.managerId, id);
    }

    if (dateOfBirth) {
      this.assertMinimumEmployeeAge(dateOfBirth);
    }

    const effectiveHireDate =
      hireDate !== undefined ? new Date(hireDate) : existing.hireDate;

    this.validateEmploymentDates({
      hireDate: effectiveHireDate,
      probationEndsAt: probationEndsAt
        ? new Date(probationEndsAt)
        : (existing.probationEndsAt ?? undefined),
      contractEndDate: contractEndDate
        ? new Date(contractEndDate)
        : (existing.contractEndDate ?? undefined),
    });
    const effectiveTaxPolicy = taxPolicy ?? existing.taxPolicy;
    const shouldUpdateFixedTaxAmount =
      taxPolicy !== undefined || fixedTaxAmount !== undefined;
    const normalizedFixedTaxAmount =
      effectiveTaxPolicy === PayrollTaxPolicy.FIXED_AMOUNT
        ? fixedTaxAmount !== undefined
          ? fixedTaxAmount
          : existing.fixedTaxAmount
        : null;

    this.validatePayrollTaxPolicy({
      taxPolicy: effectiveTaxPolicy,
      fixedTaxAmount: normalizedFixedTaxAmount,
    });

    // Track status change
    const statusChanged =
      employmentStatus && employmentStatus !== existing.employmentStatus;

    const encryptedRest = this.encryption.encryptEmployeeFields(rest);

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...encryptedRest,
        ...(compensationType !== undefined && { compensationType }),
        ...(taxPolicy !== undefined && { taxPolicy }),
        ...(shouldUpdateFixedTaxAmount && {
          fixedTaxAmount: normalizedFixedTaxAmount,
        }),
        ...(commissionTaxable !== undefined && { commissionTaxable }),
        ...(employmentStatus && { employmentStatus }),
        ...(statusChanged && {
          statusChangedAt: new Date(),
          statusChangedById: actor.id,
          statusChangedByEmail: actor.email,
        }),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        ...(hireDate !== undefined && { hireDate: effectiveHireDate }),
        probationEndsAt: probationEndsAt
          ? new Date(probationEndsAt)
          : undefined,
        contractEndDate: contractEndDate
          ? new Date(contractEndDate)
          : undefined,
      },
      include: { department: true, branch: true },
    });

    const locationChanged =
      rest.branchId !== undefined ||
      rest.nationality !== undefined ||
      rest.region !== undefined;

    if (locationChanged) {
      await this.leaveService.ensurePublicHolidaysSeededForEmployee(
        tenantId,
        updated.id,
        [new Date().getFullYear(), new Date().getFullYear() + 1],
      );
    }

    if ('managerId' in rest) {
      await this.prisma.appraisal.updateMany({
        where: { tenantId, employeeId: id, status: 'IN_PROGRESS' },
        data: { managerId: rest.managerId ?? null },
      });
    }

    return this.encryption.decryptEmployeeFields(updated);
  }

  private async getTenantResignationConfig(tenantId: string) {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        resignationNoticePeriodDays: true,
      },
    });

    return {
      resignationNoticePeriodDays: config?.resignationNoticePeriodDays ?? 30,
    };
  }

  private buildResignationDetailLink(tenantSlug: string, employeeId: string) {
    const baseUrl = process.env.FRONTEND_BASE_URL!;
    return `${baseUrl}/${tenantSlug}/hr/employees/${employeeId}?tab=resignation`;
  }

  private buildTenantWorkspaceLink(tenantSlug: string) {
    const baseUrl = process.env.FRONTEND_BASE_URL!;
    return `${baseUrl}/${tenantSlug}/login`;
  }

  private toResignationNotificationRecipient(
    recipient: PermissionRecipient,
    source: ResignationNotificationRecipient['source'],
  ): ResignationNotificationRecipient {
    return {
      userId: recipient.userId,
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      source,
    };
  }

  private dedupeResignationRecipients(
    recipients: ResignationNotificationRecipient[],
  ): ResignationNotificationRecipient[] {
    const unique = new Map<string, ResignationNotificationRecipient>();

    for (const recipient of recipients) {
      const key = recipient.userId || recipient.email.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, recipient);
      }
    }

    return [...unique.values()];
  }

  private async resolveResignationManagerRecipient(
    tenantId: string,
    employee: {
      managerId: string | null;
      departmentId: string | null;
    },
  ): Promise<ResignationNotificationRecipient | null> {
    let manager: {
      userId: string | null;
      email: string | null;
      firstName: string;
      lastName: string;
    } | null = null;

    if (employee.managerId) {
      manager = await this.prisma.employee.findFirst({
        where: { id: employee.managerId, tenantId },
        select: {
          userId: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
    }

    if (!manager && employee.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: employee.departmentId, tenantId },
        select: { managerId: true },
      });

      if (department?.managerId) {
        manager = await this.prisma.employee.findFirst({
          where: { id: department.managerId, tenantId },
          select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });
      }
    }

    if (!manager?.email) {
      return null;
    }

    return {
      userId: manager.userId,
      email: manager.email,
      firstName: manager.firstName,
      lastName: manager.lastName,
      source: 'MANAGER',
    };
  }

  async resolveResignationNotificationRecipients(
    tenantId: string,
    employeeId: string,
  ): Promise<ResignationNotificationRecipients> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        managerId: true,
        departmentId: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const [manager, permissionRecipients] = await Promise.all([
      this.resolveResignationManagerRecipient(tenantId, employee),
      this.rabbitmq.authResolvePermissionRecipients({
        tenantId,
        resource: 'employees',
        action: 'DELETE',
        activeOnly: true,
      }),
    ]);

    const approvers = this.dedupeResignationRecipients(
      permissionRecipients
        .filter((recipient) => recipient.email)
        .filter((recipient) => recipient.userId !== employee.userId)
        .map((recipient) =>
          this.toResignationNotificationRecipient(recipient, 'APPROVER'),
        ),
    ).filter(
      (recipient) =>
        !manager ||
        (recipient.userId && manager.userId
          ? recipient.userId !== manager.userId
          : recipient.email.toLowerCase() !== manager.email.toLowerCase()),
    );

    const all = this.dedupeResignationRecipients(
      [manager, ...approvers].filter(
        (recipient): recipient is ResignationNotificationRecipient =>
          recipient !== null,
      ),
    );

    return { manager, approvers, all };
  }

  async submitResignation(
    tenantId: string,
    employeeId: string,
    dto: SubmitResignationDto,
    actor: RequestUser,
  ) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );
    assertHrAccess(actorEmployee.id === employeeId);

    const employee = await this.findById(tenantId, employeeId, actor);
    if (
      employee.employmentStatus !== 'ACTIVE' &&
      employee.employmentStatus !== 'PROBATION'
    ) {
      throw new BadRequestException(
        'Only employees with Active or Probation status can submit a resignation.',
      );
    }

    const existing = await this.prisma.resignationRecord.findUnique({
      where: { employeeId },
    });

    if (existing?.status === 'PENDING') {
      throw new BadRequestException(
        'You have already submitted a resignation that is being processed.',
      );
    }

    if (existing?.status === 'OFFBOARDING_INITIATED') {
      throw new BadRequestException(
        'Your offboarding process has already started, so the resignation can no longer be changed.',
      );
    }

    const config = await this.getTenantResignationConfig(tenantId);
    const submittedAt = new Date();
    const lastWorkingDate = new Date(dto.lastWorkingDate);
    const minimumDate = new Date(submittedAt);
    minimumDate.setHours(0, 0, 0, 0);
    minimumDate.setDate(
      minimumDate.getDate() + config.resignationNoticePeriodDays,
    );

    if (Number.isNaN(lastWorkingDate.getTime())) {
      throw new BadRequestException('Last working date is invalid.');
    }

    if (lastWorkingDate < minimumDate) {
      throw new BadRequestException(
        `Last working date must be at least ${config.resignationNoticePeriodDays} day(s) from today.`,
      );
    }

    const previousResignationSnapshot = existing
      ? {
          lastWorkingDate: existing.lastWorkingDate,
          reason: existing.reason,
          additionalNotes: existing.additionalNotes,
          status: existing.status,
          submittedAt: existing.submittedAt,
          withdrawnAt: existing.withdrawnAt,
          dismissedAt: existing.dismissedAt,
          dismissedById: existing.dismissedById,
          dismissedByEmail: existing.dismissedByEmail,
          offboardingInitiatedAt: existing.offboardingInitiatedAt,
          offboardingRecordId: existing.offboardingRecordId,
        }
      : null;

    const resignation = await this.prisma.resignationRecord.upsert({
      where: { employeeId },
      create: {
        tenantId,
        employeeId,
        lastWorkingDate,
        reason: dto.reason,
        additionalNotes: dto.additionalNotes?.trim() || null,
        status: 'PENDING',
        submittedAt,
      },
      update: {
        lastWorkingDate,
        reason: dto.reason,
        additionalNotes: dto.additionalNotes?.trim() || null,
        status: 'PENDING',
        submittedAt,
        withdrawnAt: null,
        dismissedAt: null,
        dismissedById: null,
        dismissedByEmail: null,
        offboardingInitiatedAt: null,
        offboardingRecordId: null,
      },
    });

    const detailLink = this.buildResignationDetailLink(
      actor.tenantSlug,
      employeeId,
    );
    const reasonLabel = dto.reason
      ? dto.reason
          .split('_')
          .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
          .join(' ')
      : undefined;

    // Delay notifications by 30 minutes — gives the employee a withdrawal window.
    // The processor re-checks status before firing; if withdrawn, it skips silently.
    try {
      await this.resignationQueue.add(
        RESIGNATION_NOTIFY_JOB,
        {
          tenantId,
          employeeId,
          employeeFirstName: employee.firstName,
          employeeLastName: employee.lastName,
          lastWorkingDate: lastWorkingDate.toISOString(),
          reason: reasonLabel,
          additionalNotes: dto.additionalNotes?.trim() || undefined,
          detailLink,
        },
        {
          delay: RESIGNATION_NOTIFY_DELAY_MS,
          jobId: `resignation-notify-${tenantId}-${employeeId}-${submittedAt.getTime()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60_000,
          },
          removeOnComplete: true,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to schedule resignation notification for employee ${employeeId}`,
        error,
      );

      try {
        if (previousResignationSnapshot) {
          await this.prisma.resignationRecord.update({
            where: { employeeId },
            data: previousResignationSnapshot,
          });
        } else {
          await this.prisma.resignationRecord.delete({
            where: { employeeId },
          });
        }
      } catch (rollbackError) {
        this.logger.error(
          `Failed to roll back resignation submission after queue scheduling error for employee ${employeeId}`,
          rollbackError,
        );
      }

      throw new ServiceUnavailableException(
        'Could not submit the resignation right now. Please try again.',
      );
    }

    return {
      message:
        'Your resignation has been submitted. You have 30 minutes to withdraw it if you change your mind. Your manager and relevant offboarding approvers will be notified after that.',
      resignation,
    };
  }

  async getResignationRecord(
    tenantId: string,
    employeeId: string,
    actor: RequestUser,
  ) {
    await this.findById(tenantId, employeeId, actor);

    return this.prisma.resignationRecord.findUnique({
      where: { employeeId },
    });
  }

  async withdrawResignation(
    tenantId: string,
    employeeId: string,
    actor: RequestUser,
  ) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );
    assertHrAccess(actorEmployee.id === employeeId);

    const resignation = await this.prisma.resignationRecord.findUnique({
      where: { employeeId },
    });

    if (!resignation || resignation.tenantId !== tenantId) {
      throw new NotFoundException('No resignation found for this employee.');
    }

    if (resignation.status === 'OFFBOARDING_INITIATED') {
      throw new BadRequestException(
        'You can no longer withdraw this resignation because offboarding has already been initiated.',
      );
    }

    if (resignation.status !== 'PENDING') {
      throw new BadRequestException(
        'Only a pending resignation can be withdrawn.',
      );
    }

    return {
      message: 'Resignation withdrawn successfully.',
      resignation: await this.prisma.resignationRecord.update({
        where: { employeeId },
        data: {
          status: 'WITHDRAWN',
          withdrawnAt: new Date(),
        },
      }),
    };
  }

  async dismissResignation(
    tenantId: string,
    employeeId: string,
    _dto: DismissResignationDto,
    actor: RequestUser,
  ) {
    await this.findById(tenantId, employeeId, actor);

    const resignation = await this.prisma.resignationRecord.findUnique({
      where: { employeeId },
    });

    if (!resignation || resignation.tenantId !== tenantId) {
      throw new NotFoundException('No resignation found for this employee.');
    }

    if (resignation.status !== 'PENDING') {
      throw new BadRequestException(
        'Only a pending resignation can be dismissed.',
      );
    }

    return {
      message: 'Resignation dismissed successfully.',
      resignation: await this.prisma.resignationRecord.update({
        where: { employeeId },
        data: {
          status: 'DISMISSED',
          dismissedAt: new Date(),
          dismissedById: actor.id,
          dismissedByEmail: actor.email,
        },
      }),
    };
  }

  async initiateOffboardFromResignation(
    tenantId: string,
    employeeId: string,
    actor: RequestUser,
  ) {
    await this.findById(tenantId, employeeId, actor);

    const { offboarding, resignation } = await this.prisma.$transaction(
      async (tx) => {
        const employee = await tx.employee.findFirst({
          where: { id: employeeId, tenantId },
          select: { hireDate: true, employmentStatus: true },
        });

        if (!employee) {
          throw new NotFoundException('Employee not found');
        }

        if (
          employee.employmentStatus !== 'ACTIVE' &&
          employee.employmentStatus !== 'PROBATION'
        ) {
          throw new BadRequestException(
            'Offboarding can only be initiated for Active or Probation employees',
          );
        }

        const resignation = await tx.resignationRecord.findUnique({
          where: { employeeId },
        });

        if (!resignation || resignation.tenantId !== tenantId) {
          throw new NotFoundException(
            'No resignation found for this employee.',
          );
        }

        if (resignation.status !== 'PENDING') {
          throw new BadRequestException(
            'Only a pending resignation can be used to initiate offboarding.',
          );
        }

        const offboarding = await this.upsertOffboardingRecord(
          tx,
          tenantId,
          employeeId,
          {
            reason: OffboardReason.RESIGNATION,
            lastWorkingDate: resignation.lastWorkingDate.toISOString(),
            exitNotes: resignation.additionalNotes ?? undefined,
          },
          employee,
        );

        const updatedResignation = await tx.resignationRecord.update({
          where: { employeeId },
          data: {
            status: 'OFFBOARDING_INITIATED',
            offboardingInitiatedAt: new Date(),
            offboardingRecordId: offboarding.id,
          },
        });

        return {
          offboarding,
          resignation: updatedResignation,
        };
      },
    );

    return {
      message: 'Offboarding initiated from resignation successfully.',
      resignation,
      offboarding,
    };
  }

  // ── Offboarding ───────────────────────────────────────────────────────────

  async initiateOffboard(
    tenantId: string,
    id: string,
    dto: InitiateOffboardDto,
  ) {
    const employee = await this.findById(tenantId, id);

    if (
      employee.employmentStatus !== 'ACTIVE' &&
      employee.employmentStatus !== 'PROBATION'
    ) {
      throw new BadRequestException(
        'Offboarding can only be initiated for Active or Probation employees',
      );
    }

    return this.upsertOffboardingRecord(this.prisma, tenantId, id, dto, {
      hireDate: employee.hireDate,
    });
  }

  async getOffboardingRecord(
    tenantId: string,
    employeeId: string,
    actor: RequestUser,
  ) {
    await this.findById(tenantId, employeeId, actor);
    return this.prisma.offboardingRecord.findFirst({
      where: { employeeId, tenantId },
    });
  }

  async updateOffboardChecklist(
    tenantId: string,
    employeeId: string,
    dto: UpdateChecklistDto,
    actor: { id: string; email: string },
  ) {
    await this.findById(tenantId, employeeId);

    const record = await this.prisma.offboardingRecord.findFirst({
      where: { employeeId, tenantId },
    });
    if (!record) {
      throw new BadRequestException(
        'No offboarding record found. Initiate offboarding first.',
      );
    }
    if (!record.isDraft) {
      throw new BadRequestException('Offboarding is already completed');
    }

    const now = new Date();
    const fieldMap: Record<
      UpdateChecklistDto['item'],
      {
        done: string;
        doneById: string;
        doneByEmail: string;
        doneAt: string;
      }
    > = {
      assetReturn: {
        done: 'assetReturnDone',
        doneById: 'assetReturnDoneById',
        doneByEmail: 'assetReturnDoneByEmail',
        doneAt: 'assetReturnDoneAt',
      },
      hrClearance: {
        done: 'hrClearanceDone',
        doneById: 'hrClearanceDoneById',
        doneByEmail: 'hrClearanceDoneByEmail',
        doneAt: 'hrClearanceDoneAt',
      },
      financeClearance: {
        done: 'financeClearanceDone',
        doneById: 'financeClearanceDoneById',
        doneByEmail: 'financeClearanceDoneByEmail',
        doneAt: 'financeClearanceDoneAt',
      },
      reportingClearance: {
        done: 'managerApprovalDone',
        doneById: 'managerApprovalDoneById',
        doneByEmail: 'managerApprovalDoneByEmail',
        doneAt: 'managerApprovalDoneAt',
      },
    };

    const fields = fieldMap[dto.item];
    return this.prisma.offboardingRecord.update({
      where: { id: record.id },
      data: {
        [fields.done]: dto.done,
        [fields.doneById]: dto.done ? actor.id : null,
        [fields.doneByEmail]: dto.done ? actor.email : null,
        [fields.doneAt]: dto.done ? now : null,
      },
    });
  }

  async completeOffboard(
    tenantId: string,
    employeeId: string,
    actor: { id: string; email: string; tenantSlug: string },
  ) {
    await this.findById(tenantId, employeeId);

    const record = await this.prisma.offboardingRecord.findFirst({
      where: { employeeId, tenantId },
    });
    if (!record) {
      throw new BadRequestException(
        'No offboarding record found. Initiate offboarding first.',
      );
    }
    if (!record.isDraft) {
      throw new BadRequestException('Offboarding is already completed');
    }

    const allClear =
      record.assetReturnDone &&
      record.hrClearanceDone &&
      record.financeClearanceDone &&
      record.managerApprovalDone;

    if (!allClear) {
      throw new BadRequestException(
        'All clearance checklist items must be completed before offboarding can be finalised',
      );
    }

    const now = new Date();

    // 1. Mark record complete + set employee status in a transaction
    const [, employee] = await this.prisma.$transaction([
      this.prisma.offboardingRecord.update({
        where: { id: record.id },
        data: {
          isDraft: false,
          completedAt: now,
          completedById: actor.id,
          completedByEmail: actor.email,
        },
      }),
      this.prisma.employee.update({
        where: { id: employeeId },
        data: {
          employmentStatus: 'OFFBOARDED',
          offboardedAt: record.lastWorkingDate,
          offboardReason: record.reason,
          statusChangedAt: now,
          statusChangedById: actor.id,
          statusChangedByEmail: actor.email,
        },
      }),
    ]);

    // 2. Revoke auth access immediately. If this fails, the recovery cron
    // will retry for any still-active auth account tied to an offboarded employee.
    if (employee.userId) {
      await this.rabbitmq
        .authDeactivateEmployeeAccess({
          tenantId,
          userId: employee.userId,
          email: employee.email ?? undefined,
          reason: record.reason,
        })
        .catch((err) =>
          this.logger.error(
            `Failed to deactivate auth access for offboarded employee ${employee.email}`,
            err,
          ),
        );
    }

    // 3. Notify the employee their employment has ended (all offboard reasons)
    if (employee.email)
      void this.rabbitmq
        .notificationEmployeeTermination({
          tenantId,
          employeeId,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
          reason: record.reason,
          lastWorkingDate: record.lastWorkingDate
            ? record.lastWorkingDate.toISOString()
            : new Date().toISOString(),
          platformLink: this.buildTenantWorkspaceLink(actor.tenantSlug),
        })
        .catch((err) =>
          this.logger.error(
            `Failed to emit termination notification for ${employee.email}`,
            err,
          ),
        );

    return { message: 'Offboarding completed successfully', employee };
  }

  async listAllowances(tenantId: string, employeeId: string) {
    await this.findById(tenantId, employeeId);
    return this.prisma.employeeAllowance.findMany({
      where: { tenantId, employeeId },
      orderBy: [{ effectiveFrom: 'desc' }],
    });
  }

  private allowanceNameFromType(type: string): string {
    const labels: Record<string, string> = {
      TRANSPORT: 'Transport Allowance',
      HOUSING: 'Housing Allowance',
      MEDICAL: 'Medical Allowance',
      CLOTHING: 'Clothing Allowance',
      OTHER: 'Other Allowance',
    };
    return labels[type] ?? `${type} Allowance`;
  }

  async addAllowance(
    tenantId: string,
    employeeId: string,
    dto: CreateEmployeeAllowanceDto,
  ) {
    await this.findById(tenantId, employeeId);
    return this.prisma.employeeAllowance.create({
      data: {
        tenantId,
        employeeId,
        name:
          dto.type === 'OTHER' && dto.name?.trim()
            ? dto.name.trim()
            : this.allowanceNameFromType(dto.type),
        type: dto.type as AllowanceType,
        amount: dto.amount,
        effectiveFrom: new Date(),
      },
    });
  }

  async updateAllowance(
    tenantId: string,
    employeeId: string,
    allowanceId: string,
    dto: UpdateEmployeeAllowanceDto,
  ) {
    await this.findById(tenantId, employeeId);
    const existing = await this.prisma.employeeAllowance.findFirst({
      where: { id: allowanceId, tenantId, employeeId },
    });
    if (!existing) throw new NotFoundException('Allowance not found');

    const resolvedType = dto.type ?? existing.type;
    const nameUpdate =
      dto.type != null || dto.name != null
        ? resolvedType === 'OTHER' && dto.name?.trim()
          ? dto.name.trim()
          : this.allowanceNameFromType(resolvedType)
        : undefined;

    return this.prisma.employeeAllowance.update({
      where: { id: allowanceId },
      data: {
        ...(dto.type != null ? { type: dto.type as AllowanceType } : {}),
        ...(nameUpdate != null ? { name: nameUpdate } : {}),
        ...(dto.amount != null ? { amount: dto.amount } : {}),
      },
    });
  }

  async deleteAllowance(
    tenantId: string,
    employeeId: string,
    allowanceId: string,
  ) {
    await this.findById(tenantId, employeeId);
    const existing = await this.prisma.employeeAllowance.findFirst({
      where: { id: allowanceId, tenantId, employeeId },
    });
    if (!existing) throw new NotFoundException('Allowance not found');
    await this.prisma.employeeAllowance.delete({ where: { id: allowanceId } });
  }

  async listDeductions(tenantId: string, employeeId: string) {
    await this.findById(tenantId, employeeId);

    return this.prisma.employeeDeduction.findMany({
      where: { tenantId, employeeId },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async addDeduction(
    tenantId: string,
    employeeId: string,
    dto: CreateEmployeeDeductionDto,
  ) {
    await this.findById(tenantId, employeeId);

    if (dto.monthlyRate > dto.totalAmount) {
      throw new BadRequestException('Monthly rate cannot exceed total amount');
    }

    return this.prisma.employeeDeduction.create({
      data: {
        tenantId,
        employeeId,
        name: dto.name.trim(),
        totalAmount: dto.totalAmount,
        monthlyRate: dto.monthlyRate,
        startDate: new Date(dto.startDate),
      },
    });
  }

  async updateDeduction(
    tenantId: string,
    employeeId: string,
    deductionId: string,
    dto: UpdateEmployeeDeductionDto,
  ) {
    await this.findById(tenantId, employeeId);

    const existing = await this.prisma.employeeDeduction.findFirst({
      where: { id: deductionId, tenantId, employeeId },
    });
    if (!existing) throw new NotFoundException('Deduction not found');

    const totalAmount =
      dto.totalAmount != null ? dto.totalAmount : Number(existing.totalAmount);
    const monthlyRate =
      dto.monthlyRate != null ? dto.monthlyRate : Number(existing.monthlyRate);
    const amountPaid = Number(existing.amountPaid);

    if (totalAmount < amountPaid) {
      throw new BadRequestException(
        'Total amount cannot be lower than the amount already paid',
      );
    }

    if (monthlyRate > totalAmount) {
      throw new BadRequestException('Monthly rate cannot exceed total amount');
    }

    return this.prisma.employeeDeduction.update({
      where: { id: deductionId },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.totalAmount != null ? { totalAmount: dto.totalAmount } : {}),
        ...(dto.monthlyRate != null ? { monthlyRate: dto.monthlyRate } : {}),
        ...(dto.startDate != null
          ? { startDate: new Date(dto.startDate) }
          : {}),
      },
    });
  }

  async deleteDeduction(
    tenantId: string,
    employeeId: string,
    deductionId: string,
  ) {
    await this.findById(tenantId, employeeId);

    const existing = await this.prisma.employeeDeduction.findFirst({
      where: { id: deductionId, tenantId, employeeId },
    });
    if (!existing) throw new NotFoundException('Deduction not found');

    if (Number(existing.amountPaid) > 0) {
      throw new BadRequestException(
        'Partially paid deductions cannot be deleted. Set the total amount to the paid amount instead.',
      );
    }

    await this.prisma.employeeDeduction.delete({ where: { id: deductionId } });
  }

  async listDocuments(tenantId: string, employeeId: string) {
    await this.findById(tenantId, employeeId);
    return this.resolveDocumentUrls(
      await this.prisma.employeeDocument.findMany({
        where: { tenantId, employeeId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async listDocumentsForUser(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return this.listDocuments(tenantId, employee.id);
  }

  private async resolveDocumentUrls(documents: EmployeeDocument[]) {
    return Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        url: await this.documentStorage
          .createSignedReadUrl({
            objectKey: doc.url,
            mimeType: doc.mimeType,
            fileName: doc.name,
          })
          .then((signed) => signed.readUrl),
      })),
    );
  }

  async uploadDocument(
    tenantId: string,
    employeeId: string,
    dto: CreateEmployeeDocumentDto,
    file: Express.Multer.File | undefined,
    actor: RequestUser,
  ) {
    await this.findById(tenantId, employeeId);
    this.validateDocumentFile(file);
    const uploadedFile = file as Express.Multer.File;

    const stored = await this.documentStorage.store({
      tenantId,
      employeeId,
      body: uploadedFile.buffer,
      contentType: uploadedFile.mimetype,
      originalFileName: uploadedFile.originalname,
    });

    const document = await this.prisma.employeeDocument.create({
      data: {
        tenantId,
        employeeId,
        type: dto.type,
        customType:
          dto.type === 'OTHER' ? dto.customType?.trim() || null : null,
        name: stored.fileName,
        url: stored.objectKey,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        uploadedBy: actor.email ?? actor.id,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    const signed = await this.documentStorage.createSignedReadUrl({
      objectKey: document.url,
      mimeType: stored.mimeType,
      fileName: document.name,
    });
    return { ...document, url: signed.readUrl };
  }

  async deleteDocument(
    tenantId: string,
    employeeId: string,
    documentId: string,
  ): Promise<void> {
    const document = await this.prisma.employeeDocument.findFirst({
      where: { id: documentId, tenantId, employeeId },
    });
    if (!document) throw new NotFoundException('Document not found');

    await this.prisma.employeeDocument.delete({ where: { id: document.id } });

    await this.documentStorage
      .delete(document.url)
      .catch((error) =>
        this.logger.error(
          `Failed to delete employee document object ${document.url}`,
          error,
        ),
      );
  }

  private validateDocumentFile(file: Express.Multer.File | undefined): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('A document file is required.');
    }
    if (
      file.size > DOCUMENT_MAX_BYTES ||
      file.buffer.byteLength > DOCUMENT_MAX_BYTES
    ) {
      throw new BadRequestException(
        `Document exceeds the ${DOCUMENT_MAX_BYTES / 1024 / 1024} MB limit.`,
      );
    }
  }

  async resendInvite(
    tenantId: string,
    employeeId: string,
    actor?: RequestUser,
    key?: string,
    reason = 'Resend employee invitation',
  ) {
    assertAccessActor(actor, tenantId, 'EDIT', 'CREATE');
    if (!this.access)
      throw new ServiceUnavailableException(
        'Employee access service unavailable.',
      );
    return this.access.lifecycle(
      tenantId,
      employeeId,
      actor!,
      accessKey(key),
      'RESEND',
      reason,
    );
  }
}
