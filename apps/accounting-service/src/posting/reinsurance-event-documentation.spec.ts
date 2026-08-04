import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Reinsurance accounting event documentation', () => {
  const spec = readFileSync(
    join(
      process.cwd(),
      '../../docs/workphelo-reinsurance-accounting-integration-spec-v1.md',
    ),
    'utf8',
  );

  it('documents every active premium accounting event in the AR/AP matrix', () => {
    const activePremiumEvents = [
      'DEBIT_NOTE_ISSUED',
      'CREDIT_NOTE_ISSUED',
      'ENDORSEMENT_DEBIT_NOTE_ISSUED',
      'ENDORSEMENT_CREDIT_NOTE_ISSUED',
      'PREMIUM_PAYMENT_RECEIVED',
      'PAYMENT_REVERSED',
      'REINSURER_DISBURSEMENT_RECORDED',
      'REINSURER_DISBURSEMENT_REVERSED',
    ];

    expect(spec).toContain('### 10.3 Active Premium Event AR/AP Matrix');
    for (const eventName of activePremiumEvents) {
      expect(spec).toContain(`\`${eventName}\``);
    }
  });

  it('documents the current cash recognition boundaries for receipts and disbursements', () => {
    expect(spec).toMatch(
      /The user records an already\s+completed bank\/cash receipt/,
    );
    expect(spec).toContain('User records completed inbound bank/cash receipt');
    expect(spec).toContain('Accounting confirmation time (`bankConfirmedAt`)');
  });
});
