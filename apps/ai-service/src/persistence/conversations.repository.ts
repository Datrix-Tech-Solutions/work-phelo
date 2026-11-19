import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AiDatabaseService } from './ai-database.service';
import { OwnershipContext, ownershipDeadline, requireOwnership } from './ownership-context';
import { retentionDeadline } from './retention-policy';
import { listCursor, listPosition } from './conversation-pagination';

const metadata = { id: true, createdAt: true, updatedAt: true, expiresAt: true } as const;
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

@Injectable()
export class ConversationsRepository {
  constructor(private readonly database: AiDatabaseService) {}

  async create(context: OwnershipContext) {
    const owner = requireOwnership(context);
    return this.database.transaction(async (db) => {
      const [clock] = await db.$queryRaw<
        { now: Date }[]
      >`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`;
      return db.aiConversation.create({
        data: { ...owner, createdAt: clock.now, expiresAt: retentionDeadline(clock.now) },
        select: metadata,
      });
    }, ownershipDeadline(context));
  }

  async findOwned(context: OwnershipContext, id: string) {
    const owner = requireOwnership(context);
    if (typeof id !== 'string' || !uuid.test(id)) return null;
    return this.database.transaction(async (db) => {
      const [clock] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      return db.aiConversation.findFirst({
        where: { id, ...owner, expiresAt: { gt: clock.now } },
        select: metadata,
      });
    }, ownershipDeadline(context));
  }

  async requireOwned(context: OwnershipContext, id: string) {
    const conversation = await this.findOwned(context, id);
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async listOwned(context: OwnershipContext, limit = 20) {
    const owner = requireOwnership(context);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException();
    return this.database.transaction(async (db) => {
      const [clock] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      return db.aiConversation.findMany({
        where: { ...owner, expiresAt: { gt: clock.now } },
        select: metadata,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      });
    }, ownershipDeadline(context));
  }

  async listOwnedPage(context: OwnershipContext, limit = 20, cursor?: string) {
    const owner = requireOwnership(context),
      position = listPosition(cursor);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException();
    return this.database.transaction(async (db) => {
      const [clock] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const rows = await db.aiConversation.findMany({
        where: {
          ...owner,
          expiresAt: { gt: clock.now },
          ...(position
            ? {
                OR: [
                  { createdAt: { lt: position.createdAt } },
                  { createdAt: position.createdAt, id: { lt: position.id } },
                ],
              }
            : {}),
        },
        select: metadata,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      });
      const items = rows.slice(0, limit);
      return {
        items,
        nextCursor: rows.length > limit ? listCursor(items[items.length - 1]) : null,
      };
    }, ownershipDeadline(context));
  }
}
