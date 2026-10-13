import { RmqContext } from '@nestjs/microservices';
import { WithMeta } from '@work-phelo/types';
import { NotificationHandler } from './notification.handler';

describe('NotificationHandler campaign dispatch', () => {
  const ack = jest.fn();
  const channel = { ack, nack: jest.fn() };
  const message = {};
  const context = {
    getChannelRef: () => channel,
    getMessage: () => message,
  } as unknown as RmqContext;
  const notificationService = {};
  const inAppNotifications = {};
  const smsService = { sendMessage: jest.fn() };
  const marketingEvents = { campaignDeliveryResult: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    smsService.sendMessage.mockResolvedValue({
      success: true,
      status: 'SENT',
      provider: 'termii',
      providerMessageId: 'provider-1',
      providerStatus: 'ok',
    });
  });

  it('sends SMS campaign recipients with the tenant sender ID and publishes results', async () => {
    const handler = new NotificationHandler(
      notificationService as never,
      inAppNotifications as never,
      smsService as never,
      marketingEvents as never,
    );

    await handler.handleCampaignDispatch(
      {
        tenantId: 'tenant-1',
        campaignId: 'campaign-1',
        batchId: 'campaign-1:1',
        channel: 'SMS',
        senderIdentityId: 'sender-1',
        senderId: 'TENANTSMS',
        reservationId: 'reservation-1',
        subject: 'Hello',
        message: 'Body',
        recipients: [
          {
            recipientId: 'recipient-1',
            channel: 'SMS',
            address: '+233244000001',
            contactName: 'Ama',
            segmentCount: 1,
            estimatedCredits: 1,
            idempotencyKey: 'campaign-1:recipient-1:sms',
          },
        ],
        _meta: {
          messageId: 'message-1',
          correlationId: 'correlation-1',
          timestamp: '2026-10-05T00:00:00.000Z',
        },
      } satisfies WithMeta<{
        tenantId: string;
        campaignId: string;
        batchId: string;
        channel: 'SMS';
        senderIdentityId: string;
        senderId: string;
        reservationId: string;
        subject: string;
        message: string;
        recipients: Array<{
          recipientId: string;
          channel: 'SMS';
          address: string;
          contactName: string;
          segmentCount: number;
          estimatedCredits: number;
          idempotencyKey: string;
        }>;
      }>,
      context,
    );

    expect(smsService.sendMessage).toHaveBeenCalledWith(
      '+233244000001',
      'Body',
      expect.objectContaining({
        senderId: 'TENANTSMS',
        idempotencyKey: 'campaign-1:recipient-1:sms',
      }),
    );
    expect(marketingEvents.campaignDeliveryResult).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'campaign-1',
        recipientId: 'recipient-1',
        accepted: true,
        provider: 'termii',
        providerMessageId: 'provider-1',
        chargedCredits: 1,
      }),
    );
    expect(ack).toHaveBeenCalledWith(message);
  });
});
