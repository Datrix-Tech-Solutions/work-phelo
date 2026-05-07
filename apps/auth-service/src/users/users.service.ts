import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { JwtService } from '@nestjs/jwt';
import { InviteUserDto, UserSystemRole } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AcceptInviteDto } from '../auth/dto/accept-invite.dto';
import { generateSecureToken } from '../common/otp.helper';
import * as bcrypt from 'bcrypt';
import { WorkspaceUrl } from '../common/workspace-url.helper';
import { AuditService } from '../audit/audit.service';
import { syncUserSystemPermissionSet } from '../permissions/system-permission-sets';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

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
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (!superAdminEmail) throw new Error('SUPER_ADMIN_EMAIL is required');
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

    const userRole = dto.role ?? UserSystemRole.EMPLOYEE;

    // One Company Admin per tenant. Admin reassignment must go through the
    // dedicated tenant-admin flow so we do not silently demote the current admin.
    if (userRole === UserSystemRole.TENANT_ADMIN) {
      const existingAdmin = await this.prisma.user.findFirst({
        where: { tenantId, role: 'TENANT_ADMIN' },
        select: { id: true },
      });

      if (existingAdmin) {
        throw new ConflictException(
          'This company already has an administrator. Use the tenant admin update flow instead.',
        );
      }
    }

    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: userRole,
        status: 'PENDING_VERIFICATION',
        forcePasswordReset: true,
        inviteToken,
        inviteExpiresAt,
      },
    });

    await syncUserSystemPermissionSet(
      this.prisma,
      {
        tenantId,
        userId: user.id,
        role: userRole,
        grantedBy: user.id,
      },
      this.logger,
    );

    const acceptInviteUrl = WorkspaceUrl.acceptInvite(tenant.slug, inviteToken);

    void this.rabbitmq
      .notificationInviteUser({
        userId: user.id,
        tenantId,
        email: user.email,
        firstName: user.firstName,
        inviteToken,
        acceptInviteUrl,
        tenantName: tenant.name,
        inviteKind:
          userRole === UserSystemRole.TENANT_ADMIN
            ? 'TENANT_ADMIN'
            : 'EMPLOYEE',
      })
      .catch((err) =>
        this.logger.error(`Failed to send invite for ${user.email}`, err),
      );

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

  async provisionEmployeeInvite(
    tenantId: string,
    dto: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
    },
  ) {
    const result = await this.invite(tenantId, {
      ...dto,
      role: UserSystemRole.EMPLOYEE,
    });

    return {
      userId: result.user.id,
      email: result.user.email,
      inviteSent: true,
    };
  }

  async deletePendingEmployeeInvite(
    tenantId: string,
    dto: { userId?: string; email: string },
  ) {
    const user = dto.userId
      ? await this.prisma.user.findFirst({
          where: { id: dto.userId, tenantId },
        })
      : await this.prisma.user.findUnique({
          where: { tenantId_email: { tenantId, email: dto.email } },
        });

    if (!user) {
      return { deleted: false };
    }

    if (user.role !== 'EMPLOYEE') {
      throw new BadRequestException(
        'Only pending employee invites can be rolled back.',
      );
    }

    if (user.status !== 'PENDING_VERIFICATION' || !user.inviteToken) {
      throw new BadRequestException(
        'The employee invite can no longer be rolled back.',
      );
    }

    await this.prisma.user.delete({ where: { id: user.id } });
    return { deleted: true };
  }

  async getUserStatuses(tenantId: string, userIds: string[]) {
    if (userIds.length === 0) {
      return [];
    }

    const uniqueUserIds = Array.from(new Set(userIds));
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: uniqueUserIds } },
      select: { id: true, status: true },
    });

    return users.map((user) => ({ userId: user.id, status: user.status }));
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const user = await this.prisma.user.findUnique({
      where: { inviteToken: dto.inviteToken },
      include: { tenant: true },
    });

    if (!user) {
      throw new ForbiddenException(
        'This link has already been used. Please log in or reset your password.',
      );
    }

    if (!user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      throw new ForbiddenException(
        'This invitation has expired. Please contact your platform administrator to resend the invitation.',
      );
    }

    if (user.role === 'TENANT_ADMIN') {
      await this.rabbitmq.hrProvisionTenantWorkspace({
        tenantId: user.tenantId,
        adminEmail: user.tenant.email,
        adminUserId: user.id,
      });
    } else {
      await this.rabbitmq.hrLinkEmployeeIdentity({
        tenantId: user.tenantId,
        email: user.email,
        userId: user.id,
      });
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

    // Activate tenant when Company Admin accepts invite
    if (updated.role === 'TENANT_ADMIN') {
      await this.prisma.tenant.update({
        where: { id: updated.tenantId },
        data: { status: 'ACTIVE' },
      });
    }

    const permissions = await this.resolveEffectivePermissions(
      updated.id,
      updated.tenantId,
      updated.role,
    );

    // Auto-login — issue tokens so frontend redirects straight to dashboard
    const payload = {
      sub: updated.id,
      email: updated.email,
      role: updated.role,
      tenantId: updated.tenantId,
      tenantSlug: updated.tenant.slug,
      tenantName: updated.tenant.name,
      firstName: updated.firstName,
      permissions,
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

  private async resolveEffectivePermissions(
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<string[]> {
    if (role !== 'EMPLOYEE') return [];

    const [allDirectPerms, setAssignments] = await Promise.all([
      this.prisma.userPermission.findMany({
        where: { tenantId, userId },
        include: { resource: true },
      }),
      this.prisma.userPermissionSet.findMany({
        where: { userId },
        include: {
          permissionSet: {
            include: { resources: { include: { resource: true } } },
          },
        },
      }),
    ]);

    const direct = allDirectPerms
      .filter((p) => p.isActive && (!p.expiresAt || p.expiresAt > new Date()))
      .map((p) => `${p.resource.name}:${p.action}`);

    const explicitlyRevoked = new Set(
      allDirectPerms
        .filter((p) => !p.isActive)
        .map((p) => `${p.resource.name}:${p.action}`),
    );

    const fromSets = setAssignments.flatMap((a) =>
      a.permissionSet.resources.map((r) => `${r.resource.name}:${r.action}`),
    );

    return [...new Set([...direct, ...fromSets])].filter(
      (perm) => !explicitlyRevoked.has(perm),
    );
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

    void this.rabbitmq
      .notificationInviteUser({
        email: user.email,
        firstName: user.firstName,
        tenantName: user.tenant.name,
        acceptInviteUrl,
        inviteKind: user.role === 'TENANT_ADMIN' ? 'TENANT_ADMIN' : 'EMPLOYEE',
      })
      .catch((err) =>
        this.logger.error(`Failed to resend invite for ${user.email}`, err),
      );

    return { message: 'Invitation resent successfully' };
  }

  async findByEmail(tenantId: string, email: string) {
    return this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
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
