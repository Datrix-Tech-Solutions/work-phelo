import { BadRequestException } from '@nestjs/common';
import {
  PostingDirection,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

export type DocumentAdjustmentKind = 'TAX' | 'DEDUCTION' | 'CHARGE';

/** One tax, deduction or charge on a bill or invoice, as stored on the document. */
export type BreakdownEntry = {
  glAccountId: string;
  taxTypeId: string;
  amount: string;
  direction: PostingDirection;
  kind: DocumentAdjustmentKind;
  description?: string;
  /** Set on lines added on the form, as opposed to the type's own rule. */
  source?: 'FORM';
};

export interface FormTax {
  taxTypeId: string;
  glAccountId: string;
}

export interface FormAdjustment {
  kind: 'DEDUCTION' | 'CHARGE';
  glAccountId: string;
  amount: number;
  description?: string;
}

/** Works out the taxes, deductions and charges a user added on the form.
 *
 *  A tax is a tax type taken from the document amount at its rate — computed here, so the rate
 *  and its dates are the tax type's, not the client's. A deduction or charge is an amount the
 *  user typed. On the document's own side (a bill's debit, an invoice's credit) a tax or charge
 *  adds to what is owed and a deduction takes away from it, so a deduction sits on the control
 *  side. */
export async function buildFormBreakdown(
  prisma: PrismaService,
  tenantId: string,
  input: {
    subtotal: Prisma.Decimal;
    documentDate: string | undefined;
    /** The side the main (offset) line is on; a tax or charge goes here too. */
    mainSide: PostingDirection;
    /** The control (AP/AR) side; a deduction goes here. */
    controlSide: PostingDirection;
    taxes?: FormTax[];
    adjustments?: FormAdjustment[];
    /** The document's own accounts — a tax or adjustment may not post to them. */
    excludeAccountIds: string[];
  },
): Promise<{
  entries: BreakdownEntry[];
  taxAmount: Prisma.Decimal;
  netAdjustment: Prisma.Decimal;
}> {
  const taxes = input.taxes ?? [];
  const adjustments = input.adjustments ?? [];
  const entries: BreakdownEntry[] = [];
  const zero = new Prisma.Decimal(0);
  if (taxes.length === 0 && adjustments.length === 0) {
    return { entries, taxAmount: zero, netAdjustment: zero };
  }

  const assertPostable = async (glAccountId: string) => {
    if (input.excludeAccountIds.includes(glAccountId)) {
      throw new BadRequestException(
        "A tax, deduction or charge cannot post to the document's own accounts",
      );
    }
    const account = await prisma.gLAccount.findFirst({
      where: {
        id: glAccountId,
        tenantId,
        status: RecordStatus.ACTIVE,
        allowPosting: true,
        childAccounts: { none: {} },
        cashAccounts: { none: {} },
      },
      select: { id: true },
    });
    if (!account) {
      throw new BadRequestException(
        'The account for a tax, deduction or charge must be active and posting-enabled, and not a cash or bank account',
      );
    }
  };

  if (taxes.length > 0) {
    const ids = taxes.map((t) => t.taxTypeId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A tax can only be added once');
    }
    const taxTypes = await prisma.taxType.findMany({
      where: { tenantId, id: { in: ids } },
    });
    const on = input.documentDate ? new Date(input.documentDate) : new Date();
    for (const tax of taxes) {
      const taxType = taxTypes.find((t) => t.id === tax.taxTypeId);
      if (!taxType) throw new BadRequestException('Tax type not found');
      if (
        !taxType.isActive ||
        taxType.effectiveFrom > on ||
        (taxType.effectiveTo && taxType.effectiveTo < on)
      ) {
        throw new BadRequestException(
          `${taxType.name} is not in force on the document date`,
        );
      }
      await assertPostable(tax.glAccountId);
      entries.push({
        glAccountId: tax.glAccountId,
        taxTypeId: taxType.id,
        amount: input.subtotal
          .times(taxType.rate)
          .dividedBy(100)
          .toDecimalPlaces(2)
          .toString(),
        direction: input.mainSide,
        kind: 'TAX',
        description: taxType.name,
        source: 'FORM',
      });
    }
  }

  for (const adjustment of adjustments) {
    await assertPostable(adjustment.glAccountId);
    entries.push({
      glAccountId: adjustment.glAccountId,
      taxTypeId: '',
      amount: new Prisma.Decimal(adjustment.amount)
        .toDecimalPlaces(2)
        .toString(),
      direction:
        adjustment.kind === 'DEDUCTION' ? input.controlSide : input.mainSide,
      kind: adjustment.kind,
      description: adjustment.description,
      source: 'FORM',
    });
  }

  const sum = (kind: DocumentAdjustmentKind) =>
    entries
      .filter((e) => e.kind === kind)
      .reduce((total, e) => total.plus(e.amount), zero);
  return {
    entries,
    taxAmount: sum('TAX'),
    netAdjustment: sum('CHARGE').minus(sum('DEDUCTION')),
  };
}

/** Whether a stored breakdown has lines that were added on the form. */
export function hasFormBreakdown(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        (entry as { source?: unknown }).source === 'FORM',
    )
  );
}
