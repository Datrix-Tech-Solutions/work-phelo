import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AdjustmentCategory,
  GLAccountCategory,
  JournalEntryType,
  NormalBalance,
  SourceModule,
  TransactionTypeCategory,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingHrClient } from '../hr-integration/client/hr.client';
import { AccountingMasterDataService } from './accounting-master-data.service';
import {
  PostPayrollAccrualDto,
  SeedPayrollAccountItemDto,
  SeedPayrollAccountsDto,
} from './dto/payroll-integration.dto';
import { JournalLineDto } from './dto/accounting.dto';
import { JournalsService } from './journals.service';
import { SourceLedgerService } from './source-ledger.service';
import { SourceTypesService } from './source-types.service';

const PAYROLL_LIABILITIES_GROUP_NAME = 'Payroll Liabilities';
const PAYROLL_EXPENSE_GROUP_NAME = 'Payroll Expense';

type PayrollGlAccountKey =
  | 'salariesWagesExpense'
  | 'employerSocialSecurityExpense'
  | 'netPayPayable'
  | 'incomeTaxPayable'
  | 'socialSecurityPayable'
  | 'statutoryPensionPayable'
  | 'otherDeductionsPayable';

const PAYROLL_GL_ACCOUNT_NAMES: Record<PayrollGlAccountKey, string> = {
  salariesWagesExpense: 'Salaries and Wages Expense',
  employerSocialSecurityExpense:
    'Employer Social Security Contribution Expense',
  netPayPayable: 'Net Pay Payable',
  incomeTaxPayable: 'Income Tax Payable',
  socialSecurityPayable: 'Social Security Payable',
  statutoryPensionPayable: 'Statutory Pension Payable',
  otherDeductionsPayable: 'Other Deductions Payable',
};

// Short label for each liability's SourceLedgerEntry description — each settles on its own
// schedule (net pay this week, tax remittance next month, ...), so every one gets its own
// entry rather than one lump entry per accrual.
const PAYROLL_LEDGER_ENTRY_LABELS: Partial<
  Record<PayrollGlAccountKey, string>
> = {
  netPayPayable: 'Net Pay',
  incomeTaxPayable: 'Income Tax',
  socialSecurityPayable: 'Social Security',
  statutoryPensionPayable: 'Statutory Pension',
  otherDeductionsPayable: 'Other Deductions',
};

const NORMAL_BALANCE_BY_CATEGORY: Record<GLAccountCategory, NormalBalance> = {
  [GLAccountCategory.ASSET]: NormalBalance.DEBIT,
  [GLAccountCategory.LIABILITY]: NormalBalance.CREDIT,
  [GLAccountCategory.EQUITY]: NormalBalance.CREDIT,
  [GLAccountCategory.REVENUE]: NormalBalance.CREDIT,
  [GLAccountCategory.EXPENSE]: NormalBalance.DEBIT,
};

const PAYROLL_ENTITY_TYPE_NAME = 'Employee';
const PAYROLL_ENTITY_CODE = 'PAYROLL-EMP';
const PAYROLL_ENTITY_NAME = 'Employees (Payroll)';
const SOURCE_MODULE_HR = SourceModule.HR;
const SOURCE_TYPE_PAYROLL = 'Payroll';

// A toggleable seed item alongside the GL accounts — same include/exclude pattern, just
// creating a TransactionType instead of a GLAccount. Money out to settle a liability, so
// PAYABLE, matching the existing generic "Payment" type's own categorization.
const WAGE_PAYMENT_TYPE_KEY = 'wage-payment-transaction-type';
const WAGE_PAYMENT_TYPE_CODE = 'PR-WAGE';
const WAGE_PAYMENT_TYPE_NAME = 'Wage Payment';

interface PayrollAccountGroupTemplate {
  classificationCode: string;
  groupCode: string;
  groupName: string;
  category: GLAccountCategory;
  children: { key: string; name: string }[];
}

