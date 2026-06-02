import { AnnouncementsService } from './announcements.service';
import { RequestUser } from '@work-phelo/types';
import {
  AnnouncementAudienceType,
  AnnouncementDeliveryChannel,
} from '../../prisma/generated/client';

const flushAsync = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

const adminActor = {
  id: 'user-admin-1',
  email: 'admin@acme.test',
  role: 'TENANT_ADMIN',
  tenantId: 'tenant-1',
  tenantSlug: 'acme',
  tenantName: 'Acme',
  firstName: 'Admin',
  moduleConfig: {},
  featureConfig: {},
  permissions: [],
} as RequestUser;

describe('AnnouncementsService read tracking', () => {
  const prisma = {
    employee: { findFirst: jest.fn(), findMany: jest.fn() },
    announcement: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    announcementReadReceipt: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      createMany: jest.fn(),
    },
  };
  const rabbitmq = {
    notificationAnnouncementPublished: jest.fn(),
    authGetUserStatuses: jest.fn(),
  };

  let service: AnnouncementsService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_BASE_URL = 'https://app.workphelo.test';
    service = new AnnouncementsService(prisma as any, rabbitmq as any);
  });

  it('defaults new announcements to in-app delivery only', async () => {
    prisma.announcement.create.mockResolvedValueOnce({
      id: 'ann-default',
      tenantId: 'tenant-1',
      title: 'Company update',
      body: 'This is a company announcement body.',
      audienceType: AnnouncementAudienceType.ALL,
      targetDepartmentIds: [],
      targetBranchIds: [],
      targetEmployeeIds: [],
      sendEmail: false,
      deliveryChannels: [AnnouncementDeliveryChannel.IN_APP],
      publishedAt: new Date('2026-06-02T10:00:00Z'),
    });

    await service.create('tenant-1', adminActor, {
      title: 'Company update',
      body: 'This is a company announcement body.',
    });

    expect(prisma.announcement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sendEmail: false,
        deliveryChannels: [AnnouncementDeliveryChannel.IN_APP],
      }),
    });
    expect(rabbitmq.notificationAnnouncementPublished).not.toHaveBeenCalled();
  });

  it('maps legacy sendEmail=true to in-app and email delivery', async () => {
    prisma.announcement.create.mockResolvedValueOnce({
      id: 'ann-email',
      tenantId: 'tenant-1',
      title: 'Email update',
      body: 'This announcement should still email employees.',
      audienceType: AnnouncementAudienceType.ALL,
      targetDepartmentIds: [],
      targetBranchIds: [],
      targetEmployeeIds: [],
      sendEmail: true,
      deliveryChannels: [
        AnnouncementDeliveryChannel.IN_APP,
        AnnouncementDeliveryChannel.EMAIL,
      ],
      publishedAt: new Date('2026-06-02T10:00:00Z'),
    });
    prisma.employee.findMany.mockResolvedValueOnce([
      {
        id: 'emp-1',
        userId: 'user-1',
        email: 'employee@acme.test',
        firstName: 'Ama',
        lastName: 'Mensah',
      },
    ]);
    rabbitmq.authGetUserStatuses.mockResolvedValueOnce([
      { userId: 'user-1', status: 'ACTIVE' },
    ]);

    await service.create('tenant-1', adminActor, {
      title: 'Email update',
      body: 'This announcement should still email employees.',
      sendEmail: true,
    });
    await flushAsync();

    expect(prisma.announcement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sendEmail: true,
        deliveryChannels: [
          AnnouncementDeliveryChannel.IN_APP,
          AnnouncementDeliveryChannel.EMAIL,
        ],
      }),
    });
    expect(rabbitmq.notificationAnnouncementPublished).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      announcementId: 'ann-email',
      title: 'Email update',
      body: 'This announcement should still email employees.',
      publishedAt: '2026-06-02T10:00:00.000Z',
      deliveryChannels: [
        AnnouncementDeliveryChannel.IN_APP,
        AnnouncementDeliveryChannel.EMAIL,
      ],
      platformLink: expect.stringContaining('/acme/login'),
      recipients: [
        {
          employeeId: 'emp-1',
          userId: 'user-1',
          email: 'employee@acme.test',
          firstName: 'Ama',
          lastName: 'Mensah',
        },
      ],
    });
  });

  it('uses deliveryChannels as source of truth and always includes in-app', async () => {
    prisma.announcement.create.mockResolvedValueOnce({
      id: 'ann-sms',
      tenantId: 'tenant-1',
      title: 'SMS update',
      body: 'This announcement stores SMS but does not send yet.',
      audienceType: AnnouncementAudienceType.ALL,
      targetDepartmentIds: [],
      targetBranchIds: [],
      targetEmployeeIds: [],
      sendEmail: false,
      deliveryChannels: [
        AnnouncementDeliveryChannel.IN_APP,
        AnnouncementDeliveryChannel.SMS,
      ],
      publishedAt: new Date('2026-06-02T10:00:00Z'),
    });

    await service.create('tenant-1', adminActor, {
      title: 'SMS update',
      body: 'This announcement stores SMS but does not send yet.',
      deliveryChannels: [AnnouncementDeliveryChannel.SMS],
    });

    expect(prisma.announcement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sendEmail: false,
        deliveryChannels: [
          AnnouncementDeliveryChannel.IN_APP,
          AnnouncementDeliveryChannel.SMS,
        ],
      }),
    });
    expect(rabbitmq.notificationAnnouncementPublished).not.toHaveBeenCalled();
  });

  it('sets sendEmail=true when deliveryChannels include email and sms', async () => {
    prisma.announcement.create.mockResolvedValueOnce({
      id: 'ann-all',
      tenantId: 'tenant-1',
      title: 'Multi-channel update',
      body: 'This announcement stores all delivery channels.',
      audienceType: AnnouncementAudienceType.ALL,
      targetDepartmentIds: [],
      targetBranchIds: [],
      targetEmployeeIds: [],
      sendEmail: true,
      deliveryChannels: [
        AnnouncementDeliveryChannel.IN_APP,
        AnnouncementDeliveryChannel.EMAIL,
        AnnouncementDeliveryChannel.SMS,
      ],
      publishedAt: new Date('2026-06-02T10:00:00Z'),
    });
    prisma.employee.findMany.mockResolvedValueOnce([]);

    await service.create('tenant-1', adminActor, {
      title: 'Multi-channel update',
      body: 'This announcement stores all delivery channels.',
      deliveryChannels: [
        AnnouncementDeliveryChannel.IN_APP,
        AnnouncementDeliveryChannel.EMAIL,
        AnnouncementDeliveryChannel.SMS,
      ],
    });
    await flushAsync();

    expect(prisma.announcement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sendEmail: true,
        deliveryChannels: [
          AnnouncementDeliveryChannel.IN_APP,
          AnnouncementDeliveryChannel.EMAIL,
          AnnouncementDeliveryChannel.SMS,
        ],
      }),
    });
  });

  it('counts only unread announcements visible to the current tenant/user', async () => {
    prisma.announcement.count.mockResolvedValueOnce(2);

    const result = await service.getUnreadCount('tenant-1', adminActor);

    expect(result).toEqual({ count: 2 });
    expect(prisma.announcement.count).toHaveBeenCalledWith({
      where: {
        AND: [
          expect.objectContaining({ tenantId: 'tenant-1' }),
          {
            readReceipts: {
              none: { tenantId: 'tenant-1', userId: 'user-admin-1' },
            },
          },
        ],
      },
    });
  });

  it('marks a visible announcement as read for only the current user', async () => {
    const readAt = new Date('2026-05-28T10:00:00Z');
    prisma.announcement.findFirst.mockResolvedValueOnce({ id: 'ann-1' });
    prisma.announcementReadReceipt.upsert.mockResolvedValueOnce({ readAt });

    const result = await service.markRead('tenant-1', adminActor, 'ann-1');

    expect(result).toEqual({
      message: 'Announcement marked as read',
      readAt,
    });
    expect(prisma.announcementReadReceipt.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_announcementId_userId: {
          tenantId: 'tenant-1',
          announcementId: 'ann-1',
          userId: 'user-admin-1',
        },
      },
      update: { readAt: expect.any(Date) },
      create: {
        tenantId: 'tenant-1',
        announcementId: 'ann-1',
        userId: 'user-admin-1',
      },
    });
  });

  it('marks all currently visible unread announcements as read idempotently', async () => {
    prisma.announcement.findMany.mockResolvedValueOnce([
      { id: 'ann-1' },
      { id: 'ann-2' },
    ]);
    prisma.announcementReadReceipt.createMany.mockResolvedValueOnce({
      count: 2,
    });

    const result = await service.markAllRead('tenant-1', adminActor);

    expect(result).toEqual({
      message: 'All announcements marked as read',
      count: 2,
    });
    expect(prisma.announcementReadReceipt.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: 'tenant-1',
          announcementId: 'ann-1',
          userId: 'user-admin-1',
        }),
        expect.objectContaining({
          tenantId: 'tenant-1',
          announcementId: 'ann-2',
          userId: 'user-admin-1',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('returns delivery channels in announcement list responses', async () => {
    prisma.announcement.findMany.mockResolvedValueOnce([
      {
        id: 'ann-1',
        tenantId: 'tenant-1',
        title: 'Company update',
        body: 'Visible announcement',
        audienceType: AnnouncementAudienceType.ALL,
        targetDepartmentIds: [],
        targetBranchIds: [],
        targetEmployeeIds: [],
        sendEmail: false,
        deliveryChannels: [AnnouncementDeliveryChannel.IN_APP],
        publishedAt: new Date('2026-06-02T10:00:00Z'),
        expiresAt: null,
        createdById: 'user-admin-1',
        createdAt: new Date('2026-06-02T10:00:00Z'),
        updatedAt: new Date('2026-06-02T10:00:00Z'),
      },
    ]);
    prisma.announcement.count.mockResolvedValueOnce(1);
    prisma.announcementReadReceipt.findMany.mockResolvedValueOnce([]);

    const result = await service.findAll('tenant-1', adminActor, {});

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        deliveryChannels: [AnnouncementDeliveryChannel.IN_APP],
        isRead: false,
        readAt: null,
      }),
    );
  });
});
