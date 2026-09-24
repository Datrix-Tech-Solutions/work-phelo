-- Link Department to Branch so a department can belong to a specific branch;
-- defaults to the tenant's head office when none is selected.

ALTER TABLE "hr"."Department" ADD COLUMN "branchId" TEXT;

CREATE INDEX "Department_tenantId_branchId_idx" ON "hr"."Department"("tenantId", "branchId");

ALTER TABLE "hr"."Department" ADD CONSTRAINT "Department_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "hr"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
