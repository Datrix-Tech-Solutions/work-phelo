import { RmqContext } from '@nestjs/microservices';
import {
  EventPatterns,
  ReinsuranceCounterpartyAuditEvent,
} from '@work-phelo/types';
import { AuditEventsHandler } from './audit-events.handler';
import { AuditService } from './audit.service';

describe('AuditEventsHandler', () => {
  type CounterpartyAuditHandler =
    | 'onCounterpartyCreated'
    | 'onCounterpartyUpdated'
    | 'onCounterpartyDeleted';

  const event: ReinsuranceCounterpartyAuditEvent & {
    _meta: {
      messageId: string;
      correlationId: string;
      timestamp: string;
    };
  } = {
    tenantId: 'tenant-1',
    counterpartyId: 'counterparty-1',
    counterpartyType: 'CEDANT',
    counterpartyName: 'Acme Cedant',
    actorUserId: 'user-1',
    actorEmail: 'broker@example.com',
    actorRole: 'EMPLOYEE',
    changes: { after: { name: 'Acme Cedant' } },
    _meta: {
      messageId: 'message-1',
      correlationId: 'correlation-1',
      timestamp: '2026-05-26T10:00:00.000Z',
    },
  };

  let auditService: { log: jest.Mock };
  let channel: { ack: jest.Mock };
  let context: RmqContext;
  let handler: AuditEventsHandler;

  beforeEach(() => {
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    channel = { ack: jest.fn() };
    context = {
      getChannelRef: () => channel,
      getMessage: () => 'message',
    } as unknown as RmqContext;
    handler = new AuditEventsHandler(auditService as unknown as AuditService);
  });

  it.each<[string, string, CounterpartyAuditHandler]>([
    [
      EventPatterns.REINSURANCE_COUNTERPARTY_CREATED,
      'CREATE',
      'onCounterpartyCreated',
    ],
    [
      EventPatterns.REINSURANCE_COUNTERPARTY_UPDATED,
      'UPDATE',
      'onCounterpartyUpdated',
    ],
    [
      EventPatterns.REINSURANCE_COUNTERPARTY_DELETED,
      'DELETE',
      'onCounterpartyDeleted',
    ],
  ])(
    'records %s as %s and acknowledges the event',
    async (_pattern, action, method) => {
      await handler[method](event, context);

      expect(auditService.log).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        userEmail: 'broker@example.com',
        userRole: 'EMPLOYEE',
        action,
        resource: 'operations.reinsurance.counterparties',
        resourceId: 'counterparty-1',
        changes: event.changes,
      });
      expect(channel.ack).toHaveBeenCalledWith('message');
    },
  );
});
