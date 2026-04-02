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
}
