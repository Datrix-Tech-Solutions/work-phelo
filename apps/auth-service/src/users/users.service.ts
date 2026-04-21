import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
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

    // One Company Admin per tenant
    if (dto.role === UserSystemRole.TENANT_ADMIN || !dto.role) {
      const existingAdmin = await this.prisma.user.findFirst({
        where: { tenantId, role: 'TENANT_ADMIN' },
      });
      // Demote existing admin to EMPLOYEE before assigning new one
      if (existingAdmin) {
        await this.prisma.user.update({
          where: { id: existingAdmin.id },
          data: { role: 'EMPLOYEE' },
        });
      }
    }

    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const userRole = ((dto.role as any) || 'EMPLOYEE') as string;

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: userRole as any,
        status: 'PENDING_VERIFICATION',
        forcePasswordReset: true,
        inviteToken,
        inviteExpiresAt,
      },
    });

    // Auto-assign the matching system permission set for the user's role
    const setName =
      userRole === 'TENANT_ADMIN' ? 'Company Admin Set' : 'Employee Set';
    const defaultSet = await this.prisma.permissionSet.findFirst({
      where: { tenantId, name: setName, isSystem: true },
    });
    if (!defaultSet) {
      throw new NotFoundException(
        `Required default permission set \"${setName}\" not found for this tenant`,
      );
    }

    await this.prisma.userPermissionSet.create({
      data: {
        userId: user.id,
        permissionSetId: defaultSet.id,
        grantedBy: user.id,
      },
    });

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

      // Seed default leave types for the newly activated tenant.
      // hr.tenant_approved is only emitted from approveTenant() (a separate
      // super-admin action that is not part of the normal invite flow), so we
      // emit it here to guarantee seeding regardless of whether the super admin
      // calls that endpoint.
      void this.rabbitmq
        .hrTenantApproved({
          tenantId: updated.tenantId,
          adminEmail: updated.tenant.email,
        })
        .catch((err) =>
          this.logger.error(
            `Failed to emit hr.tenant_approved for ${updated.tenantId}`,
            err,
          ),
        );
    }

    // Link the auth userId back to the HR employee record
    void this.rabbitmq
      .hrEmployeeActivated({
        tenantId: updated.tenantId,
        email: updated.email,
        userId: updated.id,
      })
      .catch((err) =>
        this.logger.error(
          `Failed to emit hr.employee_activated for ${updated.email}`,
          err,
        ),
      );

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
        companyRoleId: true,
        companyRole: { select: { id: true, name: true, description: true } },
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
