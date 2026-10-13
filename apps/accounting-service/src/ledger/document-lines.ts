import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { assertQuantityPriceMatchesAmount } from './quantity-price.util';

export interface NormalizedDocumentLine {
  glAccountId?: string;
  amount: Prisma.Decimal;
  quantity?: number;
  unitPrice?: number;
  description?: string;
  costCentreId?: string;
}

interface DocumentLineInput {
  glAccountId?: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  description?: string;
  costCentreId?: string;
}

/** What a bill or invoice is for, as a list of items plus their sum. A request sends either
 *  `lines` or the older single `amount` (with `offsetGlAccountId`, `quantity`, `unitPrice` and
 *  `costCentreId` on the document itself); both end up as lines, and the subtotal is always their
 *  sum. */
export function normalizeDocumentLines(input: {
  amount?: number;
  quantity?: number;
  unitPrice?: number;
  offsetGlAccountId?: string;
  costCentreId?: string;
  lines?: DocumentLineInput[];
}): { lines: NormalizedDocumentLine[]; subtotal: Prisma.Decimal } {
  if (input.lines?.length) {
    if (input.offsetGlAccountId || input.costCentreId) {
      throw new BadRequestException(
        'With lines, put the account and cost centre on each line',
      );
    }
    if (input.quantity !== undefined || input.unitPrice !== undefined) {
      throw new BadRequestException(
        'With lines, put quantity and unitPrice on each line',
      );
    }
    const lines = input.lines.map((line) => {
      assertQuantityPriceMatchesAmount(line);
      return {
        glAccountId: line.glAccountId,
        amount: new Prisma.Decimal(line.amount),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        description: line.description,
        costCentreId: line.costCentreId,
      };
    });
    const subtotal = lines.reduce(
      (sum, line) => sum.plus(line.amount),
      new Prisma.Decimal(0),
    );
    if (
      input.amount !== undefined &&
      !subtotal.equals(new Prisma.Decimal(input.amount))
    ) {
      throw new BadRequestException(
        `amount must equal the sum of the lines (${subtotal.toFixed(2)})`,
      );
    }
    return { lines, subtotal };
  }

  if (input.amount === undefined) {
    throw new BadRequestException('Send lines, or an amount');
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
        glAccountId: input.offsetGlAccountId,
        amount,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        costCentreId: input.costCentreId,
      },
    ],
    subtotal: amount,
  };
}
