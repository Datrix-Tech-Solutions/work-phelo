import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { SourceModule } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { PayrollSetupService } from './payroll-setup.service';
import { SourceLedgerService } from './source-ledger.service';
import { SourceProvisioningService } from './source-transactions/source-provisioning.service';

@Injectable()
export class SourceTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceLedger: SourceLedgerService,
    private readonly provisioning: SourceProvisioningService,
    private readonly payrollSetup: PayrollSetupService,
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
    if (sourceType.module === 'HR') {
      // Payroll is linked only once its accounts are chosen, and not unlinked while runs are
      // still being settled here.
      if (isActive) await this.payrollSetup.assertReadyToLink(user.tenantId);
      else await this.payrollSetup.assertCanUnlink(user.tenantId, id);
    }
    const updated = await this.prisma.sourceType.update({
      where: { id_tenantId: { id, tenantId: user.tenantId } },
      data: { isActive },
    });
    return this.toSourceTypeDto(updated);
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
