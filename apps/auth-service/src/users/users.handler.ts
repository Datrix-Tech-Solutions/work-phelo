import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { UsersService } from './users.service';

@Controller()
export class UsersHandler {
  private readonly logger = new Logger(UsersHandler.name);

  constructor(private readonly usersService: UsersService) {}

  @EventPattern('auth.invite_employee')
  async handleInviteEmployee(
    @Payload()
    data: {
      tenantId: string;
      employeeId: string;
      email: string;
      firstName: string;
      lastName: string;
    },
  ) {
    this.logger.log(`Handling employee invite for ${data.email}`);
    try {
      await this.usersService.invite(data.tenantId, {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'EMPLOYEE' as any,
      });
      this.logger.log(`Invite sent to ${data.email}`);
    } catch (e: any) {
      this.logger.warn(
        `Employee invite skipped for ${data.email}: ${e.message}`,
      );
    }
  }

  @EventPattern('auth.resend_employee_invite')
  async handleResendEmployeeInvite(
    @Payload()
    data: {
      tenantId: string;
      employeeId: string;
      email: string;
      firstName: string;
      lastName?: string;
    },
  ) {
    this.logger.log(`Resending employee invite for ${data.email}`);
    try {
      const user = await this.usersService.findByEmail(
        data.tenantId,
        data.email,
      );
      if (!user) {
        // User was never created (original invite was lost) — create fresh
        this.logger.warn(
          `No user found for ${data.email} — sending fresh invite`,
        );
        await this.usersService.invite(data.tenantId, {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName ?? '',
          role: 'EMPLOYEE' as any,
        });
        this.logger.log(`Fresh invite sent to ${data.email}`);
        return;
      }
      await this.usersService.resendInvite(data.tenantId, user.id);
      this.logger.log(`Invite resent to ${data.email}`);
    } catch (e: any) {
      this.logger.warn(
        `Failed to resend invite for ${data.email}: ${e.message}`,
      );
    }
  }
}
