import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { generateSecureToken } from '../common/otp.helper';
import { WorkspaceUrl } from '../common/workspace-url.helper';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly audit: AuditService,
  ) {}

  async register(dto: CreateTenantDto) {
    // Block superadmin email from being used as company admin
    const superAdminEmail =
      process.env.SUPER_ADMIN_EMAIL || 'superadmin@datrix.com';
    if (dto.email.toLowerCase() === superAdminEmail.toLowerCase()) {
      throw new ForbiddenException(
        'This email address cannot be used to register a company',
      );
    }

    const existingTenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ email: dto.email }, { slug: dto.slug }],
      },
    });
    if (existingTenant) {
      throw new ConflictException(
        existingTenant.email === dto.email
          ? 'A company with this email already exists'
          : 'This company slug is already taken',
      );
    }

    // SuperAdmin creates tenant — immediately ACTIVE, no approval needed
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

    // Generate invite token — tenant admin sets their own password on first login
    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

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

    const acceptInviteUrl = WorkspaceUrl.acceptInvite(tenant.slug, inviteToken);

    // Send invite email with workspace details
    await this.rabbitmq.emit('notification.invite_user', {
      email: user.email,
      firstName: user.firstName,
      tenantName: tenant.name,
      acceptInviteUrl,
    });

    await this.audit.log({
      tenantId: tenant.id,
      action: 'CREATE',
      resource: 'tenants',
      resourceId: tenant.id,
      changes: {
        after: { name: tenant.name, slug: tenant.slug, status: 'ACTIVE' },
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
    const where: any = {};

    // Always exclude the internal Datrix platform tenant
    where.slug = { not: 'datrix-internal' };

    if (filters.tenantId) {
      where.id = filters.tenantId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const tenants = await this.prisma.tenant.findMany({
      where,
      include: {
        _count: { select: { users: true } },
      },
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

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    // Activate admin user
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

  async suspendTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    // Revoke all active sessions
    const users = await this.prisma.user.findMany({ where: { tenantId: id } });
    for (const user of users) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });
    }

    return {
      message: 'Tenant suspended. All active sessions revoked.',
      tenant: updated,
    };
  }

  async updateModules(
    tenantId: string,
    modules: Record<string, boolean>,
    actorId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const currentConfig =
      (tenant.moduleConfig as Record<string, boolean>) ?? {};

    // Build audit log entries for changed modules
    const changes: string[] = [];
    for (const [module, enabled] of Object.entries(modules)) {
      if (currentConfig[module] !== enabled) {
        changes.push(
          `${module}: ${currentConfig[module] ? 'enabled' : 'disabled'} → ${enabled ? 'enabled' : 'disabled'}`,
        );
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { moduleConfig: { ...currentConfig, ...modules } },
    });

    // Audit log
    if (changes.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          tenantId,
          action: 'UPDATE',
          resource: 'Tenant',
          resourceId: tenantId,
          changes: {
            modules: changes,
            updatedConfig: updated.moduleConfig,
          },
        },
      });
    }

    return {
      message: 'Module configuration updated successfully',
      moduleConfig: updated.moduleConfig,
    };
  }

  async updateFeatures(
    tenantId: string,
    module: string,
    features: Record<string, boolean>,
    actorId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const moduleConfig = (tenant.moduleConfig as Record<string, boolean>) ?? {};
    if (!moduleConfig[module]) {
      throw new BadRequestException(
        `The ${module} module is not enabled for this company.`,
      );
    }

    const currentFeatures =
      (tenant.featureConfig as Record<string, Record<string, boolean>>) ?? {};
    const currentModuleFeatures = currentFeatures[module] ?? {};

    // Validate at least one feature enabled
    const merged = { ...currentModuleFeatures, ...features };
    const enabledCount = Object.values(merged).filter(Boolean).length;
    if (enabledCount === 0) {
      throw new BadRequestException(
        `At least one feature must be enabled within the ${module} module.`,
      );
    }

    const updatedFeatureConfig = {
      ...currentFeatures,
      [module]: merged,
    };

    // Build audit log changes
    const changes: string[] = [];
    for (const [feature, enabled] of Object.entries(features)) {
      if (currentModuleFeatures[feature] !== enabled) {
        changes.push(
          `${module}.${feature}: ${currentModuleFeatures[feature] ? 'enabled' : 'disabled'} → ${enabled ? 'enabled' : 'disabled'}`,
        );
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { featureConfig: updatedFeatureConfig },
    });

    if (changes.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          tenantId,
          action: 'UPDATE',
          resource: 'Tenant',
          resourceId: tenantId,
          changes: {
            type: 'FEATURE_CONFIG_UPDATED',
            module,
            changes,
            updatedConfig: updatedFeatureConfig,
          },
        },
      });
    }

    return {
      message: 'Feature configuration updated successfully',
      featureConfig: updated.featureConfig,
    };
  }

  async getFeatureHistory(tenantId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        action: 'UPDATE',
        resource: 'Tenant',
        resourceId: tenantId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      history: logs
        .filter((l) => {
          const changes = l.changes as any;
          return changes?.type === 'FEATURE_CONFIG_UPDATED';
        })
        .map((l) => ({
          id: l.id,
          actorId: l.userId,
          changes: (l.changes as any)?.changes ?? [],
          module: (l.changes as any)?.module,
          timestamp: l.createdAt,
        })),
    };
  }
  async resendAdminInvite(tenantId: string) {
    const admin = await this.prisma.user.findFirst({
      where: { tenantId, role: 'TENANT_ADMIN', status: 'PENDING_VERIFICATION' },
      include: { tenant: true },
    });
    if (!admin) {
      throw new NotFoundException(
        'No pending Company Admin found for this company.',
      );
    }
    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: admin.id },
      data: { inviteToken, inviteExpiresAt },
    });
    await this.rabbitmq.sendInviteEmail({
      userId: admin.id,
      tenantId,
      email: admin.email,
      firstName: admin.firstName,
      inviteToken,
      tenantName: admin.tenant.name,
    });
    return { message: 'Invitation resent successfully' };
  }
}
