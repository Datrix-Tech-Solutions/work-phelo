import { NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { EmailEventPublisher } from '../messaging/email-event.publisher';
import { PrismaService } from '../prisma/prisma.service';
import { EmailThreadsService } from './email-threads.service';

describe('EmailThreadsService', () => {
  const user: RequestUser = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE',
    tenantId: 'tenant-1',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [],
  };
  const thread = {
    id: 'thread-1',
    tenantId: 'tenant-1',
    mailboxConnectionId: 'mailbox-1',
    providerThreadId: 'provider-thread-1',
    archivedAt: null,
  };

  let prisma: {
    emailThread: Record<string, jest.Mock>;
    emailMessage: Record<string, jest.Mock>;
    placement: Record<string, jest.Mock>;
    placementEmailLink: Record<string, jest.Mock>;
  };
  let publisher: { emailLinked: jest.Mock };
  let service: EmailThreadsService;

  beforeEach(() => {
    prisma = {
      emailThread: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      emailMessage: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      placement: {
        findFirst: jest.fn(),
      },
      placementEmailLink: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    publisher = { emailLinked: jest.fn().mockResolvedValue(undefined) };
    service = new EmailThreadsService(
      prisma as unknown as PrismaService,
      publisher as unknown as EmailEventPublisher,
    );
  });

  it('lists only active threads in the current tenant', async () => {
    prisma.emailThread.findMany.mockResolvedValue([thread]);
    prisma.emailThread.count.mockResolvedValue(1);

    const result = await service.findThreads('tenant-1', {
      mailboxConnectionId: 'mailbox-1',
      search: 'renewal',
      page: 1,
      limit: 20,
    });

    expect(prisma.emailThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          archivedAt: null,
          mailboxConnectionId: 'mailbox-1',
          subject: { contains: 'renewal', mode: 'insensitive' },
        },
      }),
    );
    expect(result.meta.total).toBe(1);
  });

  it('lists messages only for active tenant-owned threads', async () => {
    prisma.emailMessage.findMany.mockResolvedValue([]);
    prisma.emailMessage.count.mockResolvedValue(0);

    await service.findMessages('tenant-1', {
      threadId: 'thread-1',
      page: 1,
      limit: 20,
    });

    const findManyCalls = prisma.emailMessage.findMany.mock
      .calls as unknown as Array<[unknown]>;
    const findManyCall = findManyCalls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(findManyCall).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        threadId: 'thread-1',
        thread: { archivedAt: null },
      },
    });
  });

  it('links a tenant-owned thread to a tenant-owned placement', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.emailThread.findFirst.mockResolvedValue({ id: 'thread-1' });
    prisma.emailMessage.findFirst.mockResolvedValue({ id: 'message-1' });
    prisma.placementEmailLink.create.mockResolvedValue({
      id: 'link-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      threadId: 'thread-1',
      messageId: 'message-1',
      note: null,
      linkedByUserId: 'user-1',
    });

    const result = await service.linkPlacement(
      user,
      'thread-1',
      'placement-1',
      { messageId: 'message-1' },
    );

    expect(prisma.placement.findFirst).toHaveBeenCalledWith({
      where: { id: 'placement-1', tenantId: 'tenant-1', archivedAt: null },
      select: { id: true },
    });
    expect(prisma.placementEmailLink.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        threadId: 'thread-1',
        messageId: 'message-1',
        note: undefined,
        linkedByUserId: 'user-1',
      },
    });
    expect(result.id).toBe('link-1');
    expect(publisher.emailLinked).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        threadId: 'thread-1',
      }),
    );
  });

  it('rejects linking when the message is not in the selected thread and tenant', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.emailThread.findFirst.mockResolvedValue({ id: 'thread-1' });
    prisma.emailMessage.findFirst.mockResolvedValue(null);

    await expect(
      service.linkPlacement(user, 'thread-1', 'placement-1', {
        messageId: 'message-from-other-thread',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('archives links only inside the authenticated tenant', async () => {
    prisma.placementEmailLink.findFirst.mockResolvedValue({ id: 'link-1' });
    prisma.placementEmailLink.update.mockResolvedValue({
      id: 'link-1',
      archivedAt: new Date('2026-05-28T10:00:00.000Z'),
    });

    await service.archiveLink(user, 'link-1');

    expect(prisma.placementEmailLink.findFirst).toHaveBeenCalledWith({
      where: { id: 'link-1', tenantId: 'tenant-1', archivedAt: null },
    });
    expect(prisma.placementEmailLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_tenantId: { id: 'link-1', tenantId: 'tenant-1' } },
      }),
    );
  });
});
