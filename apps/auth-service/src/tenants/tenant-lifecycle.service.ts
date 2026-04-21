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

    const acceptInviteUrl = WorkspaceUrl.acceptInvite(tenant.slug, inviteToken);

    void this.rabbitmq
      .notificationInviteUser({
        email: user.email,
        firstName: user.firstName,
        tenantName: tenant.name,
        acceptInviteUrl,
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

    void this.rabbitmq
      .hrTenantApproved({ tenantId: id, adminEmail: updated.email })
      .catch((err) =>
        this.logger.error(`Failed to emit hr.tenant_approved for ${id}`, err),
      );

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
