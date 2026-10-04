import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { SourceModule } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { SourceLedgerService } from './source-ledger.service';
import { SourceProvisioningService } from './source-transactions/source-provisioning.service';

@Injectable()
export class SourceTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceLedger: SourceLedgerService,
    private readonly provisioning: SourceProvisioningService,
  ) {}

  async list(user: RequestUser) {
    // A module the tenant has is already here to link - it doesn't have to link itself first.
    await this.provisioning.ensureForUser(user);
    const [items, summaries] = await Promise.all([
      this.prisma.sourceType.findMany({
        where: { tenantId: user.tenantId },
        orderBy: [{ module: 'asc' }, { name: 'asc' }],
      }),
      this.sourceLedger.getSettlementSummary(user.tenantId),
    ]);
    return items.map((item) =>
      this.toSourceTypeDto(
        item,
        summaries.get(item.id) ?? { entryCount: 0, paidCount: 0 },
      ),
    );
  }

  link(user: RequestUser, id: string) {
    return this.setActive(user, id, true);
  }

  unlink(user: RequestUser, id: string) {
    return this.setActive(user, id, false);
  }

  private async setActive(user: RequestUser, id: string, isActive: boolean) {
    const sourceType = await this.prisma.sourceType.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!sourceType) throw new NotFoundException('Source type not found');
    const updated = await this.prisma.sourceType.update({
      where: { id_tenantId: { id, tenantId: user.tenantId } },
      data: { isActive },
    });
    return this.toSourceTypeDto(updated);
  }

  /** Called by a module's own integration setup once it completes (e.g. HR's payroll GL
   *  account seed) — a source type is never created from the accounting settings UI itself.
   *  Idempotent: creates the row the first time only. If it already exists, its `isActive`
   *  is left exactly as the tenant last set it — an explicit unlink must stick, not get
   *  silently reversed just because the owning module's setup ran again. */
  async ensureExists(
    tenantId: string,
    sourceModule: SourceModule,
    name: string,
  ) {
    const existing = await this.prisma.sourceType.findFirst({
      where: { tenantId, module: sourceModule, name },
    });
    if (existing) return existing;
    try {
      return await this.prisma.sourceType.create({
        data: { tenantId, module: sourceModule, name },
      });
    } catch {
      const existingAfterRace = await this.prisma.sourceType.findFirst({
        where: { tenantId, module: sourceModule, name },
      });
      if (existingAfterRace) return existingAfterRace;
      throw new Error('Failed to ensure source type exists');
    }
  }

  private toSourceTypeDto(
    sourceType: {
      id: string;
      module: SourceModule;
      name: string;
      isActive: boolean;
    },
    summary: { entryCount: number; paidCount: number } = {
      entryCount: 0,
      paidCount: 0,
    },
  ) {
    return {
      id: sourceType.id,
      module: sourceType.module,
      name: sourceType.name,
      isActive: sourceType.isActive,
      entryCount: summary.entryCount,
      paidCount: summary.paidCount,
    };
  }
}