// Preferred codes — the group's band width is its trailing zeros (1130 -> band 1130-1139),
// and every group here nests under an already-seeded standard classification band (1100
// Current Assets, 2100 Current Liabilities, 5100 Operating Expense) so it stays within
// range. Deliberately excludes "Other Employer-Borne Payroll Cost" and "Other
// Statutory/Third-Party Payable" — not every tenant/run uses those, so they're added
// on-demand instead of seeded.
const PAYROLL_ACCOUNT_GROUPS: PayrollAccountGroupTemplate[] = [
  {
    classificationCode: '1100',
    groupCode: '1130',
    groupName: 'Staff Advances / Employee Loans',
    category: GLAccountCategory.ASSET,
    children: [
      { key: 'staff-advances-receivable', name: 'Staff Advances Receivable' },
      { key: 'employee-loans-receivable', name: 'Employee Loans Receivable' },
    ],
  },
  {
    classificationCode: '2100',
    groupCode: '2120',
    groupName: 'Payroll Liabilities',
    category: GLAccountCategory.LIABILITY,
    children: [
      { key: 'net-pay-payable', name: 'Net Pay Payable' },
      { key: 'income-tax-payable', name: 'Income Tax Payable' },
      { key: 'social-security-payable', name: 'Social Security Payable' },
      { key: 'statutory-pension-payable', name: 'Statutory Pension Payable' },
      { key: 'other-deductions-payable', name: 'Other Deductions Payable' },
    ],
  },
  {
    classificationCode: '5100',
    groupCode: '5120',
    groupName: 'Payroll Expense',
    category: GLAccountCategory.EXPENSE,
    children: [
      { key: 'salaries-wages-expense', name: 'Salaries and Wages Expense' },
      {
        key: 'employer-social-security-expense',
        name: 'Employer Social Security Contribution Expense',
      },
      {
        key: 'employer-pension-expense',
        name: 'Employer Pension Contribution Expense',
      },
    ],
  },
];

