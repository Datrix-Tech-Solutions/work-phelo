import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';

/** quantity × unit price, rounded half-up to 2 decimals — the amount rule the transaction
 *  forms use. */
export function computeQuantityAmount(
  quantity: number,
  unitPrice: number,
): Prisma.Decimal {
  return new Prisma.Decimal(quantity)
    .times(unitPrice)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** quantity and unitPrice are optional together: send both or neither. When both are sent
 *  the amount must be exactly quantity × unitPrice (2 decimals), so the three values can
 *  never disagree on a saved record. */
export function assertQuantityPriceMatchesAmount(input: {
  amount: number;
  quantity?: number;
  unitPrice?: number;
}) {
  const { amount, quantity, unitPrice } = input;
  if (quantity === undefined && unitPrice === undefined) return;
  if (quantity === undefined || unitPrice === undefined) {
    throw new BadRequestException(
      'quantity and unitPrice must be provided together',
    );
  }
  const expected = computeQuantityAmount(quantity, unitPrice);
  if (!expected.equals(new Prisma.Decimal(amount))) {
    throw new BadRequestException(
      `amount must equal quantity × unitPrice (${expected.toFixed(2)})`,
    );
  }
}
