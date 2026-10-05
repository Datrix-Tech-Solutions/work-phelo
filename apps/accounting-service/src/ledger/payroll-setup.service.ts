import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { RecordStatus } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingMasterDataService } from './accounting-master-data.service';
import {
  PAYROLL_ACCOUNT_ROLES,
  PayrollAccountRole,
  PayrollAccountRoleDefinition,
  payrollRole,
} from './payroll-account-roles';
import { SourceLedgerService } from './source-ledger.service';
import { SourceProvisioningService } from './source-transactions/source-provisioning.service';
import { SOURCE_REGISTRY } from './source-transactions/source-registry';

export type PayrollNotReadyReason =
  | 'NOT_LINKED'
  | 'NO_BASE_CURRENCY'
  | 'ACCOUNTS_MISSING';

type MappedAccount = { id: string; code: string; name: string };

/**
 * What an accountant sets up for payroll in Accounting: which of the tenant's own accounts
 * handles each payroll function, whether payroll is linked, and how it is posted. Payroll itself
 * has no accounting settings - it asks Accounting (`getStatus`) whether it is linked and ready.
 */
@Injectable()
export class PayrollSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masterData: AccountingMasterDataService,
    private readonly provisioning: SourceProvisioningService,
    private readonly sourceLedger: SourceLedgerService,
  ) {}

  /** The Payroll source, created unlinked the first time it is needed. */
  async getSource(tenantId: string) {
    return this.provisioning.ensure(tenantId, SOURCE_REGISTRY.HR!);
  }

  async getMappedAccounts(
    tenantId: string,
  ): Promise<Record<PayrollAccountRole, MappedAccount | null>> {
    const rows = await this.prisma.payrollAccountMapping.findMany({
      where: { tenantId },
      include: {
        glAccount: { select: { id: true, code: true, name: true } },
      },
    });
    const byRole = new Map(rows.map((row) => [row.role, row.glAccount]));
    return Object.fromEntries(
      PAYROLL_ACCOUNT_ROLES.map((role) => [
        role.key,
        byRole.get(role.key) ?? null,
      ]),
    ) as Record<PayrollAccountRole, MappedAccount | null>;
  }

  async autoPostEnabled(tenantId: string): Promise<boolean> {
    const setting = await this.prisma.payrollAccountingSetting.findUnique({
      where: { tenantId },
    });
    return setting?.autoPostOnApproval ?? false;
  }

  async setAutoPost(tenantId: string, autoPostOnApproval: boolean) {
    await this.prisma.payrollAccountingSetting.upsert({
      where: { tenantId },
      create: { tenantId, autoPostOnApproval },
      update: { autoPostOnApproval },
    });
    return { autoPostOnApproval };
  }

  /** Whether payroll can be linked right now, and if not, why and which accounts are missing. */
  async readiness(tenantId: string, linked: boolean) {
    const [mapped, config] = await Promise.all([
      this.getMappedAccounts(tenantId),
      this.masterData.getConfig(tenantId),
    ]);
    const missingRoles = PAYROLL_ACCOUNT_ROLES.filter(
      (role) => role.core && !mapped[role.key],
    ).map((role) => ({ key: role.key, label: role.label }));
    const baseCurrency = config.baseCurrency ?? null;
    const reason: PayrollNotReadyReason | null = !linked
      ? 'NOT_LINKED'
      : !baseCurrency
        ? 'NO_BASE_CURRENCY'
        : missingRoles.length > 0
          ? 'ACCOUNTS_MISSING'
          : null;
    return {
      baseCurrency,
      missingRoles,
      reason,
      // Ready ignores the link itself: it is what is needed *before* linking.
      readyToLink: !!baseCurrency && missingRoles.length === 0,
      ready: reason === null,
    };
  }

  /** Throws a message naming what is missing - used before the source can be linked. */
  async assertReadyToLink(tenantId: string) {
    const readiness = await this.readiness(tenantId, true);
    if (!readiness.baseCurrency) {
      throw new BadRequestException(
        'Set the base currency in Accounting settings before linking payroll.',
      );
    }
    if (readiness.missingRoles.length > 0) {
      throw new BadRequestException(
        `Choose an account for ${readiness.missingRoles
          .map((role) => role.label)
          .join(', ')} before linking payroll.`,
      );
    }
  }

  /** Unlinking would strand runs that are still being settled here. */
  async assertCanUnlink(tenantId: string, sourceTypeId: string) {
    const open = await this.openLiabilityCount(tenantId, sourceTypeId);
    if (open > 0) {
      throw new BadRequestException(
        `Payroll cannot be unlinked while ${open} payroll liabilit${
          open === 1 ? 'y is' : 'ies are'
        } still unpaid. Settle them first.`,
      );
    }
  }

  async openLiabilityCount(tenantId: string, sourceTypeId: string) {
    const summary = (
      await this.sourceLedger.getSettlementSummary(tenantId)
    ).get(sourceTypeId);
    return summary ? summary.entryCount - summary.paidCount : 0;
  }

  /** The answer payroll needs when a run is about to be approved. Never creates anything. */
  async getStatus(tenantId: string) {
    const source = await this.prisma.sourceType.findFirst({
      where: { tenantId, module: 'HR', name: SOURCE_REGISTRY.HR!.sourceName },
    });
    const linked = !!source?.isActive;
    if (!linked) {
      return {
        linked: false,
        ready: false,
        reason: 'NOT_LINKED' as PayrollNotReadyReason,
        missingRoles: [] as { key: string; label: string }[],
        autoPostOnApproval: false,
      };
    }
    const readiness = await this.readiness(tenantId, true);
    return {
      linked: true,
      ready: readiness.ready,
      reason: readiness.reason,
      missingRoles: readiness.missingRoles,
      autoPostOnApproval: await this.autoPostEnabled(tenantId),
    };
  }

  async getSetup(tenantId: string) {
    const source = await this.getSource(tenantId);
    const [readiness, mapped, autoPostOnApproval, entries, wageType] =
      await Promise.all([
        this.readiness(tenantId, source.isActive),
        this.getMappedAccounts(tenantId),
        this.autoPostEnabled(tenantId),
        this.prisma.sourceLedgerEntry.findMany({
          where: {
            tenantId,
            sourceTypeId: source.id,
            sourceRole: { not: null },
          },
          select: {
            sourceRole: true,
            amount: true,
            allocations: {
              where: { reversedAt: null },
              select: { amount: true },
            },
          },
        }),
        this.prisma.transactionType.findFirst({
          where: { tenantId, sourceTypeId: source.id },
          select: { id: true, code: true, name: true },
        }),
      ]);

    const openByRole = new Map<string, number>();
    for (const entry of entries) {
      const paid = entry.allocations.reduce(
        (sum, allocation) => sum + Number(allocation.amount.toString()),
        0,
      );
      if (Number(entry.amount.toString()) - paid > 0 && entry.sourceRole) {
        openByRole.set(
          entry.sourceRole,
          (openByRole.get(entry.sourceRole) ?? 0) + 1,
        );
      }
    }

    return {
      sourceTypeId: source.id,
      sourceName: source.name,
      linked: source.isActive,
      ready: readiness.ready,
      readyToLink: readiness.readyToLink,
      reason: readiness.reason,
      baseCurrency: readiness.baseCurrency,
      autoPostOnApproval,
      openLiabilityCount: await this.openLiabilityCount(tenantId, source.id),
      wagePaymentType: wageType,
      roles: PAYROLL_ACCOUNT_ROLES.map((role) => ({
        key: role.key,
        label: role.label,
        description: role.description,
        category: role.category,
        core: role.core,
        isLiability: role.isLiability,
        account: mapped[role.key],
        openItemCount: openByRole.get(role.key) ?? 0,
      })),
    };
  }

  /** Points a payroll function at one of the tenant's accounts, or clears it. Future runs only. */
  async setMapping(
    user: RequestUser,
    roleKey: string,
    glAccountId: string | null,
  ) {
    const role = this.requireRole(roleKey);
    if (glAccountId === null) {
      await this.prisma.payrollAccountMapping.deleteMany({
        where: { tenantId: user.tenantId, role: role.key },
      });
      return this.getSetup(user.tenantId);
    }

    const account = await this.prisma.gLAccount.findFirst({
      where: { id: glAccountId, tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        category: true,
        status: true,
        allowPosting: true,
      },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (account.category !== role.category) {
      throw new BadRequestException(
        `${role.label} needs a ${role.category.toLowerCase()} account, but ${account.name} is a ${account.category.toLowerCase()} account.`,
      );
    }
    if (account.status !== RecordStatus.ACTIVE || !account.allowPosting) {
      throw new BadRequestException(
        `${account.name} cannot be posted to - choose an active account that allows posting.`,
      );
    }

    await this.prisma.payrollAccountMapping.upsert({
      where: {
        tenantId_role: { tenantId: user.tenantId, role: role.key },
      },
      create: {
        tenantId: user.tenantId,
        role: role.key,
        glAccountId: account.id,
      },
      update: { glAccountId: account.id },
    });
    return this.getSetup(user.tenantId);
  }

  /** Maps a role only when nothing is mapped yet - so a shortcut never overrides a choice. */
  async mapIfUnmapped(tenantId: string, roleKey: string, glAccountId: string) {
    const role = this.requireRole(roleKey);
    await this.prisma.payrollAccountMapping.upsert({
      where: { tenantId_role: { tenantId, role: role.key } },
      create: { tenantId, role: role.key, glAccountId },
      update: {},
    });
  }

  requireRole(roleKey: string): PayrollAccountRoleDefinition {
    const role = payrollRole(roleKey);
    if (!role)
      throw new BadRequestException(`Unknown payroll account: ${roleKey}`);
    return role;
  }
}
