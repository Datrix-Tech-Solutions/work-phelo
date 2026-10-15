import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma, TenantStatus } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { generateSecureToken } from '../common/otp.helper';
import { normalizeEmail } from '../common/email.helper';
import { WorkspaceUrl } from '../common/workspace-url.helper';
import {
  ensurePermissionResources,
  seedDefaultPermissionTemplates,
} from '../permissions/system-permission-sets';
import { RESOURCES } from '../permissions/resource-definitions';

const RESERVED_WORKSPACE_SLUGS = new Set([
  'api',
  'auth',
  'dashboard',
  'forgot-password',
  'health',
  'login',
  'platform',
  'register',
  'signup',
  'super-admin',
  'admin',
  'system',
  'support',
  'www',
]);

const REGISTRATION_CONFLICT_MESSAGE =
  'Company registration details are unavailable';

@Injectable()
export class TenantLifecycleService {
  private readonly logger = new Logger(TenantLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly audit: AuditService,
  ) {}

  async register(dto: CreateTenantDto, isPlatformAdmin = false) {
    const normalizedEmail = normalizeEmail(dto.email);
    const slug = dto.slug.trim().toLowerCase();
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      slug.length < 2 ||
      slug.length > 50
    ) {
      throw new BadRequestException('Invalid workspace slug');
    }
    if (RESERVED_WORKSPACE_SLUGS.has(slug)) {
      throw new BadRequestException('This workspace slug is reserved');
    }
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (!superAdminEmail) throw new Error('SUPER_ADMIN_EMAIL is required');
    if (normalizedEmail === normalizeEmail(superAdminEmail)) {
      throw new ConflictException(REGISTRATION_CONFLICT_MESSAGE);
    }

    const existingTenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ email: normalizedEmail }, { slug }] },
    });
    if (existingTenant) {
      throw new ConflictException(REGISTRATION_CONFLICT_MESSAGE);
    }
    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    // Global resources are idempotent and tenant-independent. Keep the tenant,
    // templates, and first admin together in one transaction.
    const existingResources = await this.prisma.resource.findMany({
      where: { name: { in: RESOURCES.map((resource) => resource.name) } },
      select: { id: true, name: true },
    });
    const resourceIds =
      existingResources.length === RESOURCES.length
        ? Object.fromEntries(
            existingResources.map((resource) => [resource.name, resource.id]),
          )
        : await ensurePermissionResources(this.prisma);
    let tenant: Awaited<ReturnType<typeof this.prisma.tenant.create>>;
    let user: Awaited<ReturnType<typeof this.prisma.user.create>>;
    try {
      ({ tenant, user } = await this.prisma.$transaction(
        async (tx) => {
          const tenant = await tx.tenant.create({
            data: {
              name: dto.name,
              slug,
              email: normalizedEmail,
              phone: dto.phone,
              address: dto.address,
              country: dto.country || 'GH',
              currency: dto.currency || 'GHS',
              industry: dto.industry,
              size: dto.size,
              status: 'PENDING',
              selfRegistered: !isPlatformAdmin,
            },
          });
          await seedDefaultPermissionTemplates(
            tx,
            tenant.id,
            this.logger,
            resourceIds,
          );
          const user = await tx.user.create({
            data: {
              tenantId: tenant.id,
              email: normalizedEmail,
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
          return { tenant, user };
        },
        { timeout: 30_000 },
      ));
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(REGISTRATION_CONFLICT_MESSAGE);
      }
      throw error;
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
        this.logger.error('Failed to emit tenant admin invite', err),
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

    if (!isPlatformAdmin) {
      return {
        status: 'PENDING_VERIFICATION',
        message: 'Registration received. Check your email to continue setup.',
      };
    }

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
    const where: Prisma.TenantWhereInput = {
      slug: { not: 'datrix-internal' },
      ...(filters.tenantId ? { id: filters.tenantId } : {}),
      ...(filters.status ? { status: filters.status as TenantStatus } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
              { slug: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

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
        address: t.address,
        country: t.country,
        currency: t.currency,
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
      select: {
        id: true,
        status: true,
        emailVerifiedAt: true,
        password: true,
        inviteToken: true,
      },
    });

    if (
      tenant.selfRegistered &&
      (!tenantAdmin?.emailVerifiedAt ||
        tenantAdmin.status !== 'ACTIVE' ||
        !tenantAdmin.password ||
        tenantAdmin.inviteToken !== null)
    ) {
      throw new ConflictException(
        'Tenant admin must accept the email invitation before activation',
      );
    }

    await this.rabbitmq.hrProvisionTenantWorkspace({
      tenantId: id,
      adminEmail: tenant.email,
      adminUserId: tenantAdmin?.id,
      country: tenant.country,
      currency: tenant.currency,
    });

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    if (!tenant.selfRegistered) {
      await this.prisma.user.updateMany({
        where: { tenantId: id, role: 'TENANT_ADMIN' },
        data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
      });
    }

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
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
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
