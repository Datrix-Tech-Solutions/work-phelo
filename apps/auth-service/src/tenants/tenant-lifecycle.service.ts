import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { generateSecureToken } from '../common/otp.helper';
import { WorkspaceUrl } from '../common/workspace-url.helper';
import {
  COMPANY_ROLE_PERMISSIONS,
  Permission as AppPermission,
} from '@work-phelo/config';
import { PermissionAction } from '../../prisma/generated/client';

// ── System permission set definitions ─────────────────────────────────────────
// Config defaults are the single source of truth. These are transformed into
// resource-action pairs at runtime for tenant-scoped permission sets.

type ResourceAction = { resource: string; action: PermissionAction };

const PERMISSION_TO_RESOURCE_ACTIONS: Record<AppPermission, ResourceAction[]> =
  {
    [AppPermission.READ_TENANT]: [
      { resource: 'tenants', action: PermissionAction.VIEW },
    ],
    [AppPermission.UPDATE_TENANT]: [
      { resource: 'tenants', action: PermissionAction.EDIT },
    ],
    [AppPermission.MANAGE_MODULES]: [
      { resource: 'tenants', action: PermissionAction.EDIT },
    ],
    [AppPermission.VIEW_AUDIT_LOGS]: [
      { resource: 'audit-logs', action: PermissionAction.VIEW },
    ],
    [AppPermission.INVITE_USER]: [
      { resource: 'users', action: PermissionAction.CREATE },
    ],
    [AppPermission.READ_USERS]: [
      { resource: 'users', action: PermissionAction.VIEW },
    ],
    [AppPermission.UPDATE_USER]: [
      { resource: 'users', action: PermissionAction.EDIT },
    ],
    [AppPermission.DEACTIVATE_USER]: [
      { resource: 'users', action: PermissionAction.DELETE },
    ],
    [AppPermission.FORCE_RESET_USER]: [
      { resource: 'users', action: PermissionAction.EDIT },
    ],
    [AppPermission.VIEW_PERMISSION_SETS]: [
      { resource: 'permission-sets', action: PermissionAction.VIEW },
    ],
    [AppPermission.GRANT_PERMISSION]: [
      { resource: 'permission-sets', action: PermissionAction.CREATE },
      { resource: 'permission-sets', action: PermissionAction.EDIT },
      { resource: 'permission-sets', action: PermissionAction.DELETE },
      { resource: 'permission-sets', action: PermissionAction.ASSIGN },
    ],
    [AppPermission.CREATE_EMPLOYEE]: [
      { resource: 'employees', action: PermissionAction.CREATE },
    ],
    [AppPermission.READ_EMPLOYEES]: [
      { resource: 'employees', action: PermissionAction.VIEW },
    ],
    [AppPermission.READ_OWN_PROFILE]: [
      { resource: 'employee-profile', action: PermissionAction.VIEW },
    ],
    [AppPermission.UPDATE_EMPLOYEE]: [
      { resource: 'employees', action: PermissionAction.EDIT },
    ],
    [AppPermission.UPDATE_OWN_PROFILE]: [
      { resource: 'employee-profile', action: PermissionAction.EDIT },
    ],
    [AppPermission.DELETE_EMPLOYEE]: [
      { resource: 'employees', action: PermissionAction.DELETE },
    ],
    [AppPermission.OFFBOARD_EMPLOYEE]: [
      { resource: 'employees', action: PermissionAction.DELETE },
    ],
    [AppPermission.SUBMIT_RESIGNATION]: [
      { resource: 'resignations', action: PermissionAction.CREATE },
    ],
    [AppPermission.WITHDRAW_RESIGNATION]: [
      { resource: 'resignations', action: PermissionAction.DELETE },
    ],
    [AppPermission.MANAGE_DOCUMENTS]: [
      { resource: 'documents', action: PermissionAction.CREATE },
      { resource: 'documents', action: PermissionAction.EDIT },
    ],
    [AppPermission.EXPORT_EMPLOYEES]: [
      { resource: 'employees', action: PermissionAction.EXPORT },
    ],
    [AppPermission.READ_HR_SETTINGS]: [
      { resource: 'hr-settings', action: PermissionAction.VIEW },
    ],
    [AppPermission.MANAGE_HR_SETTINGS]: [
      { resource: 'hr-settings', action: PermissionAction.EDIT },
    ],
    [AppPermission.CREATE_BRANCH]: [
      { resource: 'branches', action: PermissionAction.CREATE },
    ],
    [AppPermission.READ_BRANCHES]: [
      { resource: 'branches', action: PermissionAction.VIEW },
    ],
    [AppPermission.UPDATE_BRANCH]: [
      { resource: 'branches', action: PermissionAction.EDIT },
    ],
    [AppPermission.DELETE_BRANCH]: [
      { resource: 'branches', action: PermissionAction.DELETE },
    ],
    [AppPermission.CREATE_DEPARTMENT]: [
      { resource: 'departments', action: PermissionAction.CREATE },
    ],
    [AppPermission.READ_DEPARTMENTS]: [
      { resource: 'departments', action: PermissionAction.VIEW },
    ],
    [AppPermission.UPDATE_DEPARTMENT]: [
      { resource: 'departments', action: PermissionAction.EDIT },
    ],
    [AppPermission.DELETE_DEPARTMENT]: [
      { resource: 'departments', action: PermissionAction.DELETE },
    ],
    [AppPermission.MANAGE_ROLES]: [
      { resource: 'permission-sets', action: PermissionAction.EDIT },
    ],
    [AppPermission.ASSIGN_ROLE]: [
      { resource: 'permission-sets', action: PermissionAction.ASSIGN },
    ],
    [AppPermission.REQUEST_LEAVE]: [
      { resource: 'leave', action: PermissionAction.CREATE },
    ],
    [AppPermission.APPROVE_LEAVE]: [
      { resource: 'leave', action: PermissionAction.APPROVE },
    ],
    [AppPermission.READ_ALL_LEAVES]: [
      { resource: 'leave', action: PermissionAction.VIEW },
    ],
    [AppPermission.READ_OWN_LEAVE]: [
      { resource: 'leave', action: PermissionAction.VIEW },
    ],
    [AppPermission.MANAGE_LEAVE_TYPES]: [
      { resource: 'leave', action: PermissionAction.EDIT },
    ],
    [AppPermission.CLOCK_IN_OUT]: [
      { resource: 'attendance', action: PermissionAction.CREATE },
    ],
    [AppPermission.READ_ATTENDANCE]: [
      { resource: 'attendance', action: PermissionAction.VIEW },
    ],
    [AppPermission.SUBMIT_TIME_CORRECTION]: [
      { resource: 'time-corrections', action: PermissionAction.CREATE },
    ],
    [AppPermission.APPROVE_TIME_CORRECTION]: [
      { resource: 'time-corrections', action: PermissionAction.APPROVE },
    ],
    [AppPermission.READ_TIMESHEETS]: [
      { resource: 'timesheets', action: PermissionAction.VIEW },
    ],
    [AppPermission.APPROVE_TIMESHEET]: [
      { resource: 'timesheets', action: PermissionAction.APPROVE },
    ],
    [AppPermission.MANAGE_SCHEDULES]: [
      { resource: 'schedules', action: PermissionAction.CREATE },
      { resource: 'schedules', action: PermissionAction.EDIT },
    ],
    [AppPermission.READ_PAYROLL]: [
      { resource: 'payroll', action: PermissionAction.VIEW },
    ],
    [AppPermission.RUN_PAYROLL]: [
      { resource: 'payroll', action: PermissionAction.RUN },
    ],
    [AppPermission.APPROVE_PAYROLL]: [
      { resource: 'payroll', action: PermissionAction.APPROVE },
    ],
    [AppPermission.READ_OWN_PAYSLIP]: [
      { resource: 'payroll', action: PermissionAction.VIEW },
    ],
    [AppPermission.MANAGE_PAYROLL_SETTINGS]: [
      { resource: 'payroll', action: PermissionAction.EDIT },
    ],
    [AppPermission.CONFIGURE_APPRAISAL]: [
      { resource: 'appraisals', action: PermissionAction.CREATE },
    ],
    [AppPermission.CREATE_APPRAISAL]: [
      { resource: 'appraisals', action: PermissionAction.CREATE },
    ],
    [AppPermission.READ_APPRAISALS]: [
      { resource: 'appraisals', action: PermissionAction.VIEW },
    ],
    [AppPermission.SUBMIT_SELF_ASSESSMENT]: [
      { resource: 'appraisals', action: PermissionAction.EDIT },
    ],
    [AppPermission.SUBMIT_MANAGER_REVIEW]: [
      { resource: 'appraisals', action: PermissionAction.EDIT },
    ],
    [AppPermission.READ_OWN_REVIEW]: [
      { resource: 'appraisals', action: PermissionAction.VIEW },
    ],
    [AppPermission.CREATE_PROJECT]: [
      { resource: 'projects', action: PermissionAction.CREATE },
    ],
    [AppPermission.READ_PROJECTS]: [
      { resource: 'projects', action: PermissionAction.VIEW },
    ],
    [AppPermission.UPDATE_PROJECT]: [
      { resource: 'projects', action: PermissionAction.EDIT },
    ],
    [AppPermission.ASSIGN_PROJECT]: [
      { resource: 'projects', action: PermissionAction.ASSIGN },
    ],
    [AppPermission.MANAGE_ASSETS]: [
      { resource: 'assets', action: PermissionAction.CREATE },
      { resource: 'assets', action: PermissionAction.EDIT },
    ],
    [AppPermission.READ_ASSETS]: [
      { resource: 'assets', action: PermissionAction.VIEW },
    ],
    [AppPermission.ASSIGN_ASSET]: [
      { resource: 'assets', action: PermissionAction.ASSIGN },
    ],
    [AppPermission.MANAGE_LEADS]: [
      { resource: 'leads', action: PermissionAction.CREATE },
      { resource: 'leads', action: PermissionAction.EDIT },
    ],
    [AppPermission.READ_LEADS]: [
      { resource: 'leads', action: PermissionAction.VIEW },
    ],
    [AppPermission.MANAGE_CAMPAIGNS]: [
      { resource: 'campaigns', action: PermissionAction.CREATE },
      { resource: 'campaigns', action: PermissionAction.EDIT },
    ],
    [AppPermission.READ_CAMPAIGNS]: [
      { resource: 'campaigns', action: PermissionAction.VIEW },
    ],
    [AppPermission.VIEW_ANALYTICS]: [
      { resource: 'analytics', action: PermissionAction.VIEW },
    ],
  };

