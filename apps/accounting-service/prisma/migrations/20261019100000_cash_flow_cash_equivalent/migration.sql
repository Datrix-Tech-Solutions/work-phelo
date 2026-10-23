-- Accounts tagged Cash & Cash Equivalents (through the account, its group or its classification)
-- count as cash in the Cash Flow Statement, alongside the accounts linked in Cash and Bank.
-- Existing tags are untouched.
ALTER TYPE "accounting"."CashFlowCategory" ADD VALUE IF NOT EXISTS 'CASH_EQUIVALENT';
