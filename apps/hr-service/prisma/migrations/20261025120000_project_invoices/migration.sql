-- CreateTable
CREATE TABLE "hr"."ProjectInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectInvoice_tenantId_projectId_idx" ON "hr"."ProjectInvoice"("tenantId", "projectId");

-- AddForeignKey
ALTER TABLE "hr"."ProjectInvoice" ADD CONSTRAINT "ProjectInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "hr"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
