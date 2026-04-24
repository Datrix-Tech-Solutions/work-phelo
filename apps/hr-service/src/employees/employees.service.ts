import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { CreateEmployeeDto } from './dto/create-employee.dto';
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
import { getPaginationParams, buildMeta } from '@work-phelo/utils';
import {
  assertHrAccess,
  getActorEmployee,
  hasPermissionRule,
  isCompanyAdminUser,
  isEmployeeSelfServiceUser,
} from '../auth/access-scope';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly leaveService: LeaveService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private isDuplicateAuthUserError(error: unknown) {
    const remote =
      error && typeof error === 'object'
        ? (error as { message?: unknown; statusCode?: unknown })
        : undefined;
    const message =
      typeof remote?.message === 'string' ? remote.message : String(error);

    return (
      remote?.statusCode === 409 ||
      message.includes('A user with this email already exists')
    );
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    // Enforce minimum one department before adding employees
    const deptCount = await this.prisma.department.count({
      where: { tenantId, isActive: true },
    });
    if (deptCount === 0) {
      throw new BadRequestException(
        'Please set up at least one department before adding employees.',
      );
    }

    const existing = await this.prisma.employee.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
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

    const count = await this.prisma.employee.count({ where: { tenantId } });
    const employeeNumber = `EMP-${String(count + 1).padStart(4, '0')}`;
    let provisionedUser;
    try {
      provisionedUser = await this.rabbitmq.authProvisionEmployeeInvite({
        tenantId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      });
    } catch (error) {
      if (this.isDuplicateAuthUserError(error)) {
        throw new ConflictException('A user with this email already exists.');
      }
      throw error;
    }

    let employee;
    try {
      employee = await this.prisma.employee.create({
        data: {
          tenantId,
          employeeNumber,
          userId: provisionedUser.userId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          maritalStatus: dto.maritalStatus,
          nationality: dto.nationality,
          address: dto.address,
          city: dto.city,
          region: dto.region,
          emergencyName: dto.emergencyName,
          emergencyPhone: dto.emergencyPhone,
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
          nationalId: dto.nationalId,
          bankName: dto.bankName,
          bankAccountNumber: dto.bankAccountNumber,
          bankBranch: dto.bankBranch,
          ssnit: dto.ssnit,
          tinNumber: dto.tinNumber,
          ...(dto.departmentId && { departmentId: dto.departmentId }),
          ...(dto.branchId && { branchId: dto.branchId }),
          ...(dto.managerId && { managerId: dto.managerId }),
        },
        include: { department: true, branch: true },
      });
    } catch (err) {
      try {
        await this.rabbitmq.authDeletePendingEmployeeInvite({
          tenantId,
          userId: provisionedUser.userId,
          email: dto.email,
        });
      } catch (rollbackErr) {
        this.logger.error(
          `Failed to roll back auth invite for ${dto.email} after HR employee creation failed`,
          rollbackErr,
        );
      }
      throw err;
    }

    // Initialise leave balances immediately so the employee can request leave
    // as soon as their account is active. Uses upsert — safe to call multiple times.
    void this.leaveService
      .initializeLeaveBalances(tenantId, employee.id)
      .then(() =>
        this.logger.log(`Leave balances initialised for ${employee.email}`),
      )
      .catch((err) =>
        this.logger.error(
          `Failed to initialise leave balances for ${employee.email}`,
          err,
        ),
      );

    return employee;
  }

  async findAll(
    tenantId: string,
    query: QueryEmployeesDto,
    actor?: RequestUser,
  ) {
    const { take, skip, page } = getPaginationParams(query);

    const where: any = { tenantId };

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

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        take,
        skip,
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
          department: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { employees, meta: buildMeta(page, take, total) };
  }

  async findById(tenantId: string, id: string, actor?: RequestUser) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: {
        department: true,
        branch: true,
        allowances: true,
        documents: true,
        leaveBalances: { include: { leaveType: true } },
        offboarding: true,
        resignation: true,
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (!actor) {
      return employee;
    }

    if (isCompanyAdminUser(actor)) {
      return employee;
    }

    if (isEmployeeSelfServiceUser(actor)) {
      if (hasPermissionRule(actor, 'employees:VIEW')) {
        return employee;
      }

      const actorEmployee = await getActorEmployee(
        this.prisma,
        tenantId,
        actor.id,
      );
      assertHrAccess(employee.id === actorEmployee.id);
      return employee;
    }

    assertHrAccess(hasPermissionRule(actor, 'employees:VIEW'));
    return employee;
  }

  async findByUserId(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
      include: { department: true, allowances: true, resignation: true },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return employee;
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
      const manager = await this.prisma.employee.findFirst({
        where: { id: rest.managerId, tenantId },
      });
      if (!manager) throw new NotFoundException('Manager not found');
    }

    // Track status change
    const statusChanged =
      employmentStatus && employmentStatus !== existing.employmentStatus;

    return this.prisma.employee.update({
      where: { id },
      data: {
        ...rest,
        ...(employmentStatus && { employmentStatus }),
        ...(statusChanged && {
          statusChangedAt: new Date(),
          statusChangedById: actor.id,
          statusChangedByEmail: actor.email,
        }),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        probationEndsAt: probationEndsAt
          ? new Date(probationEndsAt)
          : undefined,
        contractEndDate: contractEndDate
          ? new Date(contractEndDate)
          : undefined,
      },
      include: { department: true, branch: true },
    });
  }

  private async getTenantResignationConfig(tenantId: string) {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        adminEmail: true,
        adminUserId: true,
        resignationNoticePeriodDays: true,
      },
    });

    return {
      adminEmail: config?.adminEmail || null,
      adminUserId: config?.adminUserId || null,
      resignationNoticePeriodDays: config?.resignationNoticePeriodDays ?? 30,
    };
  }

  private buildResignationDetailLink(tenantSlug: string, employeeId: string) {
    return `/${tenantSlug}/hr/employees/${employeeId}?tab=resignation`;
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

    if (config.adminUserId) {
      await this.notificationsService.create({
        tenantId,
        userId: config.adminUserId,
        type: 'RESIGNATION_SUBMITTED',
        message: `${employee.firstName} ${employee.lastName} submitted a resignation effective ${lastWorkingDate.toLocaleDateString(
          'en-GB',
        )}${reasonLabel ? ` (${reasonLabel})` : ''}.`,
        link: detailLink,
      });
    }

    if (config.adminEmail) {
      void this.rabbitmq
        .notificationResignationSubmitted({
          tenantId,
          adminEmail: config.adminEmail,
          employeeId,
          employeeFirstName: employee.firstName,
          employeeLastName: employee.lastName,
          lastWorkingDate: lastWorkingDate.toISOString(),
          reason: reasonLabel,
          additionalNotes: dto.additionalNotes?.trim() || undefined,
          detailLink,
        })
        .catch((err) =>
          this.logger.error(
            `Failed to emit resignation notification for ${employee.email}`,
            err,
          ),
        );
    }

    return {
      message:
        'Your resignation has been submitted. Your HR administrator will be in touch regarding your offboarding process.',
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

    const resignation = await this.prisma.resignationRecord.findUnique({
      where: { employeeId },
    });

    if (!resignation || resignation.tenantId !== tenantId) {
      throw new NotFoundException('No resignation found for this employee.');
    }

    if (resignation.status !== 'PENDING') {
      throw new BadRequestException(
        'Only a pending resignation can be used to initiate offboarding.',
      );
    }

    const offboarding = await this.initiateOffboard(
      tenantId,
      employeeId,
      {
        reason: OffboardReason.RESIGNATION,
        lastWorkingDate: resignation.lastWorkingDate.toISOString(),
        exitNotes: resignation.additionalNotes ?? undefined,
      },
      { id: actor.id, email: actor.email },
    );

    const updatedResignation = await this.prisma.resignationRecord.update({
      where: { employeeId },
      data: {
        status: 'OFFBOARDING_INITIATED',
        offboardingInitiatedAt: new Date(),
        offboardingRecordId: offboarding.id,
      },
    });

    return {
      message: 'Offboarding initiated from resignation successfully.',
      resignation: updatedResignation,
      offboarding,
    };
  }

  // ── Offboarding ───────────────────────────────────────────────────────────

  async initiateOffboard(
    tenantId: string,
    id: string,
    dto: InitiateOffboardDto,
    actor: { id: string; email: string },
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

    return this.prisma.offboardingRecord.upsert({
      where: { employeeId: id },
      create: {
        tenantId,
        employeeId: id,
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

    // 2. Revoke auth access (fire-and-forget)
    if (employee.userId) {
      void this.rabbitmq
        .authEmployeeOffboarded({
          tenantId,
          userId: employee.userId,
          email: employee.email,
          reason: record.reason,
        })
        .catch((err) =>
          this.logger.error(
            `Failed to emit hr.employee_offboarded for ${employee.email}`,
            err,
          ),
        );
    }

    // 3. Notify the employee their employment has ended (all offboard reasons)
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
      })
      .catch((err) =>
        this.logger.error(
          `Failed to emit termination notification for ${employee.email}`,
          err,
        ),
      );

    return { message: 'Offboarding completed successfully', employee };
  }

  async addAllowance(tenantId: string, employeeId: string, dto: any) {
    await this.findById(tenantId, employeeId);
    return this.prisma.employeeAllowance.create({
      data: {
        tenantId,
        employeeId,
        ...dto,
        effectiveFrom: new Date(dto.effectiveFrom),
      },
    });
  }

  async uploadDocument(tenantId: string, employeeId: string, dto: any) {
    await this.findById(tenantId, employeeId);
    return this.prisma.employeeDocument.create({
      data: { tenantId, employeeId, ...dto },
    });
  }

  async resendInvite(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (!employee.email) {
      throw new BadRequestException('Employee has no email address on record');
    }

    void this.rabbitmq.authResendEmployeeInvite({
      tenantId,
      employeeId,
      email: employee.email,
      firstName: employee.firstName,
      lastName: employee.lastName,
    });

    return { message: 'Invitation resent successfully' };
  }
}
