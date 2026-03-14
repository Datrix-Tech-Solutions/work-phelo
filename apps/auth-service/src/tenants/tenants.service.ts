import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const { users, ...tenantData } = tenant;
    const { password, mfaSecret, ...adminUser } = users[0];

    return {
      tenant: tenantData,
      adminUser,
      message:
        'Registration successful. Your account is pending approval by our team.',
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
    const tenant = await this.findById(id);
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
