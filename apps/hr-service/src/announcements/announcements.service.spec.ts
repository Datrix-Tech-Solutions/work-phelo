import { AnnouncementsService } from './announcements.service';
import { RequestUser } from '@work-phelo/types';

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
    employee: { findFirst: jest.fn() },
    announcement: {
      count: jest.fn(),
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
    service = new AnnouncementsService(prisma as any, rabbitmq as any);
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
});
