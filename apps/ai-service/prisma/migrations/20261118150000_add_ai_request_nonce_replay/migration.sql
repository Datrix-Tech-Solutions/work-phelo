CREATE TABLE "ai"."AiRequestNonce" (
  "replayDigest" BYTEA NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AiRequestNonce_pkey" PRIMARY KEY ("replayDigest"),
  CONSTRAINT "AiRequestNonce_digest_check" CHECK (octet_length("replayDigest") = 32),
  CONSTRAINT "AiRequestNonce_expiry_check" CHECK (
    "expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + interval '75 seconds'
  )
);
CREATE INDEX "AiRequestNonce_expiry_idx" ON "ai"."AiRequestNonce"("expiresAt", "replayDigest");
