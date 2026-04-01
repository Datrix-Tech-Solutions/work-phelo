import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { JwtService } from '@nestjs/jwt';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AcceptInviteDto } from '../auth/dto/accept-invite.dto';
import { generateSecureToken } from '../common/otp.helper';
import * as bcrypt from 'bcrypt';
import { WorkspaceUrl } from '../common/workspace-url.helper';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  async invite(tenantId: string, dto: InviteUserDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Block superadmin email
    const superAdminEmail =
      process.env.SUPER_ADMIN_EMAIL || 'superadmin@datrix.com';
    if (dto.email.toLowerCase() === superAdminEmail.toLowerCase()) {
      throw new ForbiddenException(
        'This email is reserved for the platform owner.',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (existing)
      throw new ConflictException('A user with this email already exists.');

    // One Company Admin per tenant
    if (dto.role === 'TENANT_ADMIN' || !dto.role) {
      const existingAdmin = await this.prisma.user.findFirst({
        where: { tenantId, role: 'TENANT_ADMIN' },
      });
      if (existingAdmin) {
        throw new ConflictException(
          'This company already has a Company Admin assigned.',
        );
      }
    }

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

    await this.audit.log({
      tenantId,
      action: 'CREATE',
      resource: 'users',
      resourceId: user.id,
      changes: {
        after: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: 'PENDING_VERIFICATION',
        },
      },
      status: 'SUCCESS',
    });

    const { password, mfaSecret, inviteToken: token, ...safeUser } = user;
    return { user: safeUser, message: 'Invitation sent successfully' };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const user = await this.prisma.user.findUnique({
      where: { inviteToken: dto.inviteToken },
      include: { tenant: true },
    });

    if (!user) {
      throw new ForbiddenException(
        'This link has already been used. Please log in or request a password reset.',
      );
    }

    if (!user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      throw new ForbiddenException(
        'This invitation has expired. Please contact your platform administrator to resend the invitation.',
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
        lastLoginAt: new Date(),
      },
      include: { tenant: true },
    });

    // Auto-login — issue tokens so frontend redirects straight to dashboard
    const payload = {
      sub: updated.id,
      email: updated.email,
      role: updated.role,
      tenantId: updated.tenantId,
      tenantSlug: updated.tenant.slug,
      tenantName: updated.tenant.name,
      firstName: updated.firstName,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: updated.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: updated.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role,
        tenantId: updated.tenantId,
        tenantSlug: updated.tenant.slug,
        tenantName: updated.tenant.name,
      },
    };
  }

  async resendInvite(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { tenant: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === 'ACTIVE' && !user.inviteToken) {
      throw new ForbiddenException('User has already accepted the invitation.');
    }

    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { inviteToken, inviteExpiresAt },
    });

    const acceptInviteUrl = WorkspaceUrl.acceptInvite(
      user.tenant.slug,
      inviteToken,
    );

    await this.rabbitmq.emit('notification.invite_user', {
      email: user.email,
      firstName: user.firstName,
      tenantName: user.tenant.name,
      acceptInviteUrl,
    });

    return { message: 'Invitation resent successfully' };
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
    const existing = await this.findById(tenantId, id);
    if (existing.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'The super admin account cannot be modified.',
      );
    }
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
    const existing = await this.findById(tenantId, id);
    if (existing.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'The super admin account cannot be deactivated.',
      );
    }
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
    const existing = await this.findById(tenantId, id);
    if (existing.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'The super admin account cannot be modified.',
      );
    }
    return this.prisma.user.update({
      where: { id },
      data: { forcePasswordReset: true },
    });
  }
}
