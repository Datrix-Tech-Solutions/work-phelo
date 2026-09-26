import type { JournalEntryRecord, JournalRecordStatus } from '@/types/accounting';

type ReversalLinks = Pick<
  JournalEntryRecord,
  'status' | 'reversalJournal' | 'reversalOfJournal' | 'reversalOfJournalId'
>;

/** A journal is reversed once a reversal of it exists. That is read from the link the reversal
 *  carries, so the original never has to be modified. (Older journals also carry REVERSED.) */
export function isReversed(journal: ReversalLinks): boolean {
  // Truthiness, not `!== null`: an older backend omits the field, which must read as "not reversed".
  return journal.status === 'REVERSED' || Boolean(journal.reversalJournal);
}

/** The status to show: a journal with a reversal reads as Reversed even though it stays posted. */
export function displayStatus(journal: ReversalLinks): JournalRecordStatus {
  return isReversed(journal) ? 'REVERSED' : journal.status;
}

/** Only a posted journal that has not been reversed, and is not itself a reversal, can be reversed. */
export function canReverse(journal: ReversalLinks): boolean {
  return journal.status === 'POSTED' && !isReversed(journal) && !journal.reversalOfJournalId;
}
