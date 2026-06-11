import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import { EmailEventPublisher } from '../messaging/email-event.publisher';
import { PrismaService } from '../prisma/prisma.service';
import { LinkPlacementEmailDto } from './dto/link-placement-email.dto';
import { QueryEmailMessagesDto } from './dto/query-email-messages.dto';
import { QueryEmailThreadsDto } from './dto/query-email-threads.dto';

const threadInclude = {
  messages: {
    orderBy: { receivedAt: 'desc' as const },
    take: 5,
    include: { attachments: true },
  },
} satisfies Prisma.EmailThreadInclude;

const messageInclude = {
  attachments: true,
} satisfies Prisma.EmailMessageInclude;

const mailboxSummarySelect = {
  id: true,
  provider: true,
  emailAddress: true,
  displayName: true,
} satisfies Prisma.MailboxConnectionSelect;

const placementThreadListInclude = {
  thread: {
    include: {
      mailboxConnection: { select: mailboxSummarySelect },
      messages: {
        orderBy: [
          { receivedAt: 'desc' as const },
          { createdAt: 'desc' as const },
        ],
        take: 1,
        include: { attachments: true },
      },
    },
  },
} satisfies Prisma.PlacementEmailLinkInclude;

const placementThreadDetailInclude = {
  thread: {
    include: {
      mailboxConnection: { select: mailboxSummarySelect },
      messages: {
        orderBy: [
          { receivedAt: 'asc' as const },
          { createdAt: 'asc' as const },
        ],
        include: { attachments: true },
      },
    },
  },
} satisfies Prisma.PlacementEmailLinkInclude;

type ThreadRecord = Prisma.EmailThreadGetPayload<{
  include: typeof threadInclude;
}>;

type LinkRecord = Prisma.PlacementEmailLinkGetPayload<object>;
type PlacementThreadListRecord = Prisma.PlacementEmailLinkGetPayload<{
  include: typeof placementThreadListInclude;
}>;
type PlacementThreadDetailRecord = Prisma.PlacementEmailLinkGetPayload<{
  include: typeof placementThreadDetailInclude;
}>;

@Injectable()
export class EmailThreadsService {
  private readonly logger = new Logger(EmailThreadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EmailEventPublisher,
  ) {}

