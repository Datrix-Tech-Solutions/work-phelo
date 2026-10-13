import { RabbitMqCampaignDispatcher } from './campaign-dispatcher';
import { campaignSmsText } from '../sms/sms-segments';

const campaign = (subject: string) => ({
  id: 'camp-1',
  tenantId: 'tenant-1',
  subject,
  message: 'Our new plan is live.',
  channels: ['SMS'],
  senderIdentityId: 'sender-1',
  senderIdSnapshot: 'WORKPHELO',
  smsReservationId: 'res-1',
});

describe('RabbitMqCampaignDispatcher', () => {
  const prisma = {
    marketingCampaign: { findUnique: jest.fn() },
    marketingCampaignRecipient: { findMany: jest.fn(), updateMany: jest.fn() },
  };
  const publisher = { campaignDispatchBatch: jest.fn() };
  const dispatcher = new RabbitMqCampaignDispatcher(
    prisma as never,
    publisher as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.marketingCampaignRecipient.findMany.mockResolvedValue([
      {
        id: 'r1',
        address: '+233244072091',
        contactName: 'Ama',
        segmentCount: 1,
        estimatedCredits: 1,
      },
    ]);
    prisma.marketingCampaignRecipient.updateMany.mockResolvedValue({
      count: 1,
    });
    publisher.campaignDispatchBatch.mockResolvedValue(undefined);
  });

  it('sends the subject ahead of the message, as the credits were estimated', async () => {
    prisma.marketingCampaign.findUnique.mockResolvedValue(campaign('New plan'));

    await dispatcher.dispatch('camp-1');

    expect(publisher.campaignDispatchBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'New plan\nOur new plan is live.',
      }),
    );
  });

  it('sends the same text the estimate counted segments for', async () => {
    prisma.marketingCampaign.findUnique.mockResolvedValue(campaign('New plan'));

    await dispatcher.dispatch('camp-1');

    expect(publisher.campaignDispatchBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        message: campaignSmsText('New plan', 'Our new plan is live.'),
      }),
    );
  });

  it('sends only the message when there is no subject', async () => {
    prisma.marketingCampaign.findUnique.mockResolvedValue(campaign('  '));

    await dispatcher.dispatch('camp-1');

    expect(publisher.campaignDispatchBatch).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Our new plan is live.' }),
    );
  });
});