// Money arrives as plain JS numbers (parsed from Decimal strings over HTTP) and gets summed/
// subtracted to derive the employer-SSNIT and Social Security lines — floating-point drift
// (e.g. 3740.0000000000005) must be rounded away before amounts are compared/posted, or the
// journal's debit/credit totals can differ by a cent and get rejected as unbalanced.
function round2(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

// Mirrors AccountingMasterDataService's private codeBand check — band width is the code's
// trailing zeros (1130 -> width 10, band 1130-1139; 1100 -> width 100, band 1100-1199).
function codeBandWidth(code: number): number {
  let width = 1;
  while (width < 1000 && code % (width * 10) === 0) width *= 10;
  return width;
}

function findAvailableGroupCode(
  preferredGroupCode: number,
  childCount: number,
  usedCodes: Set<number>,
): number {
  const width = codeBandWidth(preferredGroupCode);
  const maxShift = width * 9;
  for (let shift = 0; shift <= maxShift; shift += width) {
    const groupCode = preferredGroupCode + shift;
    const bandFree = [
      groupCode,
      ...Array.from({ length: childCount }, (_, i) => groupCode + i + 1),
    ].every((code) => !usedCodes.has(code));
    if (bandFree) return groupCode;
  }
  return preferredGroupCode;
}

@Injectable()
export class PayrollIntegrationService {
  private readonly logger = new Logger(PayrollIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly masterData: AccountingMasterDataService,
    private readonly sourceTypes: SourceTypesService,
    private readonly journals: JournalsService,
    private readonly sourceLedger: SourceLedgerService,
    private readonly hrClient: AccountingHrClient,
  ) {}

  /** Idempotent — safe to call every time the tenant clicks "Create Payroll GL Accounts".
   *  Ensures (in order): the standard classification hierarchy, the payroll GL account
   *  groups/leaf accounts the tenant didn't opt out of, the "Employee" entity type, one
   *  aggregate entity of that type, and the "HR / Payroll" source type entry. */
  async seedAccounts(user: RequestUser, dto: SeedPayrollAccountsDto) {
    await this.masterData.seedStandardAccountHierarchy(user);
    const sourceType = await this.sourceTypes.ensureExists(
      user.tenantId,
      SOURCE_MODULE_HR,
      SOURCE_TYPE_PAYROLL,
    );

    const itemByKey = new Map(dto.items.map((item) => [item.key, item]));
    const [existingGroups, existingAccounts] = await Promise.all([
      this.prisma.accountGroup.findMany({
        where: { tenantId: user.tenantId },
        select: { code: true },
      }),
      this.prisma.gLAccount.findMany({
        where: { tenantId: user.tenantId },
        select: { code: true },
      }),
    ]);
    const usedCodes = new Set(
      [...existingGroups, ...existingAccounts].map((a) => Number(a.code)),
    );

    const accountResults: {
      key: string;
      code: string;
      name: string;
      status: 'created' | 'existing' | 'excluded';
    }[] = [];

    for (const template of PAYROLL_ACCOUNT_GROUPS) {
      const classification = await this.prisma.accountClassification.findUnique(
        {
          where: {
            tenantId_code: {
              tenantId: user.tenantId,
              code: template.classificationCode,
            },
          },
        },
      );
      if (!classification) {
        // Standard hierarchy seed above guarantees this in the normal case; skip this
        // group defensively rather than throw if a tenant somehow deleted it.
        for (const child of template.children) {
          accountResults.push({
            key: child.key,
            code: '',
            name: itemByKey.get(child.key)?.name ?? child.name,
            status: 'excluded',
          });
        }
        continue;
      }

      const includedChildren = template.children.filter(
        (child) => itemByKey.get(child.key)?.include !== false,
      );

      // Reuse a group we already created on a prior seed run (matched by name within the
      // classification, not by code) rather than drifting to a new code every time.
      let group = await this.prisma.accountGroup.findFirst({
        where: {
          tenantId: user.tenantId,
          classificationId: classification.id,
          name: template.groupName,
        },
      });
      if (!group && includedChildren.length > 0) {
        const groupCode = findAvailableGroupCode(
          Number(template.groupCode),
          template.children.length,
          usedCodes,
        );
        usedCodes.add(groupCode);
        group = await this.prisma.accountGroup.create({
          data: {
            tenantId: user.tenantId,
            classificationId: classification.id,
            code: String(groupCode),
            name: template.groupName,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
        });
      }

      for (const child of template.children) {
        const requestItem = itemByKey.get(child.key);
        const name = requestItem?.name?.trim() || child.name;
        if (requestItem?.include === false || !group) {
          accountResults.push({
            key: child.key,
            code: '',
            name,
            status: 'excluded',
          });
          continue;
        }

        const existing = await this.prisma.gLAccount.findFirst({
          where: { tenantId: user.tenantId, accountGroupId: group.id, name },
        });
        if (existing) {
          accountResults.push({
            key: child.key,
            code: existing.code,
            name: existing.name,
            status: 'existing',
          });
          continue;
        }

        const code = findAvailableGroupCode(
          Number(group.code) + 1,
          0,
          usedCodes,
        );
        usedCodes.add(code);
        const account = await this.prisma.gLAccount.create({
          data: {
            tenantId: user.tenantId,
            code: String(code),
            name,
            category: template.category,
            normalBalance: NORMAL_BALANCE_BY_CATEGORY[template.category],
            classificationId: classification.id,
            accountGroupId: group.id,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
        });
        accountResults.push({
          key: child.key,
          code: account.code,
          name: account.name,
          status: 'created',
        });
      }
    }

    accountResults.push(
      await this.seedWagePaymentTransactionType(user, sourceType.id, itemByKey),
    );

    const entityType = await this.ensureEmployeeEntityType(user);
    const entity = await this.ensureAggregatePayrollEntity(user);

    return {
      accounts: accountResults,
      entityType: { id: entityType.id, name: entityType.name },
      entity: { id: entity.id, code: entity.code, name: entity.name },
      sourceType: {
        id: sourceType.id,
        module: sourceType.module,
        name: sourceType.name,
      },
    };
  }

  /** Called by hr-service (via the internal service-to-service auth surface) once a payroll
   *  run is approved. Idempotent per run — a repeated call for the same `payrollRunId` is a
   *  no-op if the journal already exists. Requires the payroll GL accounts to already be
   *  seeded (via `seedAccounts` above); throws a clear error if they aren't. */
  async postAccrual(callingService: string, dto: PostPayrollAccrualDto) {
    const user = this.internalRequestUser(dto.tenantId, callingService);
    const accounts = await this.findPayrollGlAccounts(dto.tenantId);

    const employerSSNIT = round2(dto.totalEmployerCost - dto.totalGross);
    const socialSecurityPayable = round2(
      dto.totalTier1 + dto.totalTier2 + employerSSNIT,
    );

    const debitLines: { key: PayrollGlAccountKey; amount: number }[] = [
      { key: 'salariesWagesExpense', amount: round2(dto.totalGross) },
      { key: 'employerSocialSecurityExpense', amount: employerSSNIT },
    ];
    const creditLines: { key: PayrollGlAccountKey; amount: number }[] = [
      { key: 'netPayPayable', amount: round2(dto.totalNet) },
      { key: 'incomeTaxPayable', amount: round2(dto.totalPAYE) },
      { key: 'socialSecurityPayable', amount: socialSecurityPayable },
      { key: 'statutoryPensionPayable', amount: round2(dto.totalTier3) },
      {
        key: 'otherDeductionsPayable',
        amount: round2(dto.totalOtherDeductions),
      },
    ];

    const missing = [...debitLines, ...creditLines]
      .filter((line) => line.amount > 0 && !accounts[line.key])
      .map((line) => PAYROLL_GL_ACCOUNT_NAMES[line.key]);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Payroll GL accounts are not set up (missing: ${missing.join(', ')}) — visit ` +
          'Payroll Settings and click "Create Payroll GL Accounts" first.',
      );
    }

    const lines: JournalLineDto[] = [
      ...debitLines
        .filter((line) => line.amount > 0)
        .map((line) => ({
          glAccountId: accounts[line.key]!.id,
          debit: line.amount,
        })),
      ...creditLines
        .filter((line) => line.amount > 0)
        .map((line) => ({
          glAccountId: accounts[line.key]!.id,
          credit: line.amount,
        })),
    ];

    const config = await this.masterData.getConfig(dto.tenantId);
    if (!config.baseCurrency) {
      throw new BadRequestException(
        'Accounting is not configured for this tenant (no base currency set) — visit ' +
          'Accounting Settings first.',
      );
    }
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        tenantId: dto.tenantId,
        status: 'OPEN',
        startDate: { lte: new Date(dto.transactionDate) },
        endDate: { gte: new Date(dto.transactionDate) },
      },
    });
    if (!fiscalPeriod) {
      throw new BadRequestException(
        `No open fiscal period covers ${dto.transactionDate} — payroll accrual cannot be posted.`,
      );
    }

    let journal = await this.journals.create(user, {
      transactionDate: dto.transactionDate,
      fiscalPeriodId: fiscalPeriod.id,
      transactionCurrency: config.baseCurrency,
      entryType: JournalEntryType.ADJUSTING,
      adjustmentCategory: AdjustmentCategory.ACCRUAL,
      description: `Payroll accrual — ${dto.periodLabel}`,
      idempotencyKey: `payroll-accrual:${dto.payrollRunId}`,
      sourceModule: 'HR',
      sourceRecordType: 'PAYROLL_RUN',
      sourceRecordId: dto.payrollRunId,
      lines,
    });

    if (dto.autoPost && journal.status !== 'POSTED') {
      journal = await this.journals.post(user, journal.id);
    }

    // One open item per liability line, not one lump entry — each settles independently, on
    // its own schedule (net pay this week, tax remittance next month, ...). Idempotent: safe
    // to call again for the same run since journals.create() above already short-circuited
    // to the existing journal via its idempotency key, so re-running this would create
    // duplicate ledger entries against that same journal — guard by checking none exist yet.
    const existingEntries = await this.prisma.sourceLedgerEntry.count({
      where: { tenantId: dto.tenantId, journalEntryId: journal.id },
    });
    if (existingEntries === 0) {
      const sourceType = await this.sourceTypes.ensureExists(
        dto.tenantId,
        SOURCE_MODULE_HR,
        SOURCE_TYPE_PAYROLL,
      );
      for (const line of creditLines) {
        const label = PAYROLL_LEDGER_ENTRY_LABELS[line.key];
        if (line.amount <= 0 || !label) continue;
        await this.sourceLedger.createEntry({
          tenantId: dto.tenantId,
          sourceTypeId: sourceType.id,
          glAccountId: accounts[line.key]!.id,
          journalEntryId: journal.id,
          sourceRecordId: dto.payrollRunId,
          description: `${label} — ${dto.periodLabel}`,
          amount: line.amount,
          currency: config.baseCurrency,
        });
      }
    }

    return journal;
  }

  /** Per-liability-line settlement status for one payroll run — used by hr-service to show
   *  the employer a settlement progress view once the run is linked to Accounting. */
  async getSettlementStatus(tenantId: string, payrollRunId: string) {
    const accounts = await this.findPayrollGlAccounts(tenantId);
    const entries = await this.sourceLedger.listBySourceRecord(
      tenantId,
      payrollRunId,
    );
    const byGlAccountId = new Map(entries.map((e) => [e.glAccount.id, e]));

    const pick = (key: PayrollGlAccountKey) => {
      const accountId = accounts[key]?.id;
      const entry = accountId ? byGlAccountId.get(accountId) : undefined;
      if (!entry) return null;
      return {
        paymentState: entry.paymentState,
        amount: entry.amount,
        outstandingAmount: entry.outstandingAmount,
      };
    };

    return {
      netPay: pick('netPayPayable'),
      incomeTax: pick('incomeTaxPayable'),
      socialSecurity: pick('socialSecurityPayable'),
    };
  }

  /** Called (by the generic Source Ledger flow) right after a payment settles an entry
   *  belonging to HR/Payroll — reacts only when that entry is this run's Net Pay line
   *  (releases payslips) and/or when every liability line for the run is now settled
   *  (marks the run fully paid). A notification failure is logged, not thrown — the
   *  payment itself already succeeded and must not be rolled back over a side effect. */
  async handleSourceLedgerEntrySettled(
    tenantId: string,
    entry: { sourceRecordId: string | null; glAccount: { id: string } },
  ) {
    const payrollRunId = entry.sourceRecordId;
    if (!payrollRunId) return;

    const accounts = await this.findPayrollGlAccounts(tenantId);
    if (entry.glAccount.id === accounts.netPayPayable?.id) {
      try {
        await this.hrClient.notifyNetPaySettled(tenantId, payrollRunId);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to notify HR of net pay settlement for payroll run ${payrollRunId}: ${reason}`,
        );
      }
    }

    const siblings = await this.sourceLedger.listBySourceRecord(
      tenantId,
      payrollRunId,
    );
    const allSettled =
      siblings.length > 0 &&
      siblings.every((sibling) => sibling.paymentState === 'PAID');
    if (allSettled) {
      try {
        await this.hrClient.notifyFullySettled(tenantId, payrollRunId);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to notify HR of full settlement for payroll run ${payrollRunId}: ${reason}`,
        );
      }
    }
  }

  private async findPayrollGlAccounts(
    tenantId: string,
  ): Promise<Record<PayrollGlAccountKey, { id: string } | null>> {
    const accounts = await this.prisma.gLAccount.findMany({
      where: {
        tenantId,
        accountGroup: {
          name: {
            in: [PAYROLL_LIABILITIES_GROUP_NAME, PAYROLL_EXPENSE_GROUP_NAME],
          },
        },
      },
      select: { id: true, name: true },
    });
    const byName = new Map(
      accounts.map((a) => [a.name.trim().toLowerCase(), a]),
    );

    return Object.fromEntries(
      (
        Object.entries(PAYROLL_GL_ACCOUNT_NAMES) as [
          PayrollGlAccountKey,
          string,
        ][]
      ).map(([key, name]) => [key, byName.get(name.toLowerCase()) ?? null]),
    ) as Record<PayrollGlAccountKey, { id: string } | null>;
  }

  private internalRequestUser(
    tenantId: string,
    callingService: string,
  ): RequestUser {
    return {
      id: `service:${callingService.slice(0, 80)}`,
      email: '',
      role: 'SYSTEM',
      tenantId,
      tenantSlug: '',
      tenantName: '',
      firstName: callingService,
      moduleConfig: {},
      featureConfig: {},
      permissions: [],
    };
  }

  private async seedWagePaymentTransactionType(
    user: RequestUser,
    sourceTypeId: string,
    itemByKey: Map<string, SeedPayrollAccountItemDto>,
  ): Promise<{
    key: string;
    code: string;
    name: string;
    status: 'created' | 'existing' | 'excluded';
  }> {
    const requestItem = itemByKey.get(WAGE_PAYMENT_TYPE_KEY);
    const name = requestItem?.name?.trim() || WAGE_PAYMENT_TYPE_NAME;
    if (requestItem?.include === false) {
      return { key: WAGE_PAYMENT_TYPE_KEY, code: '', name, status: 'excluded' };
    }

    const existing = await this.prisma.transactionType.findFirst({
      where: { tenantId: user.tenantId, sourceTypeId },
    });
    if (existing) {
      return {
        key: WAGE_PAYMENT_TYPE_KEY,
        code: existing.code,
        name: existing.name,
        status: 'existing',
      };
    }

    const created = await this.prisma.transactionType.create({
      data: {
        tenantId: user.tenantId,
        code: WAGE_PAYMENT_TYPE_CODE,
        name,
        category: TransactionTypeCategory.PAYABLE,
        postsToCashbook: true,
        sourceTypeId,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    return {
      key: WAGE_PAYMENT_TYPE_KEY,
      code: created.code,
      name: created.name,
      status: 'created',
    };
  }

  private async ensureEmployeeEntityType(user: RequestUser) {
    const existing = await this.prisma.entityType.findFirst({
      where: {
        tenantId: user.tenantId,
        name: { equals: PAYROLL_ENTITY_TYPE_NAME, mode: 'insensitive' },
      },
    });
    if (existing) return existing;
    try {
      return await this.prisma.entityType.create({
        data: {
          tenantId: user.tenantId,
          name: PAYROLL_ENTITY_TYPE_NAME,
          isSystem: false,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch {
      const existingAfterRace = await this.prisma.entityType.findFirst({
        where: {
          tenantId: user.tenantId,
          name: { equals: PAYROLL_ENTITY_TYPE_NAME, mode: 'insensitive' },
        },
      });
      if (existingAfterRace) return existingAfterRace;
      throw new Error('Failed to ensure the Employee entity type exists');
    }
  }

  private async ensureAggregatePayrollEntity(user: RequestUser) {
    const existing = await this.prisma.subledgerAccount.findFirst({
      where: { tenantId: user.tenantId, code: PAYROLL_ENTITY_CODE },
    });
    if (existing) return existing;
    try {
      return await this.prisma.subledgerAccount.create({
        data: {
          tenantId: user.tenantId,
          code: PAYROLL_ENTITY_CODE,
          name: PAYROLL_ENTITY_NAME,
          type: PAYROLL_ENTITY_TYPE_NAME,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch {
      const existingAfterRace = await this.prisma.subledgerAccount.findFirst({
        where: { tenantId: user.tenantId, code: PAYROLL_ENTITY_CODE },
      });
      if (existingAfterRace) return existingAfterRace;
      throw new Error('Failed to ensure the aggregate payroll entity exists');
    }
  }
}
