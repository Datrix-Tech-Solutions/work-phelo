import { BadRequestException } from '@nestjs/common';
import {
  assertQuantityPriceMatchesAmount,
  computeQuantityAmount,
} from './quantity-price.util';

describe('quantity-price util', () => {
  it('rounds quantity × unit price half-up to 2 decimals', () => {
    expect(computeQuantityAmount(2, 13.69).toString()).toBe('27.38');
    expect(computeQuantityAmount(3, 13.333).toString()).toBe('40');
    expect(computeQuantityAmount(1, 1.005).toString()).toBe('1.01');
  });

  it('accepts a record with neither quantity nor unit price', () => {
    expect(() =>
      assertQuantityPriceMatchesAmount({ amount: 50 }),
    ).not.toThrow();
  });

  it('accepts a matching amount', () => {
    expect(() =>
      assertQuantityPriceMatchesAmount({
        amount: 27.38,
        quantity: 2,
        unitPrice: 13.69,
      }),
    ).not.toThrow();
  });

  it('rejects only one of quantity / unit price', () => {
    expect(() =>
      assertQuantityPriceMatchesAmount({ amount: 10, quantity: 2 }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertQuantityPriceMatchesAmount({ amount: 10, unitPrice: 5 }),
    ).toThrow(BadRequestException);
  });

  it('rejects an amount that disagrees with quantity × unit price', () => {
    expect(() =>
      assertQuantityPriceMatchesAmount({
        amount: 27.39,
        quantity: 2,
        unitPrice: 13.69,
      }),
    ).toThrow('amount must equal quantity × unitPrice (27.38)');
  });
});
