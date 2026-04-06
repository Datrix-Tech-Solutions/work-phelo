import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { LeaveService } from '../leave/leave.service';

@Controller()
export class EventsHandler {
  private readonly logger = new Logger(EventsHandler.name);

  constructor(private readonly leaveService: LeaveService) {}

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
}
