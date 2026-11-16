import { BASIC_EMPLOYEE_TEMPLATE_NAME } from '../permissions/system-permission-sets';
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
import { UpdateUserDto, UserStatus } from './dto/update-user.dto';
import { AcceptInviteDto } from '../auth/dto/accept-invite.dto';
import { generateSecureToken } from '../common/otp.helper';
import * as bcrypt from 'bcrypt';
import { WorkspaceUrl } from '../common/workspace-url.helper';
import { AuditService } from '../audit/audit.service';
import { syncUserSystemPermissionSet } from '../permissions/system-permission-sets';
import { normalizeEmail } from '../common/email.helper';
import { TenantAssetStorageService } from '../tenants/tenant-asset-storage.service';
import { UploadUserDocumentDto } from './dto/upload-user-document.dto';
import { RequestUser } from '@work-phelo/types';

const AVATAR_ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const DOCUMENT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;

type InviteTiming = {
  label: string;
  ms: number;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
    private readonly storage: TenantAssetStorageService,
  ) {}

  private async timeInviteStage<T>(
    timings: InviteTiming[] | undefined,
    label: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      return await operation();
    } finally {
      timings?.push({ label, ms: Date.now() - startedAt });
    }
  }

  private logProvisionTimings(
    email: string,
    timings: InviteTiming[],
    totalMs: number,
  ) {
    const stageSummary = timings
      .map((timing) => `${timing.label}Ms=${timing.ms}`)
      .join(' | ');
    this.logger.log(
      `[auth.provision_employee_invite] Timings | email=${normalizeEmail(email)} | totalMs=${totalMs}${stageSummary ? ` | ${stageSummary}` : ''}`,
    );
  }

  private async validateInvitedEmployeePermissionSets(
    tenantId: string,
    permissionSetIds: string[],
  ) {
    if (permissionSetIds.length === 0) {
      return [];
    }

    const uniquePermissionSetIds = Array.from(new Set(permissionSetIds));
    const permissionSets = await this.prisma.permissionSet.findMany({
      where: {
        id: { in: uniquePermissionSetIds },
        tenantId,
        isActive: true,
        isSystem: false,
      },
      select: { id: true, name: true },
    });

    if (permissionSets.length !== uniquePermissionSetIds.length) {
      throw new BadRequestException(
        'One or more selected permission sets are invalid for this tenant.',
      );
    }

    return permissionSets;
  }

  async invite(
    tenantId: string,
    dto: InviteUserDto,
    invitedBy?: string,
    timings?: InviteTiming[],
  ) {
    const normalizedEmail = normalizeEmail(dto.email);
    const tenant = await this.timeInviteStage(timings, 'tenantLookup', () =>
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
      }),
    );
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Block superadmin email
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (!superAdminEmail) throw new Error('SUPER_ADMIN_EMAIL is required');
    if (normalizedEmail === normalizeEmail(superAdminEmail)) {
      throw new ForbiddenException(
        'This email is reserved for the platform owner.',
      );
    }

    const existing = await this.timeInviteStage(
      timings,
      'duplicateLookup',
      () =>
        this.prisma.user.findFirst({
          where: {
            tenantId,
            email: { equals: normalizedEmail, mode: 'insensitive' },
          },
        }),
    );
    if (existing)
      throw new ConflictException('A user with this email already exists.');

    const userRole = dto.role ?? UserSystemRole.EMPLOYEE;
    const permissionSetIds = dto.permissionSetIds ?? [];

    // One Company Admin per tenant. Admin reassignment must go through the
    // dedicated tenant-admin flow so we do not silently demote the current admin.
    if (userRole === UserSystemRole.TENANT_ADMIN) {
      if (permissionSetIds.length > 0) {
        throw new BadRequestException(
          'Permission sets can only be selected for employee invites.',
        );
      }

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

    const selectedPermissionSets =
      userRole === UserSystemRole.EMPLOYEE
        ? await this.timeInviteStage(
            timings,
            'selectedPermissionSetValidation',
            () =>
              this.validateInvitedEmployeePermissionSets(
                tenantId,
                permissionSetIds,
              ),
          )
        : [];

    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await this.timeInviteStage(
        timings,
        'userCreate',
        () =>
          tx.user.create({
            data: {
              tenantId,
              email: normalizedEmail,
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone,
              role: userRole,
              status: 'PENDING_VERIFICATION',
              forcePasswordReset: true,
              inviteToken,
              inviteExpiresAt,
            },
          }),
      );

      await this.timeInviteStage(timings, 'systemPermissionSync', () =>
        syncUserSystemPermissionSet(
          tx,
          {
            tenantId,
            userId: createdUser.id,
            role: userRole,
            grantedBy: createdUser.id,
          },
          this.logger,
        ),
      );

      if (selectedPermissionSets.length > 0) {
        await this.timeInviteStage(
          timings,
          'baselinePermissionAssignment',
          () =>
            tx.userPermissionSet.createMany({
              data: selectedPermissionSets.map((permissionSet) => ({
                userId: createdUser.id,
                permissionSetId: permissionSet.id,
                grantedBy: invitedBy ?? createdUser.id,
              })),
              skipDuplicates: true,
            }),
        );
      }

      return createdUser;
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
        inviteKind:
          userRole === UserSystemRole.TENANT_ADMIN
            ? 'TENANT_ADMIN'
            : 'EMPLOYEE',
      })
      .catch((err) =>
        this.logger.error(`Failed to send invite for ${user.email}`, err),
      );

    await this.timeInviteStage(timings, 'auditLog', () =>
      this.audit.log({
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
            permissionSetIds: selectedPermissionSets.map(
              (permissionSet) => permissionSet.id,
            ),
          },
        },
        status: 'SUCCESS',
      }),
    );

    const {
      password: _password,
      mfaSecret: _mfaSecret,
      inviteToken: _token,
      ...safeUser
    } = user;
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
    const timings: InviteTiming[] = [];
    const startedAt = Date.now();
    try {
      // HR-provisioned employees (including bulk imports) start on the baseline
      // Employee set so they get self-service access without a manual assignment.
      const employeeSet = await this.timeInviteStage(
        timings,
        'permissionSetLookup',
        () =>
          this.prisma.permissionSet.findFirst({
            where: {
              tenantId,
              name: BASIC_EMPLOYEE_TEMPLATE_NAME,
              isActive: true,
              isSystem: false,
            },
            select: { id: true },
          }),
      );

      const result = await this.invite(
        tenantId,
        {
          ...dto,
          role: UserSystemRole.EMPLOYEE,
          permissionSetIds: employeeSet ? [employeeSet.id] : undefined,
        },
        undefined,
        timings,
      );

      return {
        userId: result.user.id,
        email: result.user.email,
        inviteSent: true,
      };
    } finally {
      this.logProvisionTimings(dto.email, timings, Date.now() - startedAt);
    }
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
          where: {
            tenantId_email: {
              tenantId,
              email: normalizeEmail(dto.email),
            },
          },
        });

    if (!user) {
      return { deleted: false };
    }

    // Durable employee provisioning owns its identity; legacy timeout cleanup must not delete it.
    if (
      (await this.prisma.employeeAccessCommand.findFirst({
        where: { tenantId, targetUserId: user.id },
      })) ||
      (await this.prisma.employeeAccessLifecycleCommand.findFirst({
        where: { tenantId, targetUserId: user.id },
      }))
    ) {
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
    if (
      !Array.isArray(userIds) ||
      userIds.length > 100 ||
      userIds.some((id) => typeof id !== 'string' || !id || id.length > 100)
    )
      throw new BadRequestException('At most 100 user IDs are allowed.');
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

    const managedInvite = await this.prisma.employeeAccessCommand.findFirst({
      where: { tenantId: user.tenantId, targetUserId: user.id },
    });
    const lifecycleInvite =
      await this.prisma.employeeAccessLifecycleCommand.findFirst({
        where: {
          tenantId: user.tenantId,
          targetUserId: user.id,
          action: 'RESEND',
          status: { not: 'FAILED' },
        },
        orderBy: { createdAt: 'desc' },
      });
    if (
      lifecycleInvite &&
      !['READY', 'COMPLETED'].includes(lifecycleInvite.status)
    )
      throw new ForbiddenException(
        'Employee invitation requires reconciliation.',
      );
    if (
      managedInvite &&
      !lifecycleInvite &&
      !['READY', 'PROVIDER_ACCEPTED'].includes(managedInvite.status)
    ) {
      throw new ForbiddenException(
        'Employee access linkage must be finalized before invitation acceptance.',
      );
    }

    const invitationOperation = lifecycleInvite ?? managedInvite;
    if (invitationOperation) {
      if (
        user.status !== 'PENDING_VERIFICATION' ||
        user.role !== 'EMPLOYEE' ||
        !(
          await this.rabbitmq.verifyEmployeeAccessLink({
            operationId: invitationOperation.id,
            tenantId: user.tenantId,
            employeeId: invitationOperation.employeeId,
            actorUserId: invitationOperation.actorUserId,
            requestHash: invitationOperation.requestHash,
            userId: user.id,
          })
        ).linked
      ) {
        throw new ForbiddenException(
          'Employee invitation is no longer eligible for acceptance.',
        );
      }
    }

    if (user.role === 'TENANT_ADMIN') {
      await this.rabbitmq.hrProvisionTenantWorkspace({
        tenantId: user.tenantId,
        adminEmail: user.tenant.email,
        adminUserId: user.id,
        country: user.tenant.country,
        currency: user.tenant.currency,
      });
    } else if (!invitationOperation) {
      await this.rabbitmq.hrLinkEmployeeIdentity({
        tenantId: user.tenantId,
        email: user.email,
        userId: user.id,
      });
    }

    const hashed = await bcrypt.hash(dto.password, 12);
    const activationData = {
      password: hashed,
      status: 'ACTIVE' as const,
      emailVerifiedAt: new Date(),
      forcePasswordReset: false,
      inviteToken: null,
      inviteExpiresAt: null,
      lastLoginAt: new Date(),
    };
    const updated = invitationOperation
      ? await this.prisma.$transaction(async (tx) => {
          const activated = await tx.user.updateMany({
            where: {
              id: user.id,
              tenantId: user.tenantId,
              status: 'PENDING_VERIFICATION',
              inviteToken: dto.inviteToken,
            },
            data: activationData,
          });
          if (activated.count !== 1) {
            throw new ForbiddenException(
              'Employee invitation is no longer eligible for acceptance.',
            );
          }
          return tx.user.findUniqueOrThrow({
            where: { id: user.id },
            include: { tenant: true },
          });
        })
      : await this.prisma.user.update({
          where: { id: user.id },
          data: activationData,
          include: { tenant: true },
        });

    // Activate tenant when Company Admin accepts invite
    if (updated.role === 'TENANT_ADMIN') {
      await this.prisma.tenant.update({
        where: { id: updated.tenantId },
        data: { status: 'ACTIVE' },
      });
    }

    // Auto-login — issue tokens so frontend redirects straight to dashboard
    const payload = {
      sub: updated.id,
      sessionVersion: updated.sessionVersion ?? 0,
      email: updated.email,
      role: updated.role,
      tenantId: updated.tenantId,
      tenantSlug: updated.tenant.slug,
      tenantName: updated.tenant.name,
      firstName: updated.firstName,
      // Permissions omitted — JwtStrategy.validate() fetches them from DB on each request.
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      {
        sub: updated.id,
        type: 'refresh',
        sessionVersion: updated.sessionVersion ?? 0,
      },
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
        moduleConfig: updated.tenant.moduleConfig,
      },
    };
  }

  async resendInvite(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { tenant: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const managed = await this.prisma.employeeAccessCommand.findFirst({
      where: { tenantId, targetUserId: user.id },
    });
    const lifecycleInvite =
      await this.prisma.employeeAccessLifecycleCommand.findFirst({
        where: { tenantId, targetUserId: user.id, action: 'RESEND' },
      });
    if (managed || lifecycleInvite) {
      throw new ConflictException(
        'Use the durable employee access invitation resend endpoint.',
      );
    }
    if (user.status !== 'PENDING_VERIFICATION') {
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
        userId: user.id,
        tenantId,
        email: user.email,
        firstName: user.firstName,
        inviteToken,
        tenantName: user.tenant.name,
        acceptInviteUrl,
        inviteKind: user.role === 'TENANT_ADMIN' ? 'TENANT_ADMIN' : 'EMPLOYEE',
        isResend: true,
      })
      .catch((err) =>
        this.logger.error(`Failed to resend invite for ${user.email}`, err),
      );

    await this.audit.log({
      tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'UPDATE',
      resource: 'users',
      resourceId: user.id,
      changes: {
        before: {
          inviteExpiresAt: user.inviteExpiresAt?.toISOString(),
          status: user.status,
        },
        after: {
          resendInvite: true,
          inviteExpiresAt: inviteExpiresAt.toISOString(),
          status: user.status,
        },
      },
      status: 'SUCCESS',
    });

    return { message: 'Invitation resent successfully' };
  }

  async findByEmail(tenantId: string, email: string) {
    return this.prisma.user.findFirst({
      where: {
        tenantId,
        email: { equals: normalizeEmail(email), mode: 'insensitive' },
      },
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

  async update(
    tenantId: string,
    id: string,
    dto: UpdateUserDto,
    actor?: RequestUser,
  ) {
    if (
      dto.role &&
      (!actor ||
        actor.tenantId !== tenantId ||
        !['SUPER_ADMIN', 'TENANT_ADMIN'].includes(actor.role))
    ) {
      throw new ForbiddenException(
        'Only tenant administrators may change system roles.',
      );
    }
    if (
      dto.status &&
      (!actor ||
        actor.tenantId !== tenantId ||
        (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(actor.role) &&
          !actor.permissions.includes(
            `users:${dto.status === UserStatus.INACTIVE || dto.status === UserStatus.SUSPENDED ? 'DELETE' : 'EDIT'}`,
          )))
    ) {
      throw new ForbiddenException(
        'Action-specific user management authority required.',
      );
    }
    const existing = await this.findById(tenantId, id);
    if (existing.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'The super admin account cannot be modified.',
      );
    }
    const lifecycleState =
      dto.status || dto.role
        ? await this.prisma.user.findFirst({
            where: { id, tenantId },
            select: {
              accessSuspendedAt: true,
              sessionVersion: true,
              status: true,
              role: true,
            },
          })
        : null;
    if (dto.status || dto.role) {
      if (!lifecycleState) throw new NotFoundException('User not found');
      if (lifecycleState?.accessSuspendedAt)
        throw new ForbiddenException(
          'Use the employee access lifecycle to restore a suspended account.',
        );
    }
    const managedInvite = await this.prisma.employeeAccessCommand.findFirst({
      where: { tenantId, targetUserId: id },
    });
    const renewedInvite =
      await this.prisma.employeeAccessLifecycleCommand.findFirst({
        where: { tenantId, targetUserId: id, action: 'RESEND' },
      });
    if (
      (managedInvite || renewedInvite) &&
      (dto.role || dto.status === UserStatus.ACTIVE)
    ) {
      if (dto.status === UserStatus.ACTIVE && existing.status !== 'ACTIVE')
        throw new ForbiddenException(
          'Use the employee access lifecycle to restore access.',
        );
      const verified = await this.prisma.user.findFirst({
        where: { id, tenantId },
        select: { emailVerifiedAt: true },
      });
      if (!verified?.emailVerifiedAt) {
        throw new ForbiddenException(
          'Pending employee access must complete the verified invitation flow.',
        );
      }
    }
    const data = {
      ...dto,
      ...(dto.status && String(dto.status) !== lifecycleState?.status
        ? { sessionVersion: { increment: 1 } }
        : {}),
    };
    const select = {
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
    } as const;
    if (lifecycleState) {
      return this.prisma.$transaction(async (tx) => {
        const changed = await tx.user.updateMany({
          where: {
            id,
            tenantId,
            role: existing.role,
            status: existing.status,
            sessionVersion: lifecycleState.sessionVersion,
            accessSuspendedAt: null,
          },
          data,
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'Account changed; reload before retrying.',
          );
        return tx.user.findUniqueOrThrow({ where: { id }, select });
      });
    }
    return this.prisma.user.update({ where: { id }, data, select });
  }

  async deactivateEmployeeAccess(tenantId: string, id: string) {
    const user = await this.findById(tenantId, id);
    if (user.role !== 'EMPLOYEE')
      throw new ForbiddenException(
        'Protected accounts cannot be offboarded through HR.',
      );
    if (
      !(await this.rabbitmq.verifyEmployeeOffboarded({ tenantId, userId: id }))
        .offboarded
    )
      throw new ForbiddenException('Employee is not offboarded.');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findFirst({ where: { tenantId, id } });
      if (!current || current.role !== 'EMPLOYEE')
        throw new ForbiddenException(
          'Protected accounts cannot be offboarded through HR.',
        );
      if (
        current.status === 'INACTIVE' &&
        current.accessSuspendedAt &&
        current.accessSuspensionReason === 'EMPLOYEE_OFFBOARDED'
      )
        return { deactivated: true };
      const changed = await tx.user.updateMany({
        where: {
          id,
          tenantId,
          role: 'EMPLOYEE',
          status: current.status,
          sessionVersion: current.sessionVersion,
        },
        data: {
          status: 'INACTIVE',
          sessionVersion: { increment: 1 },
          accessSuspendedAt: new Date(),
          accessSuspensionReason: 'EMPLOYEE_OFFBOARDED',
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('Account changed while offboarding.');
      await tx.refreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          resource: 'users',
          resourceId: id,
          action: 'UPDATE',
          changes: {
            after: {
              status: 'INACTIVE',
              reason: 'EMPLOYEE_OFFBOARDED',
              source: 'verified-hr-offboarding',
            },
          },
        },
      });
      return { deactivated: true };
    });
  }
  async deactivate(tenantId: string, id: string) {
    const existing = await this.findById(tenantId, id);
    if (existing.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'The super admin account cannot be deactivated.',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true },
      });
      return tx.user.update({
        where: { id },
        data: {
          status: 'INACTIVE',
          sessionVersion: { increment: 1 },
        },
      });
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

  async uploadAvatar(
    tenantId: string,
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<{ avatarUrl: string; user: { id: string; avatarUrl: string } }> {
    this.validateAvatar(file);
    const uploadedFile = file as Express.Multer.File;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { tenant: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const previousAvatarUrl = user.avatarUrl;

    const stored = await this.storage.storeUserAvatar({
      tenantId,
      tenantSlug: user.tenant.slug,
      userId,
      body: uploadedFile.buffer,
      contentType: uploadedFile.mimetype,
      originalFileName: uploadedFile.originalname,
    });

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: stored.objectKey },
      });
    } catch (error) {
      await this.storage
        .delete(stored.objectKey)
        .catch((cleanupError) =>
          this.logger.error(
            `Failed to clean up orphaned avatar object ${stored.objectKey}`,
            cleanupError,
          ),
        );
      throw error;
    }

    if (
      previousAvatarUrl &&
      this.storage.isUserAvatarObjectKey(previousAvatarUrl, tenantId, userId)
    ) {
      await this.storage
        .delete(previousAvatarUrl)
        .catch((error) =>
          this.logger.error(
            `Failed to delete previous avatar object ${previousAvatarUrl}`,
            error,
          ),
        );
    }

    // Awaited (not fire-and-forget) so the HTTP response — and the frontend's
    // subsequent refetch of the employee record — only lands after hr-service
    // has persisted the new avatar. A sync failure is logged, not fatal: the
    // auth-service avatarUrl update above already succeeded.
    await this.rabbitmq
      .hrEmployeeAvatarUpdated({
        tenantId,
        userId,
        avatarObjectKey: stored.objectKey,
      })
      .catch((error) =>
        this.logger.error(
          `Failed to notify hr-service of avatar update for user ${userId}`,
          error,
        ),
      );

    const signed = await this.storage.createSignedReadUrl({
      objectKey: stored.objectKey,
      mimeType: stored.mimeType,
      fileName: stored.fileName,
    });

    return {
      avatarUrl: signed.readUrl,
      user: { id: userId, avatarUrl: signed.readUrl },
    };
  }

  private validateAvatar(file: Express.Multer.File | undefined): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Avatar image is required.');
    }
    if (!AVATAR_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Avatar must be PNG, JPEG or WEBP.');
    }
    if (!this.matchesImageSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'Image content does not match its declared MIME type.',
      );
    }
    if (
      file.size > AVATAR_MAX_BYTES ||
      file.buffer.byteLength > AVATAR_MAX_BYTES
    ) {
      throw new BadRequestException(
        `Avatar image exceeds the ${AVATAR_MAX_BYTES / 1024 / 1024} MB limit.`,
      );
    }
  }

  private matchesImageSignature(buffer: Buffer, mimeType: string): boolean {
    if (mimeType === 'image/png') {
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (mimeType === 'image/jpeg') {
      return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    }
    if (mimeType === 'image/webp') {
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    }
    return false;
  }

  async listDocuments(tenantId: string, userId: string) {
    const documents = await this.prisma.userDocument.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      documents.map(async (doc) => {
        const signed = await this.storage.createSignedReadUrl({
          objectKey: doc.objectKey,
          mimeType: doc.mimeType,
          fileName: doc.fileName,
        });
        return { ...doc, url: signed.readUrl };
      }),
    );
  }

  async uploadDocument(
    tenantId: string,
    userId: string,
    dto: UploadUserDocumentDto,
    file: Express.Multer.File | undefined,
  ) {
    this.validateDocument(file);
    const uploadedFile = file as Express.Multer.File;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { tenant: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const stored = await this.storage.storeUserDocument({
      tenantId,
      tenantSlug: user.tenant.slug,
      userId,
      body: uploadedFile.buffer,
      contentType: uploadedFile.mimetype,
      originalFileName: uploadedFile.originalname,
    });

    const document = await this.prisma.userDocument.create({
      data: {
        tenantId,
        userId,
        category: dto.category.trim(),
        objectKey: stored.objectKey,
        mimeType: stored.mimeType,
        fileName: stored.fileName,
        sizeBytes: stored.sizeBytes,
      },
    });

    const signed = await this.storage.createSignedReadUrl({
      objectKey: document.objectKey,
      mimeType: document.mimeType,
      fileName: document.fileName,
    });

    return { ...document, url: signed.readUrl };
  }

  async deleteDocument(
    tenantId: string,
    userId: string,
    documentId: string,
  ): Promise<void> {
    const document = await this.prisma.userDocument.findFirst({
      where: { id: documentId, tenantId, userId },
    });
    if (!document) throw new NotFoundException('Document not found');

    await this.prisma.userDocument.delete({ where: { id: document.id } });

    await this.storage
      .delete(document.objectKey)
      .catch((error) =>
        this.logger.error(
          `Failed to delete document object ${document.objectKey}`,
          error,
        ),
      );
  }

  private validateDocument(file: Express.Multer.File | undefined): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('A document file is required.');
    }
    if (!DOCUMENT_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Document must be a PDF, image, Word or Excel file.',
      );
    }
    if (
      file.size > DOCUMENT_MAX_BYTES ||
      file.buffer.byteLength > DOCUMENT_MAX_BYTES
    ) {
      throw new BadRequestException(
        `Document exceeds the ${DOCUMENT_MAX_BYTES / 1024 / 1024} MB limit.`,
      );
    }
  }
}
