import { BadRequestException } from '@nestjs/common';
import { CashbookLineKind, Prisma } from '../../prisma/generated/client';
import { assertQuantityPriceMatchesAmount } from './quantity-price.util';

export interface NormalizedEntryLine {
  kind: CashbookLineKind;
  glAccountId: string;
  amount: Prisma.Decimal;
  quantity?: number;
  unitPrice?: number;
  description?: string;
}

interface EntryLineInput {
  kind?: CashbookLineKind;
  glAccountId: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  description?: string;
}

/** What a line does to the cash that moves: an item or charge adds to it, a deduction takes
 *  away. Used for the entry's net amount; the journal side of each line follows from this and
 *  the entry's direction. */
export function lineSign(kind: CashbookLineKind): 1 | -1 {
  return kind === CashbookLineKind.DEDUCTION ? -1 : 1;
}

/** The cash that moves for a set of lines: items + charges − deductions. */
export function netCashAmount(
  lines: { kind: CashbookLineKind; amount: Prisma.Decimal }[],
): Prisma.Decimal {
  return lines.reduce(
    (sum, line) => sum.plus(line.amount.times(lineSign(line.kind))),
    new Prisma.Decimal(0),
  );
}

/** What a direct receipt or payment posts to, as a list of lines plus the net cash that moves.
 *  A request sends either `lines` or the older single `offsetGlAccountId` + `amount`; both end
 *  up as lines, and the entry's amount is always the net of them. */
export function normalizeEntryLines(input: {
  amount?: number;
  quantity?: number;
  unitPrice?: number;
  offsetGlAccountId?: string;
  offsetSubledgerAccountId?: string;
  lines?: EntryLineInput[];
}): { lines: NormalizedEntryLine[]; total: Prisma.Decimal } {
  if (input.lines?.length) {
    if (input.offsetGlAccountId) {
      throw new BadRequestException(
        'Send either lines or offsetGlAccountId, not both',
      );
    }
    if (input.quantity !== undefined || input.unitPrice !== undefined) {
      throw new BadRequestException(
        'With lines, put quantity and unitPrice on each line',
      );
    }
    if (
      input.offsetSubledgerAccountId &&
      (input.lines[0].kind ?? CashbookLineKind.ITEM) !== CashbookLineKind.ITEM
    ) {
      throw new BadRequestException(
        'The subledger account goes on the first line, which must be an item',
      );
    }
    const lines = input.lines.map((line): NormalizedEntryLine => {
      const kind = line.kind ?? CashbookLineKind.ITEM;
      if (
        kind !== CashbookLineKind.ITEM &&
        (line.quantity !== undefined || line.unitPrice !== undefined)
      ) {
        throw new BadRequestException(
          'Deductions and charges take an amount only',
        );
      }
      assertQuantityPriceMatchesAmount(line);
      return {
        kind,
        glAccountId: line.glAccountId,
        amount: new Prisma.Decimal(line.amount),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        description: line.description,
      };
    });
    if (!lines.some((line) => line.kind === CashbookLineKind.ITEM)) {
      throw new BadRequestException('At least one line must be an item');
    }
    const total = netCashAmount(lines);
    if (total.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'The deductions leave nothing to pay or receive — the net amount must be above zero',
      );
    }
    if (
      input.amount !== undefined &&
      !total.equals(new Prisma.Decimal(input.amount))
    ) {
      throw new BadRequestException(
        `amount must equal the net of the lines (${total.toFixed(2)})`,
      );
    }
    return { lines, total };
  }

  if (!input.offsetGlAccountId || input.amount === undefined) {
    throw new BadRequestException(
      'Send lines, or offsetGlAccountId and amount',
    );
  }
  assertQuantityPriceMatchesAmount({
    amount: input.amount,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
  });
  const amount = new Prisma.Decimal(input.amount);
  return {
    lines: [
      {
        kind: CashbookLineKind.ITEM,
        glAccountId: input.offsetGlAccountId,
        amount,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
      },
    ],
    total: amount,
  };
}

/** The lines of the cashbook entry behind a payment or receipt that settles a bill or invoice:
 *  the amount settled against the control (AP/AR) account first — it carries the vendor or
 *  customer — then each deduction and charge taken at settlement. */
export function settlementEntryLines(input: {
  controlAccountId: string;
  amount: number;
  description?: string;
  adjustments: {
    kind: CashbookLineKind;
    glAccountId: string;
    amount: number;
    description?: string;
  }[];
}): EntryLineInput[] {
  if (
    input.adjustments.some(
      (line) => line.glAccountId === input.controlAccountId,
    )
  ) {
    throw new BadRequestException(
      "A deduction or charge cannot post to the document's own control account",
    );
  }
  return [
    {
      kind: CashbookLineKind.ITEM,
      glAccountId: input.controlAccountId,
      amount: input.amount,
      description: input.description,
    },
    ...input.adjustments,
  ];
}
