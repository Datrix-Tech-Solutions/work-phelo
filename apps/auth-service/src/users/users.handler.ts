import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  WithMeta,
  InviteEmployeeEvent,
  EmployeeOffboardedEvent,
  ResendEmployeeInviteEvent,
} from '@work-phelo/types';

@Controller()
export class UsersHandler {
  private readonly logger = new Logger(UsersHandler.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @EventPattern('auth.invite_employee')
  async handleInviteEmployee(@Payload() data: WithMeta<InviteEmployeeEvent>) {
    const { tenantId, email, firstName, lastName, _meta } = data;
    this.logger.log(
      `[auth.invite_employee] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      await this.usersService.invite(tenantId, {
        email,
        firstName,
        lastName,
        role: 'EMPLOYEE' as any,
      });
      this.logger.log(
        `[auth.invite_employee] Invite sent | email=${email} | corrId=${_meta?.correlationId}`,
      );
    } catch (e: any) {
      this.logger.warn(
        `[auth.invite_employee] Skipped | email=${email} | corrId=${_meta?.correlationId} | reason=${e.message}`,
      );
    }
  }

  @EventPattern('hr.employee_offboarded')
  async handleEmployeeOffboarded(
    @Payload() data: WithMeta<EmployeeOffboardedEvent>,
  ) {
    const { userId, email, _meta } = data;
    this.logger.log(
      `[hr.employee_offboarded] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: 'INACTIVE' },
      });
      await this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
      this.logger.log(
        `[hr.employee_offboarded] Account deactivated and tokens revoked | email=${email} | corrId=${_meta?.correlationId}`,
      );
    } catch (e: any) {
      this.logger.warn(
        `[hr.employee_offboarded] Failed | email=${email} | corrId=${_meta?.correlationId} | error=${e.message}`,
      );
    }
  }

  @EventPattern('auth.resend_employee_invite')
  async handleResendEmployeeInvite(
    @Payload() data: WithMeta<ResendEmployeeInviteEvent>,
  ) {
    const { tenantId, email, firstName, lastName, _meta } = data;
    this.logger.log(
      `[auth.resend_employee_invite] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      const user = await this.usersService.findByEmail(tenantId, email);
      if (!user) {
        this.logger.warn(
          `[auth.resend_employee_invite] No user found — sending fresh invite | email=${email} | corrId=${_meta?.correlationId}`,
        );
        await this.usersService.invite(tenantId, {
          email,
          firstName,
          lastName: lastName ?? '',
          role: 'EMPLOYEE' as any,
        });
        this.logger.log(
          `[auth.resend_employee_invite] Fresh invite sent | email=${email} | corrId=${_meta?.correlationId}`,
        );
        return;
      }
      await this.usersService.resendInvite(tenantId, user.id);
      this.logger.log(
        `[auth.resend_employee_invite] Invite resent | email=${email} | corrId=${_meta?.correlationId}`,
      );
    } catch (e: any) {
      this.logger.warn(
        `[auth.resend_employee_invite] Failed | email=${email} | corrId=${_meta?.correlationId} | error=${e.message}`,
      );
    }
  }
}
