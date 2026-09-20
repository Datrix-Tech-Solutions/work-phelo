import { toCents } from '@/lib/accounting/profitAndLoss';
import type {
  GLAccountCategory,
  IncomeStatementReport,
  JournalLine,
  StatementRow,
  TrialBalanceReport,
} from '@/types/accounting';

const byCode = (a: { account: { code: string } }, b: { account: { code: string } }) =>
  a.account.code.localeCompare(b.account.code, undefined, { numeric: true });

const toAmount = (cents: number): number => cents / 100;

function line(
  accountClass: GLAccountCategory,
  targetAccount: string,
  description: string,
  debitCents: number,
  creditCents: number,
): JournalLine {
  return {
    accountClass,
    targetAccount,
    description,
    debit: debitCents > 0 ? toAmount(debitCents) : '',
    credit: creditCents > 0 ? toAmount(creditCents) : '',
  };
}

/** Adds the one line that makes debits equal credits, posted to `accountId`. */
function withBalancingLine(
  lines: JournalLine[],
  debitCents: number,
  creditCents: number,
  accountId: string,
  description: string,
): JournalLine[] {
  const diff = debitCents - creditCents;
  if (diff === 0) return lines;
  return [
    ...lines,
    line('EQUITY', accountId, description, diff < 0 ? -diff : 0, diff > 0 ? diff : 0),
  ];
}

/**
 * Closing entry lines for a fiscal year: every revenue and expense account is brought to zero
 * (revenue debited, expenses credited) and the net profit or loss lands on the retained
 * earnings account — a profit credits it, a loss debits it.
 */
export function buildClosingLines(
  report: IncomeStatementReport,
  retainedEarningsAccountId: string,
): JournalLine[] {
  let debit = 0;
  let credit = 0;
  const lines: JournalLine[] = [];

  const close = (rows: StatementRow[], normal: 'credit' | 'debit') => {
    for (const row of [...rows].sort(byCode)) {
      // `amount` is the balance on the account's normal side; closing posts the opposite side.
      const cents = toCents(row.amount);
      if (cents === 0) continue;
      const toDebit = normal === 'credit' ? cents > 0 : cents < 0;
      const size = Math.abs(cents);
      lines.push(
        line(
          row.account.category,
          row.account.id,
          'Closing entry',
          toDebit ? size : 0,
          toDebit ? 0 : size,
        ),
      );
      if (toDebit) debit += size;
      else credit += size;
    }
  };

  close(report.revenueAccounts, 'credit');
  close(report.expenseAccounts, 'debit');

  return withBalancingLine(
    lines,
    debit,
    credit,
    retainedEarningsAccountId,
    'Net profit or loss to retained earnings',
  );
}

/**
 * Opening balance lines from the trial balance at the end of the previous year: every
 * asset, liability and equity account with a balance is carried in on its own side. Anything
 * left over (e.g. profit that was never closed) goes to the balancing account.
 */
export function buildOpeningLines(
  report: TrialBalanceReport,
  balancingAccountId: string,
): JournalLine[] {
  let debit = 0;
  let credit = 0;
  const lines: JournalLine[] = [];

  for (const category of ['ASSET', 'LIABILITY', 'EQUITY'] as const) {
    for (const entry of [...(report.accounts[category] ?? [])].sort(byCode)) {
      const debitCents = toCents(entry.debitBalance);
      const creditCents = toCents(entry.creditBalance);
      if (debitCents === 0 && creditCents === 0) continue;
      lines.push(line(category, entry.account.id, 'Opening balance', debitCents, creditCents));
      debit += debitCents;
      credit += creditCents;
    }
  }

  return withBalancingLine(lines, debit, credit, balancingAccountId, 'Opening balance offset');
}
