import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { getPaginationParams, buildMeta } from '@work-phelo/utils';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly leaveService: LeaveService,
  ) {}

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

    const count = await this.prisma.employee.count({ where: { tenantId } });
    const employeeNumber = `EMP-${String(count + 1).padStart(4, '0')}`;

    const employee = await this.prisma.employee.create({
      data: {
        tenantId,
        employeeNumber,
        ...(dto.userId ? { userId: dto.userId } : {}),
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

    // Fire-and-forget — HR returns immediately, auth handles invite async
    this.logger.log(`Emitting auth.invite_employee for ${employee.email}`);
    void this.rabbitmq
      .authInviteEmployee({
        tenantId,
        employeeId: employee.id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
      })
      .then(() =>
        this.logger.log(`auth.invite_employee emitted for ${employee.email}`),
      )
      .catch((err) =>
        this.logger.error(
          `Failed to emit auth.invite_employee for ${employee.email}`,
          err,
        ),
      );

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

  async findAll(tenantId: string, query: QueryEmployeesDto) {
    const { take, skip, page } = getPaginationParams(query);

    const where: any = { tenantId };
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

  async findById(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: {
        department: true,
        branch: true,
        allowances: true,
        documents: true,
        leaveBalances: { include: { leaveType: true } },
        offboarding: true,
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async findByUserId(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
      include: { department: true, allowances: true },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');
    const managedDeptCount = await this.prisma.department.count({
      where: { managerId: employee.id, tenantId },
    });
    return { ...employee, isManager: managedDeptCount > 0 };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateEmployeeDto,
    actor?: { id: string; email: string },
  ) {
    const existing = await this.findById(tenantId, id);

    const {
      employmentStatus,
      dateOfBirth,
      probationEndsAt,
      contractEndDate,
      ...rest
    } = dto;

    // Track status change
    const statusChanged =
      employmentStatus && employmentStatus !== existing.employmentStatus;

    return this.prisma.employee.update({
      where: { id },
      data: {
        ...rest,
        ...(employmentStatus && { employmentStatus }),
        ...(statusChanged &&
          actor && {
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

  async getOffboardingRecord(tenantId: string, employeeId: string) {
    const record = await this.prisma.offboardingRecord.findFirst({
      where: { employeeId, tenantId },
    });
    return record;
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
      managerApproval: {
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
        'All four clearance checklist items must be completed before offboarding can be finalised',
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
