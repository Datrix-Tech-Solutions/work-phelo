import { Injectable } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  GLAccountCategory,
  NormalBalance,
  SourceModule,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingMasterDataService } from './accounting-master-data.service';
import { SeedPayrollAccountsDto } from './dto/payroll-integration.dto';
import { SourceTypesService } from './source-types.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly masterData: AccountingMasterDataService,
    private readonly sourceTypes: SourceTypesService,
  ) {}

  /** Idempotent — safe to call every time the tenant clicks "Create Payroll GL Accounts".
   *  Ensures (in order): the standard classification hierarchy, the payroll GL account
   *  groups/leaf accounts the tenant didn't opt out of, the "Employee" entity type, one
   *  aggregate entity of that type, and the "HR / Payroll" source type entry. */
  async seedAccounts(user: RequestUser, dto: SeedPayrollAccountsDto) {
    await this.masterData.seedStandardAccountHierarchy(user);

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

    const entityType = await this.ensureEmployeeEntityType(user);
    const entity = await this.ensureAggregatePayrollEntity(user);
    const sourceType = await this.sourceTypes.ensureExists(
      user.tenantId,
      SOURCE_MODULE_HR,
      SOURCE_TYPE_PAYROLL,
    );

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
