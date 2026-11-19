-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ai";

-- CreateEnum
CREATE TYPE "ai"."AiMessageRole" AS ENUM ('USER');

-- CreateEnum
CREATE TYPE "ai"."AiMessageStatus" AS ENUM ('STORED');

-- CreateEnum
CREATE TYPE "ai"."AiReceiptOperation" AS ENUM ('CREATE_CONVERSATION', 'APPEND_MESSAGE', 'DELETE_CONVERSATION');

-- CreateEnum
CREATE TYPE "ai"."AiReceiptOutcome" AS ENUM ('STORED', 'DELETED');

-- CreateTable
CREATE TABLE "ai"."AiConversation" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "nextMessageSequence" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AiConversationMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "role" "ai"."AiMessageRole" NOT NULL DEFAULT 'USER',
    "status" "ai"."AiMessageStatus" NOT NULL DEFAULT 'STORED',
    "encryptionVersion" SMALLINT NOT NULL,
    "keyId" VARCHAR(64) NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "nonce" BYTEA NOT NULL,
    "authenticationTag" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AiSubmissionReceipt" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "operation" "ai"."AiReceiptOperation" NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "fingerprintVersion" SMALLINT NOT NULL,
    "fingerprintKeyId" VARCHAR(64) NOT NULL,
    "requestFingerprint" BYTEA NOT NULL,
    "resultConversationId" UUID NOT NULL,
    "resultMessageId" UUID,
    "outcome" "ai"."AiReceiptOutcome" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiSubmissionReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiConversation_owned_list_idx" ON "ai"."AiConversation"("tenantId", "ownerUserId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "AiConversation_expiry_idx" ON "ai"."AiConversation"("expiresAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AiConversation_ownership_key" ON "ai"."AiConversation"("id", "tenantId", "ownerUserId");

-- CreateIndex
CREATE INDEX "AiMessage_parent_idx" ON "ai"."AiConversationMessage"("conversationId", "tenantId", "ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AiMessage_sequence_key" ON "ai"."AiConversationMessage"("conversationId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "AiMessage_key_nonce_key" ON "ai"."AiConversationMessage"("keyId", "nonce");

-- CreateIndex
CREATE INDEX "AiReceipt_expiry_idx" ON "ai"."AiSubmissionReceipt"("expiresAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AiReceipt_idempotency_key" ON "ai"."AiSubmissionReceipt"("tenantId", "ownerUserId", "operation", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "ai"."AiConversationMessage" ADD CONSTRAINT "AiConversationMessage_conversationId_tenantId_ownerUserId_fkey" FOREIGN KEY ("conversationId", "tenantId", "ownerUserId") REFERENCES "ai"."AiConversation"("id", "tenantId", "ownerUserId") ON DELETE CASCADE ON UPDATE RESTRICT;

-- Prisma does not represent CHECK constraints or immutable-column triggers.
ALTER TABLE "ai"."AiConversation"
  ADD CONSTRAINT "AiConversation_expiry_check" CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "AiConversation_sequence_check" CHECK ("nextMessageSequence" > 0);

ALTER TABLE "ai"."AiConversationMessage"
  ADD CONSTRAINT "AiMessage_sequence_check" CHECK ("sequence" > 0),
  ADD CONSTRAINT "AiMessage_envelope_check" CHECK (
    "encryptionVersion" > 0 AND length(btrim("keyId")) > 0
    AND octet_length("ciphertext") > 0 AND octet_length("nonce") = 12
    AND octet_length("authenticationTag") = 16
  );

ALTER TABLE "ai"."AiSubmissionReceipt"
  ADD CONSTRAINT "AiReceipt_expiry_check" CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "AiReceipt_key_check" CHECK ("idempotencyKey" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  ADD CONSTRAINT "AiReceipt_fingerprint_check" CHECK (
    "fingerprintVersion" > 0 AND length(btrim("fingerprintKeyId")) > 0
    AND octet_length("requestFingerprint") = 32
  );

CREATE FUNCTION "ai"."protect_conversation_identity"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
    OR NEW."ownerUserId" IS DISTINCT FROM OLD."ownerUserId"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
    OR NEW."nextMessageSequence" < OLD."nextMessageSequence" THEN
    RAISE EXCEPTION 'Immutable conversation metadata' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AiConversation_immutable_metadata"
BEFORE UPDATE ON "ai"."AiConversation"
FOR EACH ROW EXECUTE FUNCTION "ai"."protect_conversation_identity"();
