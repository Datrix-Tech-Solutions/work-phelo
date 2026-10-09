// One-off cleanup: removes the entity tag from the journal lines of posted direct cashbook
// entries that name an entity (counterpartyId) but carry no explicit offset subledger. Those
// lines were tagged by an earlier change that was backed out — a direct entry shows on the
// entity's transaction list but must not move its outstanding balance. Entries with an
// explicit offset subledger (payroll and other source events) are not touched. Amounts and GL
// accounts are untouched. Safe to re-run. Dry run unless --apply is passed.
//
//   DATABASE_URL=... node scripts/untag-cashbook-entity-subledger.mjs [--apply]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../prisma/generated/client');

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();

const entries = await prisma.cashbookTransaction.findMany({
  where: {
    counterpartyId: { not: null },
    offsetSubledgerAccountId: null,
    postedJournalEntryId: { not: null },
    transactionType: { not: 'TRANSFER' },
  },
  select: {
    id: true,
    tenantId: true,
    transactionNumber: true,
    postedJournalEntryId: true,
  },
});

let untagged = 0;
for (const entry of entries) {
  const where = {
    tenantId: entry.tenantId,
    journalEntryId: entry.postedJournalEntryId,
    subledgerAccountId: { not: null },
  };
  const count = await prisma.journalLine.count({ where });
  if (count === 0) continue;
  console.log(
    `${apply ? 'untag' : 'would untag'} ${count} line(s) of ${entry.transactionNumber ?? entry.id}`,
  );
  if (apply) {
    await prisma.journalLine.updateMany({
      where,
      data: { subledgerAccountId: null },
    });
  }
  untagged += count;
}
console.log(`${apply ? 'Untagged' : 'Would untag'} ${untagged} line(s).`);
await prisma.$disconnect();
