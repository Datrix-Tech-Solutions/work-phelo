-- Project management raises client invoices in Accounting as its own source, separate from
-- Marketing's client billing and from Payroll (both of which share the HR / MARKETING modules).
ALTER TYPE "accounting"."SourceModule" ADD VALUE IF NOT EXISTS 'PROJECTS';
