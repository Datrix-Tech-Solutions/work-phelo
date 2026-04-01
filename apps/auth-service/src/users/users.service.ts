import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AcceptInviteDto } from '../auth/dto/accept-invite.dto';
import { generateSecureToken } from '../common/otp.helper';
import * as bcrypt from 'bcrypt';
import { WorkspaceUrl } from '../common/workspace-url.helper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  async invite(tenantId: string, dto: InviteUserDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Block superadmin email from being invited as company user
    const superAdminEmail =
      process.env.SUPER_ADMIN_EMAIL || 'superadmin@datrix.com';
    if (dto.email.toLowerCase() === superAdminEmail.toLowerCase()) {
      throw new ForbiddenException(
        'This email address cannot be assigned as a company user',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (existing)
      throw new ConflictException('User with this email already exists');

    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: (dto.role as any) || 'EMPLOYEE',
        status: 'PENDING_VERIFICATION',
        forcePasswordReset: true,
        inviteToken,
        inviteExpiresAt,
      },
    });

    this.rabbitmq.sendInviteEmail({
      userId: user.id,
      tenantId,
      email: user.email,
      firstName: user.firstName,
      inviteToken,
      tenantName: tenant.name,
    });

    const { password, mfaSecret, inviteToken: token, ...safeUser } = user;
    return { user: safeUser, message: 'Invitation sent successfully' };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const user = await this.prisma.user.findUnique({
      where: { inviteToken: dto.inviteToken },
      include: { tenant: true },
    });

    if (!user) throw new NotFoundException('Invalid invite link');
    if (!user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      throw new ForbiddenException(
        'Invite link has expired. Please contact your administrator.',
      );
    }

    const hashed = await bcrypt.hash(dto.password, 12);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        forcePasswordReset: false,
        inviteToken: null,
        inviteExpiresAt: null,
      },
      include: { tenant: true },
    });

    return {
      message: 'Account setup complete. You can now log in.',
      userId: updated.id,
      tenantSlug: updated.tenant.slug,
    };
  }

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        isMfaEnabled: true,
        mfaMethod: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        forcePasswordReset: true,
      },
    });
  }

  async findById(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        isMfaEnabled: true,
        mfaMethod: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        forcePasswordReset: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    await this.findById(tenantId, id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        isMfaEnabled: true,
        updatedAt: true,
      },
    });
  }

  async deactivate(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true },
    });
    return this.prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async forcePasswordReset(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    return this.prisma.user.update({
      where: { id },
      data: { forcePasswordReset: true },
    });
  }
}
