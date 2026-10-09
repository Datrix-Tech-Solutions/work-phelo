// One-off: tags posted direct cashbook journals with the entity (counterpartyId) they name,
// the way new postings now do. Every non-cash line of the journal gets the entity; amounts and
// GL accounts are untouched. Skips an entity that is missing, inactive or in another currency
// (the journal would reject it) and lines that already carry a subledger, so it is safe to
// re-run. Dry run unless --apply is passed.
//
//   DATABASE_URL=... node scripts/backfill-cashbook-entity-subledger.mjs [--apply]
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
    currency: true,
    counterpartyId: true,
    postedJournalEntryId: true,
    cashAccount: { select: { glAccountId: true } },
  },
});

let tagged = 0;
let skipped = 0;
for (const entry of entries) {
  const subledger = await prisma.subledgerAccount.findFirst({
    where: { tenantId: entry.tenantId, id: entry.counterpartyId },
  });
  if (
    !subledger ||
    subledger.status !== 'ACTIVE' ||
    (subledger.currency && subledger.currency !== entry.currency)
  ) {
    skipped++;
    console.log(`skip ${entry.transactionNumber ?? entry.id}: entity unusable`);
    continue;
  }
  const where = {
    tenantId: entry.tenantId,
    journalEntryId: entry.postedJournalEntryId,
    subledgerAccountId: null,
    glAccountId: { not: entry.cashAccount.glAccountId },
  };
  const count = await prisma.journalLine.count({ where });
  if (count === 0) continue;
  console.log(
    `${apply ? 'tag' : 'would tag'} ${count} line(s) of ${entry.transactionNumber ?? entry.id} -> ${subledger.code}`,
  );
  if (apply) {
    await prisma.journalLine.updateMany({
      where,
      data: { subledgerAccountId: subledger.id },
    });
  }
  tagged += count;
}
console.log(
  `${apply ? 'Tagged' : 'Would tag'} ${tagged} line(s); skipped ${skipped} entr${skipped === 1 ? 'y' : 'ies'}.`,
);
await prisma.$disconnect();
