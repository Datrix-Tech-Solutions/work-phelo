import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { generateOtp, otpExpiresAt } from '../common/otp.helper';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  async register(dto: CreateTenantDto) {
    const existingTenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ email: dto.email }, { slug: dto.slug }] },
    });

    if (existingTenant) {
      if (existingTenant.email === dto.email) {
        throw new ConflictException('A company with this email already exists');
      }
      throw new ConflictException('This company slug is already taken');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        email: dto.email,
        phone: dto.phone,
        industry: dto.industry,
        size: dto.size,
        status: 'PENDING',
        users: {
          create: {
            email: dto.email,
            password: hashedPassword,
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            role: 'TENANT_ADMIN',
            status: 'PENDING_VERIFICATION',
          },
        },
      },
      include: { users: true },
    });

    const adminUser = tenant.users[0];

    // Generate and store email verification OTP
    const otp = generateOtp(6);
    await this.prisma.otpCode.create({
      data: {
        userId: adminUser.id,
        type: 'EMAIL_VERIFICATION',
        code: otp,
        expiresAt: otpExpiresAt(10),
      },
    });

    // Publish to notification-service via RabbitMQ
    this.rabbitmq.sendEmailVerification({
      userId: adminUser.id,
      tenantId: tenant.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      otp,
    });

    const { password, mfaSecret, inviteToken, ...safeUser } = adminUser;
    const { users, ...tenantData } = tenant;

    return {
      tenant: tenantData,
      adminUser: safeUser,
      message:
        'Registration successful. Please check your email to verify your account.',
    };
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async approveTenant(id: string) {
    await this.findById(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async suspendTenant(id: string) {
    await this.findById(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
  }
}
