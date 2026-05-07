import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Announcement,
  AnnouncementAudienceType,
  EmploymentStatus,
  Prisma,
} from '../../prisma/generated/client';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { hasPermissionRule, isCompanyAdminUser } from '../auth/access-scope';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { QueryAnnouncementsDto } from './dto/query-announcements.dto';

type AnnouncementActorContext = {
  employeeId: string | null;
  departmentId: string | null;
  branchId: string | null;
};

type AnnouncementEmailRecipient = {
  employeeId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
};

type AnnouncementAudienceSelection = {
  audienceType: AnnouncementAudienceType;
  targetDepartmentIds: string[];
  targetBranchIds: string[];
  targetEmployeeIds: string[];
};

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  private canManageAnnouncements(actor: RequestUser): boolean {
    return (
      isCompanyAdminUser(actor) ||
      hasPermissionRule(actor, 'announcements:CREATE') ||
      hasPermissionRule(actor, 'announcements:EDIT') ||
      hasPermissionRule(actor, 'announcements:DELETE')
    );
  }

  private canReadAnnouncements(actor: RequestUser): boolean {
    return (
      this.canManageAnnouncements(actor) ||
      hasPermissionRule(actor, 'announcements:VIEW')
    );
  }

  private buildTenantWorkspaceLink(tenantSlug: string): string {
    const baseUrl = process.env.FRONTEND_BASE_URL!;
    return `${baseUrl}/${tenantSlug}/login`;
  }

  private normalizeIdList(values?: string[]): string[] {
    return [...new Set((values ?? []).map((value) => value.trim()))].filter(
      (value) => value.length > 0,
    );
  }

  private async getActorContext(
    tenantId: string,
    actor: RequestUser,
  ): Promise<AnnouncementActorContext> {
    if (isCompanyAdminUser(actor)) {
      return { employeeId: null, departmentId: null, branchId: null };
    }

    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, userId: actor.id },
      select: { id: true, departmentId: true, branchId: true },
    });

    if (!employee) {
      return { employeeId: null, departmentId: null, branchId: null };
    }

    return {
      employeeId: employee.id,
      departmentId: employee.departmentId ?? null,
      branchId: employee.branchId ?? null,
    };
  }

  private async normalizeAudienceSelection(
    tenantId: string,
    dto: CreateAnnouncementDto,
  ): Promise<AnnouncementAudienceSelection> {
    const audienceType = dto.audienceType ?? AnnouncementAudienceType.ALL;
    const targetDepartmentIds = this.normalizeIdList(dto.departmentIds);
    const targetBranchIds = this.normalizeIdList(dto.branchIds);
    const targetEmployeeIds = this.normalizeIdList(dto.employeeIds);

    if (audienceType === AnnouncementAudienceType.ALL) {
      return {
        audienceType,
        targetDepartmentIds: [],
        targetBranchIds: [],
        targetEmployeeIds: [],
      };
    }

    if (audienceType === AnnouncementAudienceType.DEPARTMENTS) {
      if (targetDepartmentIds.length === 0) {
        throw new BadRequestException(
          'departmentIds is required when targeting departments.',
        );
      }

      const departments = await this.prisma.department.findMany({
        where: { tenantId, id: { in: targetDepartmentIds }, isActive: true },
        select: { id: true },
      });

      if (departments.length !== targetDepartmentIds.length) {
        throw new BadRequestException(
          'One or more departmentIds are invalid for this tenant.',
        );
      }

      return {
        audienceType,
        targetDepartmentIds,
        targetBranchIds: [],
        targetEmployeeIds: [],
      };
    }

    if (audienceType === AnnouncementAudienceType.BRANCHES) {
      if (targetBranchIds.length === 0) {
        throw new BadRequestException(
          'branchIds is required when targeting branches.',
        );
      }

      const branches = await this.prisma.branch.findMany({
        where: { tenantId, id: { in: targetBranchIds }, isActive: true },
        select: { id: true },
      });

      if (branches.length !== targetBranchIds.length) {
        throw new BadRequestException(
          'One or more branchIds are invalid for this tenant.',
        );
      }

      return {
        audienceType,
        targetDepartmentIds: [],
        targetBranchIds,
        targetEmployeeIds: [],
      };
    }

    if (targetEmployeeIds.length === 0) {
      throw new BadRequestException(
        'employeeIds is required when targeting employees.',
      );
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        id: { in: targetEmployeeIds },
        employmentStatus: { not: EmploymentStatus.OFFBOARDED },
      },
      select: { id: true },
    });

    if (employees.length !== targetEmployeeIds.length) {
      throw new BadRequestException(
        'One or more employeeIds are invalid for this tenant.',
      );
    }

    return {
      audienceType,
      targetDepartmentIds: [],
      targetBranchIds: [],
      targetEmployeeIds,
    };
  }

  private buildVisibilityWhere(
    tenantId: string,
    actorContext: AnnouncementActorContext,
    query: QueryAnnouncementsDto,
    canManage: boolean,
  ): Prisma.AnnouncementWhereInput {
    const where: Prisma.AnnouncementWhereInput = { tenantId };
    const andClauses: Prisma.AnnouncementWhereInput[] = [];

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { body: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.audienceType) {
      where.audienceType = query.audienceType;
    }

    if (query.sendEmail !== undefined) {
      where.sendEmail = query.sendEmail;
    }

    if (!query.includeExpired) {
      andClauses.push({
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      });
    }

    const wantsAll =
      query.view === 'all' || (canManage && query.view !== 'visible');
    if (wantsAll && !canManage) {
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );
    }

    if (canManage && wantsAll) {
      if (andClauses.length > 0) {
        where.AND = andClauses;
      }
      return where;
    }

    const audienceClauses: Prisma.AnnouncementWhereInput[] = [
      { audienceType: AnnouncementAudienceType.ALL },
    ];

    if (actorContext.departmentId) {
      audienceClauses.push({
        audienceType: AnnouncementAudienceType.DEPARTMENTS,
        targetDepartmentIds: { has: actorContext.departmentId },
      });
    }

    if (actorContext.branchId) {
      audienceClauses.push({
        audienceType: AnnouncementAudienceType.BRANCHES,
        targetBranchIds: { has: actorContext.branchId },
      });
    }

    if (actorContext.employeeId) {
      audienceClauses.push({
        audienceType: AnnouncementAudienceType.EMPLOYEES,
        targetEmployeeIds: { has: actorContext.employeeId },
      });
    }

    andClauses.push({ OR: audienceClauses });
    if (andClauses.length > 0) {
      where.AND = andClauses;
    }
    return where;
  }

  private async resolveAnnouncementRecipients(
    tenantId: string,
    announcement: Pick<
      Announcement,
      | 'audienceType'
      | 'targetDepartmentIds'
      | 'targetBranchIds'
      | 'targetEmployeeIds'
    >,
  ): Promise<AnnouncementEmailRecipient[]> {
    const employeeWhere: Prisma.EmployeeWhereInput = {
      tenantId,
      employmentStatus: {
        in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION],
      },
      userId: { not: null },
      email: { not: '' },
    };

    if (announcement.audienceType === AnnouncementAudienceType.DEPARTMENTS) {
      employeeWhere.departmentId = { in: announcement.targetDepartmentIds };
    } else if (
      announcement.audienceType === AnnouncementAudienceType.BRANCHES
    ) {
      employeeWhere.branchId = { in: announcement.targetBranchIds };
    } else if (
      announcement.audienceType === AnnouncementAudienceType.EMPLOYEES
    ) {
      employeeWhere.id = { in: announcement.targetEmployeeIds };
    }

    const employees = await this.prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (employees.length === 0) {
      return [];
    }

    const statuses = await this.rabbitmq.authGetUserStatuses({
      tenantId,
      userIds: employees
        .map((employee) => employee.userId)
        .filter((userId): userId is string => !!userId),
    });
    const activeUserIds = new Set(
      statuses
        .filter((status) => status.status === 'ACTIVE')
        .map((status) => status.userId),
    );

    return employees
      .filter(
        (employee): employee is typeof employee & { userId: string } =>
          !!employee.userId && activeUserIds.has(employee.userId),
      )
      .map((employee) => ({
        employeeId: employee.id,
        userId: employee.userId,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
      }));
  }

  async create(
    tenantId: string,
    actor: RequestUser,
    dto: CreateAnnouncementDto,
  ) {
    const audience = await this.normalizeAudienceSelection(tenantId, dto);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('expiresAt must be in the future.');
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        body: dto.body.trim(),
        sendEmail: dto.sendEmail ?? false,
        expiresAt,
        createdById: actor.id,
        ...audience,
      },
    });

    if (announcement.sendEmail) {
      void this.publishAnnouncementEmails(tenantId, actor, announcement);
    }

    return announcement;
  }

  async findAll(
    tenantId: string,
    actor: RequestUser,
    query: QueryAnnouncementsDto,
  ) {
    const canManage = this.canManageAnnouncements(actor);
    if (!this.canReadAnnouncements(actor)) {
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );
    }

    const actorContext = await this.getActorContext(tenantId, actor);
    const where = this.buildVisibilityWhere(
      tenantId,
      actorContext,
      query,
      canManage,
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findVisibleForDashboard(
    tenantId: string,
    actor: RequestUser,
    limit = 3,
  ) {
    if (!this.canReadAnnouncements(actor)) {
      return [];
    }

    const actorContext = await this.getActorContext(tenantId, actor);
    const where = this.buildVisibilityWhere(
      tenantId,
      actorContext,
      {},
      this.canManageAnnouncements(actor),
    );

    return this.prisma.announcement.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        body: true,
        publishedAt: true,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, tenantId },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id } });
    return { message: 'Announcement deleted successfully' };
  }

  private async publishAnnouncementEmails(
    tenantId: string,
    actor: RequestUser,
    announcement: Announcement,
  ) {
    try {
      const recipients = await this.resolveAnnouncementRecipients(
        tenantId,
        announcement,
      );

      if (recipients.length === 0) {
        this.logger.warn(
          `Announcement ${announcement.id} was marked sendEmail=true but no active recipients were resolved.`,
        );
        return;
      }

      await this.rabbitmq.notificationAnnouncementPublished({
        tenantId,
        announcementId: announcement.id,
        title: announcement.title,
        body: announcement.body,
        publishedAt: announcement.publishedAt.toISOString(),
        platformLink: this.buildTenantWorkspaceLink(actor.tenantSlug),
        recipients,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish announcement email fanout for ${announcement.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
