import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { LeaveService } from '../leave/leave.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class EventsHandler {
  private readonly logger = new Logger(EventsHandler.name);

  constructor(
    private readonly leaveService: LeaveService,
    private readonly prisma: PrismaService,
  ) {}

  @EventPattern('hr.tenant_approved')
  async handleTenantApproved(@Payload() data: { tenantId: string }) {
    this.logger.log(`Seeding default data for tenant ${data.tenantId}`);
    try {
      await this.leaveService.seedDefaultLeaveTypes(data.tenantId);
      this.logger.log(`Default leave types seeded for tenant ${data.tenantId}`);
    } catch (e: any) {
      this.logger.warn(
        `Failed to seed leave types for ${data.tenantId}: ${e.message}`,
      );
    }
  }

  @EventPattern('hr.employee_activated')
  async handleEmployeeActivated(
    @Payload() data: { tenantId: string; email: string; userId: string },
  ) {
    this.logger.log(`Linking userId to employee ${data.email}`);
    try {
      await this.prisma.employee.updateMany({
        where: { tenantId: data.tenantId, email: data.email },
        data: { userId: data.userId },
      });
      this.logger.log(`userId linked for employee ${data.email}`);
    } catch (e: any) {
      this.logger.warn(`Failed to link userId for ${data.email}: ${e.message}`);
    }
  }
}
