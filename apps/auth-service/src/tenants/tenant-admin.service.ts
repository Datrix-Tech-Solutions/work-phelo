import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto';
import { generateSecureToken } from '../common/otp.helper';
import { WorkspaceUrl } from '../common/workspace-url.helper';
import { syncUserSystemPermissionSet } from '../permissions/system-permission-sets';

@Injectable()
export class TenantAdminService {
  private readonly logger = new Logger(TenantAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  async updateTenantAdmin(id: string, dto: UpdateTenantAdminDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.user.findFirst({
      where: { tenantId: id, role: 'TENANT_ADMIN' },
    });

    if (existing) {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          status: true,
        },
      });
      return { message: 'Admin updated successfully', user: updated };
    }

    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        tenantId: id,
        email: dto.email,
        password: '',
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'TENANT_ADMIN',
        status: 'PENDING_VERIFICATION',
        forcePasswordReset: true,
        inviteToken,
        inviteExpiresAt,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
      },
    });

    await syncUserSystemPermissionSet(
      this.prisma,
      {
        tenantId: id,
        userId: user.id,
        role: user.role,
        grantedBy: user.id,
      },
      this.logger,
    );
    const acceptInviteUrl = WorkspaceUrl.acceptInvite(tenant.slug, inviteToken);
    void this.rabbitmq
      .notificationInviteUser({
        email: user.email,
        firstName: user.firstName,
        tenantName: tenant.name,
        acceptInviteUrl,
        inviteKind: 'TENANT_ADMIN',
      })
      .catch((err) =>
        this.logger.error(`Failed to emit invite for ${user.email}`, err),
      );

    return { message: 'Admin assigned. Invite email sent.', user };
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

    void this.rabbitmq
      .notificationInviteUser({
        userId: admin.id,
        tenantId,
        email: admin.email,
        firstName: admin.firstName,
        inviteToken,
        acceptInviteUrl: WorkspaceUrl.acceptInvite(
          admin.tenant.slug,
          inviteToken,
        ),
        tenantName: admin.tenant.name,
        inviteKind: 'TENANT_ADMIN',
      })
      .catch((err) =>
        this.logger.error(`Failed to resend invite for ${admin.email}`, err),
      );

    return { message: 'Invitation resent successfully' };
  }
}
