-- Runs made from payroll configurations carry only a currency label, so the country is optional.
ALTER TABLE "hr"."PayrollRun" ALTER COLUMN "payrollCountry" DROP NOT NULL;
ALTER TABLE "hr"."PayrollRun" ALTER COLUMN "payrollCountry" DROP DEFAULT;
