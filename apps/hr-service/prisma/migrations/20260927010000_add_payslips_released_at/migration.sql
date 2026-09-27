-- Tracks when payslips were released for a payroll run, independently of the run's own
-- "PAID" status — a linked tenant's Net Pay can settle (releasing payslips) before Income
-- Tax and Social Security have, which is what actually marks the run PAID.

ALTER TABLE "hr"."PayrollRun" ADD COLUMN "payslipsReleasedAt" TIMESTAMP(3);
