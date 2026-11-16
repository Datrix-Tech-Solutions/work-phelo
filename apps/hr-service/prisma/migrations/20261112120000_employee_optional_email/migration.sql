BEGIN;

-- Fail before changing records if case/whitespace variants already collide.
-- Deployment must reconcile these identities explicitly; never merge them here.
LOCK TABLE "hr"."Employee" IN SHARE ROW EXCLUSIVE MODE;
-- Match JavaScript String.trim(), including tabs, line breaks and Unicode spaces.
CREATE FUNCTION "hr"."normalize_employee_email"(value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT NULLIF(lower(btrim(value,
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
  )), '');
$$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "hr"."Employee"
    WHERE "hr"."normalize_employee_email"("email") IS NOT NULL
    GROUP BY "tenantId", "hr"."normalize_employee_email"("email") HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Employee normalized-email duplicates exist; reconcile before migration';
  END IF;
END $$;

ALTER TABLE "hr"."Employee" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "hr"."Employee" ADD COLUMN "normalizedEmail" TEXT;
UPDATE "hr"."Employee"
SET "normalizedEmail" = "hr"."normalize_employee_email"("email");
CREATE UNIQUE INDEX "Employee_tenantId_normalizedEmail_key"
ON "hr"."Employee" ("tenantId", "normalizedEmail");

-- Keep legacy/internal writers consistent even when they do not populate the new field.
CREATE FUNCTION "hr"."sync_employee_normalized_email"() RETURNS trigger AS $$
BEGIN
  NEW."normalizedEmail" := "hr"."normalize_employee_email"(NEW."email");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Employee_normalizedEmail_sync"
BEFORE INSERT OR UPDATE OF "email", "normalizedEmail" ON "hr"."Employee"
FOR EACH ROW EXECUTE FUNCTION "hr"."sync_employee_normalized_email"();

COMMIT;