  async findThreads(tenantId: string, query: QueryEmailThreadsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.EmailThreadWhereInput = {
      tenantId,
      archivedAt: null,
      ...(query.mailboxConnectionId
        ? { mailboxConnectionId: query.mailboxConnectionId }
        : {}),
      ...(query.search
        ? { subject: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.emailThread.findMany({
        where,
        include: threadInclude,
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.emailThread.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findThread(tenantId: string, id: string): Promise<ThreadRecord> {
    const thread = await this.prisma.emailThread.findFirst({
      where: { id, tenantId, archivedAt: null },
      include: threadInclude,
    });

    if (!thread) throw new NotFoundException('Email thread not found');
    return thread;
  }

  async findMessages(tenantId: string, query: QueryEmailMessagesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.EmailMessageWhereInput = {
      tenantId,
      ...(query.threadId ? { threadId: query.threadId } : {}),
      ...(query.mailboxConnectionId
        ? { mailboxConnectionId: query.mailboxConnectionId }
        : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: 'insensitive' } },
              { fromEmail: { contains: query.search, mode: 'insensitive' } },
              { fromName: { contains: query.search, mode: 'insensitive' } },
              { bodyPreview: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      thread: { archivedAt: null },
    };

    const [items, total] = await Promise.all([
      this.prisma.emailMessage.findMany({
        where,
        include: messageInclude,
        orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.emailMessage.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findPlacementThreads(tenantId: string, placementId: string) {
    await this.assertPlacement(tenantId, placementId);

    const links = await this.prisma.placementEmailLink.findMany({
      where: {
        tenantId,
        placementId,
        archivedAt: null,
        thread: { archivedAt: null },
      },
      include: placementThreadListInclude,
      orderBy: [{ createdAt: 'desc' }],
    });

    return links.map((link) => this.mapPlacementThreadSummary(link));
  }

  async findPlacementThread(
    tenantId: string,
    placementId: string,
    threadId: string,
  ) {
    await this.assertPlacement(tenantId, placementId);

    const link = await this.prisma.placementEmailLink.findFirst({
      where: {
        tenantId,
        placementId,
        threadId,
        archivedAt: null,
        thread: { archivedAt: null },
      },
      include: placementThreadDetailInclude,
    });

    if (!link) throw new NotFoundException('Placement email thread not found');

    return {
      thread: this.mapPlacementThreadSummary(link),
      messages: link.thread.messages,
    };
  }

  async linkPlacement(
    user: RequestUser,
    threadId: string,
    placementId: string,
    dto: LinkPlacementEmailDto,
  ): Promise<LinkRecord> {
    await Promise.all([
      this.assertPlacement(user.tenantId, placementId),
      this.assertThread(user.tenantId, threadId),
      dto.messageId
        ? this.assertMessage(user.tenantId, threadId, dto.messageId)
        : Promise.resolve(),
    ]);

    const existing = await this.prisma.placementEmailLink.findFirst({
      where: {
        tenantId: user.tenantId,
        placementId,
        threadId,
        archivedAt: null,
      },
    });
    if (existing) return existing;

    const link = await this.prisma.placementEmailLink.create({
      data: {
        tenantId: user.tenantId,
        placementId,
        threadId,
        messageId: dto.messageId,
        note: this.cleanOptional(dto.note),
        linkedByUserId: user.id,
      },
    });

    this.publishLinked(link, user);
    return link;
  }

  async linkPlacementWithThread(
    user: RequestUser,
    threadId: string,
    placementId: string,
    dto: LinkPlacementEmailDto,
  ) {
    const link = await this.linkPlacement(user, threadId, placementId, dto);
    const conversation = await this.findPlacementThread(
      user.tenantId,
      placementId,
      threadId,
    );

    return {
      link,
      thread: conversation.thread,
    };
  }

  async archiveLink(user: RequestUser, id: string): Promise<LinkRecord> {
    const existing = await this.prisma.placementEmailLink.findFirst({
      where: { id, tenantId: user.tenantId, archivedAt: null },
    });
    if (!existing) throw new NotFoundException('Email link not found');

    return this.prisma.placementEmailLink.update({
      where: { id_tenantId: { id, tenantId: user.tenantId } },
      data: {
        archivedAt: new Date(),
        archivedByUserId: user.id,
      },
    });
  }

  private async assertPlacement(
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');
  }

  private async assertThread(
    tenantId: string,
    threadId: string,
  ): Promise<void> {
    const thread = await this.prisma.emailThread.findFirst({
      where: { id: threadId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!thread) throw new NotFoundException('Email thread not found');
  }

  private async assertMessage(
    tenantId: string,
    threadId: string,
    messageId: string,
  ): Promise<void> {
    const message = await this.prisma.emailMessage.findFirst({
      where: { id: messageId, tenantId, threadId },
      select: { id: true },
    });
    if (!message) throw new NotFoundException('Email message not found');
  }

  private cleanOptional(value?: string): string | null | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private mapPlacementThreadSummary(
    link: PlacementThreadListRecord | PlacementThreadDetailRecord,
  ) {
    const latestMessage = link.thread.messages[0];

    return {
      linkId: link.id,
      threadId: link.threadId,
      subject: link.thread.subject,
      participants: link.thread.participants,
      latestMessagePreview: latestMessage?.bodyPreview ?? null,
      latestMessageAt:
        link.thread.lastMessageAt ??
        latestMessage?.receivedAt ??
        latestMessage?.sentAt ??
        null,
      messageCount: link.thread.messageCount,
      hasAttachments: link.thread.hasAttachments,
      linkedByUserId: link.linkedByUserId,
      note: link.note,
      linkedAt: link.createdAt,
      mailbox: link.thread.mailboxConnection,
    };
  }

  private publishLinked(link: LinkRecord, user: RequestUser): void {
    try {
      this.publisher
        .emailLinked({
          tenantId: user.tenantId,
          linkId: link.id,
          placementId: link.placementId,
          threadId: link.threadId,
          messageId: link.messageId ?? undefined,
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          changes: {
            after: {
              placementId: link.placementId,
              threadId: link.threadId,
              messageId: link.messageId,
            },
          },
        })
        .catch((error: unknown) => {
          this.logger.warn(
            `Email link audit event failed: ${this.errorMessage(error)}`,
          );
        });
    } catch (error) {
      this.logger.warn(
        `Email link audit event failed: ${this.errorMessage(error)}`,
      );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
