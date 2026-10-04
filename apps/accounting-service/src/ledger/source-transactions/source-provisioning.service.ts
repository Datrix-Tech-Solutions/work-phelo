import { Injectable } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SOURCE_REGISTRY, SourceRegistration } from './source-registry';

const PROVISIONING_ACTOR = 'service:accounting-provisioning';

/**
 * Accounting owns the set-up of every module that raises transactions in it. This makes sure a
 * module's source and default entity type exist for a tenant, so an accountant can find and link
 * them before the module has done anything. Safe to call as often as needed.
 */
@Injectable()
export class SourceProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  /** For every registered module the user's tenant has enabled. */
  async ensureForUser(user: RequestUser) {
    for (const registration of Object.values(SOURCE_REGISTRY)) {
      if (!registration || !user.moduleConfig?.[registration.moduleConfigKey])
        continue;
      await this.ensure(user.tenantId, registration);
    }
  }

  async ensure(tenantId: string, registration: SourceRegistration) {
    const source = await this.ensureSource(tenantId, registration);
    await this.ensureEntityType(tenantId, registration);
    return source;
  }

  /** A new source starts unlinked: the accountant links it once they have set up its transaction types. */
  private async ensureSource(
    tenantId: string,
    registration: SourceRegistration,
  ) {
    const where = {
      tenantId,
      module: registration.module,
      name: registration.sourceName,
    };
    const existing = await this.prisma.sourceType.findFirst({ where });
    if (existing) return existing;
    try {
      return await this.prisma.sourceType.create({
        data: { ...where, isActive: false },
      });
    } catch (error) {
      const raced = await this.prisma.sourceType.findFirst({ where });
      if (raced) return raced;
      throw error;
    }
  }

  private async ensureEntityType(
    tenantId: string,
    registration: SourceRegistration,
  ) {
    const { name, code } = registration.entityType;
    const existing = await this.prisma.entityType.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return existing;

    const create = (withCode: boolean) =>
      this.prisma.entityType.create({
        data: {
          tenantId,
          name,
          code: withCode ? code : null,
          isSystem: true,
          createdByUserId: PROVISIONING_ACTOR,
          updatedByUserId: PROVISIONING_ACTOR,
        },
      });

    try {
      return await create(true);
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
      ) {
        throw error;
      }
      // Either someone created it in the meantime, or the tenant already uses the code.
      const raced = await this.prisma.entityType.findFirst({
        where: { tenantId, name: { equals: name, mode: 'insensitive' } },
      });
      return raced ?? create(false);
    }
  }
}
