import type { TransactionTypeDefinition } from '@/types/accounting';

/** The cashbook transaction types that used to be hardcoded directly into the "New
 *  Cashbook Transaction" chooser (see CashbookTable.tsx) — seeded here as the system
 *  defaults so the Transaction Types table isn't empty out of the box. */
export const DEFAULT_TRANSACTION_TYPES: TransactionTypeDefinition[] = [
  {
    id: 'RECEIPT',
    name: 'Receipt',
    code: 'RECEIPT',
    category: 'RECEIVABLE',
    businessRoles: [],
    allowedDocument: null,
    source: 'Manual Entry',
    description: 'Money received into a cash/bank account.',
    rulesCount: 0,
  },
  {
    id: 'PAYMENT',
    name: 'Payment',
    code: 'PAYMENT',
    category: 'PAYABLE',
    businessRoles: [],
    allowedDocument: null,
    source: 'Manual Entry',
    description: 'Money paid out of a cash/bank account.',
    rulesCount: 0,
  },
  {
    id: 'TRANSFER',
    name: 'Transfer',
    code: 'TRANSFER',
    category: 'NEUTRAL',
    businessRoles: [],
    allowedDocument: null,
    source: 'Manual Entry',
    description: 'Move funds between two cash/bank accounts.',
    rulesCount: 0,
  },
  {
    id: 'CHARGE',
    name: 'Bank Charge',
    code: 'CHARGE',
    category: 'NEUTRAL',
    businessRoles: [],
    allowedDocument: null,
    source: 'Manual Entry',
    description: 'A bank fee against a cash/bank account.',
    rulesCount: 0,
  },
  {
    id: 'ADJUSTMENT',
    name: 'Adjustment',
    code: 'ADJUSTMENT',
    category: 'NONE',
    businessRoles: [],
    allowedDocument: null,
    source: 'Manual Entry',
    description: 'Manual correction to a cash/bank account.',
    rulesCount: 0,
  },
];
