import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly audit: AuditService,
  ) {}

  async register(dto: CreateTenantDto) {
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

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: 'TENANT_ADMIN',
        status: 'PENDING_VERIFICATION',
      },
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await this.rabbitmq.emit('notification.email_verification', {
      email: user.email,
      firstName: user.firstName,
      otp: code,
      tenantName: tenant.name,
    });

    return {
      message:
        'Registration submitted. Check your email for verification code.',
      tenantId: tenant.id,
      userId: user.id,
    };
  }

  async findAll(filters: {
    status?: string;
    search?: string;
    tenantId?: string;
  }) {
    const where: any = {};
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
}