const SYSTEM_PERMISSION_SETS = [
  { name: 'Company Admin Set', roleName: 'Company Admin', isSystem: true },
  { name: 'Employee Set', roleName: 'Employee', isSystem: true },
] as const;

@Injectable()
export class TenantLifecycleService {
  private readonly logger = new Logger(TenantLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly audit: AuditService,
  ) {}

  async register(dto: CreateTenantDto) {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (!superAdminEmail) throw new Error('SUPER_ADMIN_EMAIL is required');
    if (dto.email.toLowerCase() === superAdminEmail.toLowerCase()) {
      throw new ForbiddenException(
        'This email address cannot be used to register a company',
      );
    }

    const existingTenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ email: dto.email }, { slug: dto.slug }] },
    });
    if (existingTenant) {
      throw new ConflictException(
        existingTenant.email === dto.email
          ? 'A company with this email already exists'
          : 'This company slug is already taken',
      );
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        email: dto.email,
        phone: dto.phone,
        country: dto.country || 'GH',
        industry: dto.industry,
        size: dto.size,
        status: 'PENDING',
      },
    });

    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: dto.email,
        password: '',
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: 'TENANT_ADMIN',
        status: 'PENDING_VERIFICATION',
        forcePasswordReset: true,
        inviteToken,
        inviteExpiresAt,
      },
    });

    // Seed system permission sets and assign Company Admin Set to the admin
    const permSets = await this.seedPermissionSetsForTenant(tenant.id);
    if (permSets['Company Admin Set']) {
      await this.prisma.userPermissionSet.create({
        data: {
          userId: user.id,
          permissionSetId: permSets['Company Admin Set'],
          grantedBy: user.id,
        },
      });
    }

    const acceptInviteUrl = WorkspaceUrl.acceptInvite(tenant.slug, inviteToken);

    void this.rabbitmq
      .notificationInviteUser({
        email: user.email,
        firstName: user.firstName,
        tenantName: tenant.name,
        acceptInviteUrl,
        inviteKind: 'TENANT_ADMIN',
      })
      .catch((err) =>
        this.logger.error(`Failed to emit invite for ${user.email}`, err),
      );

    await this.audit.log({
      tenantId: tenant.id,
      action: 'CREATE',
      resource: 'tenants',
      resourceId: tenant.id,
      changes: {
        after: { name: tenant.name, slug: tenant.slug, status: 'PENDING' },
      },
      status: 'SUCCESS',
    });

    return {
      message: 'Company registered. Invite email sent to tenant admin.',
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      workspaceUrl: WorkspaceUrl.login(tenant.slug),
      userId: user.id,
    };
  }

  async findAll(filters: {
    status?: string;
    search?: string;
    tenantId?: string;
  }) {
    const where: any = { slug: { not: 'datrix-internal' } };

    if (filters.tenantId) where.id = filters.tenantId;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const tenants = await this.prisma.tenant.findMany({
      where,
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      total: tenants.length,
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        email: t.email,
        phone: t.phone,
        country: t.country,
        industry: t.industry,
        size: t.size,
        status: t.status,
        userCount: t._count.users,
        createdAt: t.createdAt,
      })),
    };
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async approveTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const tenantAdmin = await this.prisma.user.findFirst({
      where: { tenantId: id, role: 'TENANT_ADMIN' },
      select: { id: true },
    });

    await this.rabbitmq.hrProvisionTenantWorkspace({
      tenantId: id,
      adminEmail: tenant.email,
      adminUserId: tenantAdmin?.id,
    });

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await this.prisma.user.updateMany({
      where: { tenantId: id, role: 'TENANT_ADMIN' },
      data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
    });

    await this.audit.log({
      tenantId: id,
      action: 'APPROVE',
      resource: 'tenants',
      resourceId: id,
      changes: {
        before: { status: tenant.status },
        after: { status: 'ACTIVE' },
      },
      status: 'SUCCESS',
    });

    return { message: 'Tenant approved successfully', tenant: updated };
  }

  async updateTenant(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.size !== undefined && { size: dto.size }),
        ...(dto.industry !== undefined && { industry: dto.industry }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
    });

    await this.audit.log({
      tenantId: id,
      action: 'UPDATE',
      resource: 'tenants',
      resourceId: id,
      changes: { before: { name: tenant.name }, after: { name: updated.name } },
      status: 'SUCCESS',
    });

    return { message: 'Tenant updated successfully', tenant: updated };
  }

  async suspendTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    await this.revokeAllSessions(id);

    return {
      message: 'Tenant suspended. All active sessions revoked.',
      tenant: updated,
    };
  }

  async deactivateTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    await this.revokeAllSessions(id);

    return {
      message: 'Tenant deactivated. All active sessions revoked.',
      tenant: updated,
    };
  }

  async deleteTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.prisma.tenant.delete({ where: { id } });

    return { message: 'Company deleted successfully' };
  }

  async getTenantUsers(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.user.findMany({
      where: { tenantId: id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  async getTenantAuditLogs(
    id: string,
    filters: { page?: number; limit?: number },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.audit.query(id, filters);
  }

  // ── Permission Set Seeding ──────────────────────────────────────────────────
  // Creates the built-in system permission sets (Company Admin Set and
  // Employee Set) for a newly registered tenant. Idempotent — skips any set
  // that already exists. Returns a map of set names → set IDs.

  async seedPermissionSetsForTenant(
    tenantId: string,
  ): Promise<Record<string, string>> {
    // Fetch all platform resources → build name:id map
    const allResources = await this.prisma.resource.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
    const resourceMap: Record<string, string> = {};
    for (const r of allResources) {
      resourceMap[r.name] = r.id;
    }

    const createdSets: Record<string, string> = {};

    for (const set of SYSTEM_PERMISSION_SETS) {
      // Skip if already exists for this tenant
      const existing = await this.prisma.permissionSet.findUnique({
        where: { tenantId_name: { tenantId, name: set.name } },
      });
      if (existing) {
        createdSets[set.name] = existing.id;
        continue;
      }

      const rolePermissions = COMPANY_ROLE_PERMISSIONS[set.roleName] ?? [];
      const roleResourceActions =
        this.resolveResourceActionsForPermissions(rolePermissions);

      const setResources: { resourceId: string; action: PermissionAction }[] =
        [];
      for (const pair of roleResourceActions) {
        const resourceId = resourceMap[pair.resource];
        if (!resourceId) {
          throw new Error(
            `Resource '${pair.resource}' is not seeded but is required by ${set.roleName}`,
          );
        }
        setResources.push({ resourceId, action: pair.action });
      }

      const created = await this.prisma.permissionSet.create({
        data: {
          tenantId,
          name: set.name,
          isSystem: set.isSystem,
          resources: { create: setResources },
        },
      });
      createdSets[set.name] = created.id;
    }

    this.logger.log(
      `Permission sets seeded for tenant ${tenantId}: ${Object.keys(createdSets).join(', ')}`,
    );

    return createdSets;
  }

  private resolveResourceActionsForPermissions(
    permissions: AppPermission[],
  ): ResourceAction[] {
    const seen = new Set<string>();
    const pairs: ResourceAction[] = [];

    for (const permission of permissions) {
      const mapped = PERMISSION_TO_RESOURCE_ACTIONS[permission];
      if (!mapped || mapped.length === 0) {
        throw new Error(`Missing permission mapping for ${permission}`);
      }

      for (const pair of mapped) {
        const key = `${pair.resource}:${pair.action}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push(pair);
      }
    }

    return pairs;
  }

  private async revokeAllSessions(tenantId: string) {
    const users = await this.prisma.user.findMany({ where: { tenantId } });
    for (const user of users) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });
    }
  }
}
