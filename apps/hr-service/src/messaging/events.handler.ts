import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { LeaveService } from '../leave/leave.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  WithMeta,
  TenantApprovedEvent,
  EmployeeActivatedEvent,
} from '@work-phelo/types';

@Controller()
export class EventsHandler {
  private readonly logger = new Logger(EventsHandler.name);

  constructor(
    private readonly leaveService: LeaveService,
    private readonly prisma: PrismaService,
  ) {}

  @EventPattern('hr.tenant_approved')
  async handleTenantApproved(@Payload() data: WithMeta<TenantApprovedEvent>) {
    const { tenantId, _meta } = data;
    this.logger.log(
      `[hr.tenant_approved] Received | tenantId=${tenantId} | corrId=${_meta?.correlationId}`,
    );
    try {
      await this.leaveService.seedDefaultLeaveTypes(tenantId);
      this.logger.log(
        `[hr.tenant_approved] Default leave types seeded | tenantId=${tenantId} | corrId=${_meta?.correlationId}`,
      );
    } catch (e: any) {
      this.logger.warn(
        `[hr.tenant_approved] Failed to seed leave types | tenantId=${tenantId} | corrId=${_meta?.correlationId} | error=${e.message}`,
      );
    }
  }

  @EventPattern('hr.employee_activated')
  async handleEmployeeActivated(
    @Payload() data: WithMeta<EmployeeActivatedEvent>,
  ) {
    const { tenantId, email, userId, _meta } = data;
    this.logger.log(
      `[hr.employee_activated] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      const employee = await this.prisma.employee.findFirst({
        where: { tenantId, email },
      });
      if (!employee) {
        this.logger.warn(
          `[hr.employee_activated] No employee record found | email=${email} | corrId=${_meta?.correlationId} — skipping balance init`,
        );
        return;
      }

      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { userId },
      });
      this.logger.log(
        `[hr.employee_activated] userId linked | email=${email} | corrId=${_meta?.correlationId}`,
      );

      await this.leaveService.initializeLeaveBalances(tenantId, employee.id);
      this.logger.log(
        `[hr.employee_activated] Leave balances initialised | email=${email} | corrId=${_meta?.correlationId}`,
      );
    } catch (e: any) {
      this.logger.warn(
        `[hr.employee_activated] Failed | email=${email} | corrId=${_meta?.correlationId} | error=${e.message}`,
      );
    }
  }
}
