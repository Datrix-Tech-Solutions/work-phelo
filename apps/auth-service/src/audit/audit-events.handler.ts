import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import {
  EventPatterns,
  ReinsuranceCounterpartyAuditEvent,
  WithMeta,
} from '@work-phelo/types';
import { AuditService } from './audit.service';

@Controller()
export class AuditEventsHandler {
  constructor(private readonly auditService: AuditService) {}

  @EventPattern(EventPatterns.REINSURANCE_COUNTERPARTY_CREATED)
  async onCounterpartyCreated(
    @Payload() data: WithMeta<ReinsuranceCounterpartyAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logCounterparty('CREATE', data);
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_COUNTERPARTY_UPDATED)
  async onCounterpartyUpdated(
    @Payload() data: WithMeta<ReinsuranceCounterpartyAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logCounterparty('UPDATE', data);
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_COUNTERPARTY_DELETED)
  async onCounterpartyDeleted(
    @Payload() data: WithMeta<ReinsuranceCounterpartyAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logCounterparty('DELETE', data);
    this.ack(context);
  }

  private logCounterparty(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    data: ReinsuranceCounterpartyAuditEvent,
  ): Promise<void> {
    return this.auditService.log({
      tenantId: data.tenantId,
      userId: data.actorUserId,
      userEmail: data.actorEmail,
      userRole: data.actorRole,
      action,
      resource: 'operations.reinsurance.counterparties',
      resourceId: data.counterpartyId,
      changes: data.changes,
    });
  }

  private ack(context: RmqContext): void {
    const channel = context.getChannelRef() as { ack: (msg: unknown) => void };
    channel.ack(context.getMessage());
  }
}
