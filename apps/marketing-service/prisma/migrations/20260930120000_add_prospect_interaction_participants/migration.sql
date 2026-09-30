ALTER TABLE "marketing"."MarketingProspectInteraction"
  ADD COLUMN "decisionMakerInvolved" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "marketing"."MarketingProspectInteractionParticipant" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "interactionId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketingProspectInteractionParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingProspectInteractionParticipant_tenantId_interactionId_idx"
  ON "marketing"."MarketingProspectInteractionParticipant"("tenantId", "interactionId");

ALTER TABLE "marketing"."MarketingProspectInteractionParticipant"
  ADD CONSTRAINT "MarketingProspectInteractionParticipant_interactionId_fkey"
  FOREIGN KEY ("interactionId")
  REFERENCES "marketing"."MarketingProspectInteraction"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
