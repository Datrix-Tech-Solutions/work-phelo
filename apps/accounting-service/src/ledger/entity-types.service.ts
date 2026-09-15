import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma, SubledgerType } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEntityTypeDto } from './dto/entity-types.dto';

// The two the Entities page always starts with — matches the two-only default we settled
// on (everything else must be created here first before it's usable elsewhere).
const DEFAULT_ENTITY_TYPES = ['Customer', 'Vendor'] as const;

@Injectable()
export class EntityTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async listEntityTypes(user: RequestUser) {
    let entityTypes = await this.prisma.entityType.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: 'asc' },
    });
    if (!entityTypes.some((t) => t.isSystem)) {
      await this.seedDefaultEntityTypes(user);
      entityTypes = await this.prisma.entityType.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: 'asc' },
      });
    }

    const counts = await this.prisma.subledgerAccount.groupBy({
      by: ['type'],
      where: { tenantId: user.tenantId },
      _count: { _all: true },
    });
    const countByType = new Map(counts.map((c) => [c.type, c._count._all]));
    return entityTypes.map((t) => this.toEntityTypeDto(t, countByType));
  }

  async createEntityType(user: RequestUser, dto: CreateEntityTypeDto) {
    try {
      const entityType = await this.prisma.entityType.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          accountingRelation: dto.accountingRelation,
          isSystem: false,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      await this.recordAudit(user, 'ENTITY_TYPE_CREATE', entityType.id, {
        name: entityType.name,
      });
      return this.toEntityTypeDto(entityType, new Map());
    } catch (error) {
      this.rethrowUnique(error, 'Entity type name already exists');
    }
  }

  async deleteEntityType(user: RequestUser, entityTypeId: string) {
    const entityType = await this.findEntityType(user.tenantId, entityTypeId);
    if (entityType.isSystem) {
      throw new BadRequestException('System types cannot be deleted');
    }

    const matched = this.matchingSubledgerType(entityType.name);
    if (matched) {
      const inUse = await this.prisma.subledgerAccount.count({
        where: { tenantId: user.tenantId, type: matched },
      });
      if (inUse > 0) {
        throw new ConflictException(
          `${inUse} ${inUse === 1 ? 'entity uses' : 'entities use'} this type ` +
            'and it cannot be deleted',
        );
      }
    }

    await this.prisma.entityType.delete({
      where: { id_tenantId: { id: entityType.id, tenantId: user.tenantId } },
    });
    await this.recordAudit(user, 'ENTITY_TYPE_DELETE', entityType.id, {
      name: entityType.name,
    });
  }

  private async seedDefaultEntityTypes(user: RequestUser) {
    for (const name of DEFAULT_ENTITY_TYPES) {
      try {
        await this.prisma.entityType.create({
          data: {
            tenantId: user.tenantId,
            name,
            isSystem: true,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
        });
      } catch (error) {
        if (
          !(
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          )
        ) {
          throw error;
        }
      }
    }
  }

  private async findEntityType(tenantId: string, id: string) {
    const entityType = await this.prisma.entityType.findFirst({
      where: { id, tenantId },
    });
    if (!entityType) throw new NotFoundException('Entity type not found');
    return entityType;
  }

  // Entity Types is deliberately a broader, tenant-editable list than the fixed
  // SubledgerType enum SubledgerAccount.type actually stores — only a name matching one
  // of its members (Customer, Vendor, ...) corresponds to real, postable entities today.
  private matchingSubledgerType(name: string): SubledgerType | null {
    const candidate = name.trim().toUpperCase();
    return (Object.values(SubledgerType) as string[]).includes(candidate)
      ? (candidate as SubledgerType)
      : null;
  }

  private toEntityTypeDto(
    entityType: {
      id: string;
      name: string;
      accountingRelation: string;
      isSystem: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    countByType: Map<SubledgerType, number>,
  ) {
    const matched = this.matchingSubledgerType(entityType.name);
    return {
      id: entityType.id,
      name: entityType.name,
      accountingRelation: entityType.accountingRelation,
      isSystem: entityType.isSystem,
      entityCount: matched ? (countByType.get(matched) ?? 0) : 0,
      createdAt: entityType.createdAt.toISOString(),
      updatedAt: entityType.updatedAt.toISOString(),
    };
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }

  private async recordAudit(
    user: RequestUser,
    action: string,
    entityId: string,
    changedFields?: unknown,
  ) {
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action,
        entityType: 'EntityType',
        entityId,
        changedFields: JSON.parse(
          JSON.stringify(changedFields ?? {}),
        ) as Prisma.InputJsonValue,
      },
    });
  }
}
