import { Injectable } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../../prisma/prisma.service';
import { SOURCE_REGISTRY, SourceRegistration } from './source-registry';

/**
 * Accounting owns the set-up of every module that raises transactions in it. This makes sure a
 * module's source exists for a tenant, so an accountant can find and link it before the module has
 * done anything. Entity types are not provisioned - the accountant creates or picks their own.
 * Safe to call as often as needed.
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
    return this.ensureSource(tenantId, registration);
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
}
