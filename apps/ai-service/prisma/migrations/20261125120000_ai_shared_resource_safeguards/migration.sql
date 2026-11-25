ALTER TABLE ai."AiRequestNonce" ADD COLUMN "tenantId" TEXT, ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE ai."AiRequestNonce" ADD CONSTRAINT "AiNonce_scope_pair" CHECK
  (("tenantId" IS NULL AND "ownerUserId" IS NULL) OR ("tenantId" IS NOT NULL AND "ownerUserId" IS NOT NULL AND length("tenantId") > 0 AND length("ownerUserId") > 0));
CREATE INDEX "AiRequestNonce_owner_idx" ON ai."AiRequestNonce" ("tenantId", "ownerUserId", "replayDigest");
CREATE INDEX "AiRequestNonce_legacy_idx" ON ai."AiRequestNonce" ("expiresAt") WHERE "tenantId" IS NULL;
CREATE INDEX "AiRequestNonce_tenant_expiry_idx" ON ai."AiRequestNonce" ("tenantId","expiresAt");
CREATE INDEX "AiSubmissionReceipt_tenant_expiry_idx" ON ai."AiSubmissionReceipt" ("tenantId","expiresAt");
CREATE INDEX "AiConversation_tenant_id_idx" ON ai."AiConversation" ("tenantId",id);
CREATE INDEX "AiMessage_tenant_id_idx" ON ai."AiConversationMessage" ("tenantId",id);
CREATE INDEX "AiReceipt_tenant_id_idx" ON ai."AiSubmissionReceipt" ("tenantId",id);

CREATE TABLE ai."AiTenantUsage" (
 "tenantId" TEXT PRIMARY KEY, initialized BOOLEAN NOT NULL DEFAULT false,
 reconciling BOOLEAN NOT NULL DEFAULT false, conversations BIGINT NOT NULL DEFAULT 0,
 messages BIGINT NOT NULL DEFAULT 0, "encryptedBytes" BIGINT NOT NULL DEFAULT 0,
 receipts BIGINT NOT NULL DEFAULT 0, nonces BIGINT NOT NULL DEFAULT 0,
 CHECK (conversations >= 0 AND messages >= 0 AND "encryptedBytes" >= 0 AND receipts >= 0 AND nonces >= 0));
CREATE TABLE ai."AiOwnerUsage" (
 "tenantId" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL,
 conversations BIGINT NOT NULL DEFAULT 0, messages BIGINT NOT NULL DEFAULT 0,
 "encryptedBytes" BIGINT NOT NULL DEFAULT 0, receipts BIGINT NOT NULL DEFAULT 0, nonces BIGINT NOT NULL DEFAULT 0,
 PRIMARY KEY ("tenantId", "ownerUserId"),
 CHECK (conversations >= 0 AND messages >= 0 AND "encryptedBytes" >= 0 AND receipts >= 0 AND nonces >= 0));
CREATE TABLE ai."AiConversationUsage" (
 "conversationId" UUID PRIMARY KEY, messages BIGINT NOT NULL DEFAULT 0, "encryptedBytes" BIGINT NOT NULL DEFAULT 0,
 CHECK (messages >= 0 AND "encryptedBytes" >= 0));
CREATE TABLE ai."AiExecutionSlot" (
 "tenantId" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, slot INTEGER NOT NULL,
 "leaseId" UUID, generation BIGINT NOT NULL DEFAULT 0, "expiresAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("tenantId", "ownerUserId", slot), CHECK (slot >= 0 AND generation >= 0));
CREATE INDEX "AiExecutionSlot_expiresAt_idx" ON ai."AiExecutionSlot" ("expiresAt");
CREATE TABLE ai."AiAccountingReconciliation" (
 "tenantId" TEXT PRIMARY KEY, epoch UUID NOT NULL, stage INTEGER NOT NULL DEFAULT 0, cursor TEXT NOT NULL DEFAULT '');

-- This lock serializes accounting within one tenant, never across tenants.
-- Source mutations and reconciliation freeze the same scope transactionally.
CREATE FUNCTION ai.resource_prepare(t TEXT, u TEXT) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE ready BOOLEAN; frozen BOOLEAN;
BEGIN
 IF t IS NULL OR u IS NULL THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ai.usage.' || t, 0));
 SELECT initialized, reconciling INTO ready, frozen FROM ai."AiTenantUsage" WHERE "tenantId"=t;
 IF NOT FOUND THEN
   ready := NOT EXISTS (SELECT 1 FROM ai."AiConversation" WHERE "tenantId"=t)
     AND NOT EXISTS (SELECT 1 FROM ai."AiSubmissionReceipt" WHERE "tenantId"=t)
     AND NOT EXISTS (SELECT 1 FROM ai."AiRequestNonce" WHERE "tenantId"=t);
   INSERT INTO ai."AiTenantUsage" ("tenantId", initialized) VALUES (t,ready);
   frozen := false;
 END IF;
 IF frozen OR (NOT ready AND current_setting('workphelo.ai_resources',true)='on') THEN
   RAISE EXCEPTION 'AI_ACCOUNTING_UNAVAILABLE';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM ai."AiOwnerUsage" WHERE "tenantId"=t AND "ownerUserId"=u) AND
   (EXISTS (SELECT 1 FROM ai."AiConversation" WHERE "tenantId"=t AND "ownerUserId"=u)
    OR EXISTS (SELECT 1 FROM ai."AiSubmissionReceipt" WHERE "tenantId"=t AND "ownerUserId"=u)
    OR EXISTS (SELECT 1 FROM ai."AiRequestNonce" WHERE "tenantId"=t AND "ownerUserId"=u)) THEN
   UPDATE ai."AiTenantUsage" SET initialized=false WHERE "tenantId"=t;
   ready:=false;
   IF current_setting('workphelo.ai_resources',true)='on' THEN RAISE EXCEPTION 'AI_ACCOUNTING_UNAVAILABLE'; END IF;
 END IF;
 INSERT INTO ai."AiOwnerUsage" ("tenantId","ownerUserId") VALUES(t,u) ON CONFLICT DO NOTHING;
 RETURN ready;
END $$;

-- Preparation happens before conflict resolution; charging happens only AFTER a
-- successful insert, so INSERT ... ON CONFLICT cannot consume phantom capacity.
CREATE FUNCTION ai.resource_new_scope() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM ai.resource_prepare(NEW."tenantId",NEW."ownerUserId"); RETURN NEW; END $$;
CREATE TRIGGER "AiConversation_resource_prepare" BEFORE INSERT ON ai."AiConversation"
FOR EACH ROW EXECUTE FUNCTION ai.resource_new_scope();
CREATE TRIGGER "AiReceipt_resource_prepare" BEFORE INSERT ON ai."AiSubmissionReceipt"
FOR EACH ROW EXECUTE FUNCTION ai.resource_new_scope();
CREATE TRIGGER "AiNonce_resource_prepare" BEFORE INSERT ON ai."AiRequestNonce"
FOR EACH ROW EXECUTE FUNCTION ai.resource_new_scope();
CREATE FUNCTION ai.resource_metadata_update() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD."tenantId",OLD."ownerUserId") IS DISTINCT FROM (NEW."tenantId",NEW."ownerUserId") THEN
   RAISE EXCEPTION 'Immutable metadata ownership';
 END IF;
 PERFORM ai.resource_prepare(OLD."tenantId",OLD."ownerUserId"); RETURN NEW;
END $$;
CREATE TRIGGER "AiReceipt_resource_update" BEFORE UPDATE ON ai."AiSubmissionReceipt"
FOR EACH ROW EXECUTE FUNCTION ai.resource_metadata_update();
CREATE TRIGGER "AiNonce_resource_update" BEFORE UPDATE ON ai."AiRequestNonce"
FOR EACH ROW EXECUTE FUNCTION ai.resource_metadata_update();

CREATE FUNCTION ai.resource_delta(t TEXT,u TEXT,c BIGINT,m BIGINT,b BIGINT,r BIGINT,n BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE a ai."AiTenantUsage"; o ai."AiOwnerUsage";
BEGIN
 IF NOT ai.resource_prepare(t,u) THEN RETURN; END IF;
 UPDATE ai."AiTenantUsage" SET conversations=conversations+c,messages=messages+m,
   "encryptedBytes"="encryptedBytes"+b,receipts=receipts+r,nonces=nonces+n WHERE "tenantId"=t RETURNING * INTO a;
 UPDATE ai."AiOwnerUsage" SET conversations=conversations+c,messages=messages+m,
   "encryptedBytes"="encryptedBytes"+b,receipts=receipts+r,nonces=nonces+n
   WHERE "tenantId"=t AND "ownerUserId"=u RETURNING * INTO o;
 IF current_setting('workphelo.ai_resources',true)='on' THEN
   IF (c>0 AND (a.conversations>500 OR o.conversations>50)) OR
      (b>0 AND (a."encryptedBytes">104857600 OR o."encryptedBytes">10485760)) THEN
      RAISE EXCEPTION 'AI_STORAGE_QUOTA_EXCEEDED';
   END IF;
   -- 30 days of approved write refill plus one burst. Retain live receipts.
   IF r>0 AND (a.receipts>COALESCE(current_setting('workphelo.ai_metadata_tenant_receipt_limit',true)::bigint,4320020)
     OR o.receipts>COALESCE(current_setting('workphelo.ai_metadata_owner_receipt_limit',true)::bigint,432002)
     OR EXISTS(SELECT 1 FROM ai."AiSubmissionReceipt" WHERE "tenantId"=t AND "expiresAt"<clock_timestamp()-
       COALESCE(current_setting('workphelo.ai_metadata_backlog_grace_seconds',true)::integer,120)*interval '1 second' LIMIT 1)) THEN
      RAISE EXCEPTION 'AI_METADATA_CAPACITY';
   END IF;
   -- Twice the 70-second maximum proof+margin traffic envelope, rounded upward.
   IF n>0 AND (a.nonces>COALESCE(current_setting('workphelo.ai_metadata_tenant_nonce_limit',true)::bigint,4096)
     OR o.nonces>COALESCE(current_setting('workphelo.ai_metadata_owner_nonce_limit',true)::bigint,256)) THEN RAISE EXCEPTION 'AI_METADATA_CAPACITY'; END IF;
 END IF;
END $$;

CREATE FUNCTION ai.resource_conversation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   PERFORM ai.resource_delta(NEW."tenantId",NEW."ownerUserId",1,0,0,0,0);
   INSERT INTO ai."AiConversationUsage" ("conversationId") VALUES(NEW.id);
   RETURN NEW;
 END IF;
 PERFORM ai.resource_delta(OLD."tenantId",OLD."ownerUserId",-1,0,0,0,0);
 RETURN OLD;
END $$;
CREATE TRIGGER "AiConversation_resources_insert" AFTER INSERT ON ai."AiConversation"
FOR EACH ROW EXECUTE FUNCTION ai.resource_conversation();
CREATE TRIGGER "AiConversation_resources_delete" BEFORE DELETE ON ai."AiConversation"
FOR EACH ROW EXECUTE FUNCTION ai.resource_conversation();

CREATE FUNCTION ai.resource_message() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE b BIGINT; count_after BIGINT;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF (OLD."conversationId",OLD."tenantId",OLD."ownerUserId") IS DISTINCT FROM
      (NEW."conversationId",NEW."tenantId",NEW."ownerUserId") THEN RAISE EXCEPTION 'Immutable message ownership'; END IF;
 END IF;
 IF TG_OP IN ('DELETE','UPDATE') THEN
   b := octet_length(OLD.ciphertext)+octet_length(OLD.nonce)+octet_length(OLD."authenticationTag")+octet_length(OLD."keyId")+2;
   PERFORM ai.resource_delta(OLD."tenantId",OLD."ownerUserId",0,-1,-b,0,0);
   UPDATE ai."AiConversationUsage" SET messages=messages-1,"encryptedBytes"="encryptedBytes"-b
     WHERE "conversationId"=OLD."conversationId" RETURNING messages INTO count_after;
   IF current_setting('workphelo.ai_resources',true)='on' AND count_after IS NULL THEN RAISE EXCEPTION 'AI_ACCOUNTING_UNAVAILABLE'; END IF;
   IF TG_OP='DELETE' AND count_after=0 AND NOT EXISTS(SELECT 1 FROM ai."AiConversation" WHERE id=OLD."conversationId") THEN
     DELETE FROM ai."AiConversationUsage" WHERE "conversationId"=OLD."conversationId";
   END IF;
 END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN
   b := octet_length(NEW.ciphertext)+octet_length(NEW.nonce)+octet_length(NEW."authenticationTag")+octet_length(NEW."keyId")+2;
   PERFORM ai.resource_delta(NEW."tenantId",NEW."ownerUserId",0,1,b,0,0);
   UPDATE ai."AiConversationUsage" SET messages=messages+1,"encryptedBytes"="encryptedBytes"+b
     WHERE "conversationId"=NEW."conversationId" RETURNING messages INTO count_after;
   IF current_setting('workphelo.ai_resources',true)='on' AND count_after IS NULL THEN RAISE EXCEPTION 'AI_ACCOUNTING_UNAVAILABLE'; END IF;
   IF current_setting('workphelo.ai_resources',true)='on' AND count_after>1000 THEN
     RAISE EXCEPTION 'AI_STORAGE_QUOTA_EXCEEDED';
   END IF;
   RETURN NEW;
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER "AiMessage_resources_write" AFTER INSERT OR UPDATE ON ai."AiConversationMessage"
FOR EACH ROW EXECUTE FUNCTION ai.resource_message();
CREATE TRIGGER "AiMessage_resources_delete" BEFORE DELETE ON ai."AiConversationMessage"
FOR EACH ROW EXECUTE FUNCTION ai.resource_message();
-- Remove empty usage after parent/child deletion, independent of FK trigger order.
CREATE FUNCTION ai.resource_parent_removed() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM ai."AiConversationUsage" WHERE "conversationId"=OLD.id AND messages=0; RETURN OLD; END $$;
CREATE TRIGGER "AiConversation_usage_removed" AFTER DELETE ON ai."AiConversation"
FOR EACH ROW EXECUTE FUNCTION ai.resource_parent_removed();

CREATE FUNCTION ai.resource_metadata() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE t TEXT; u TEXT; d INTEGER; r INTEGER; n INTEGER;
BEGIN
 IF TG_OP='DELETE' THEN t:=OLD."tenantId"; u:=OLD."ownerUserId"; d:=-1;
 ELSE t:=NEW."tenantId"; u:=NEW."ownerUserId"; d:=1; END IF;
 IF TG_TABLE_NAME='AiSubmissionReceipt' THEN r:=d; n:=0; ELSE r:=0; n:=d; END IF;
 IF t IS NULL AND current_setting('workphelo.ai_resources',true)='on' AND TG_OP='INSERT' THEN
   RAISE EXCEPTION 'AI_ACCOUNTING_UNAVAILABLE';
 END IF;
 PERFORM ai.resource_delta(t,u,0,0,0,r,n);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "AiReceipt_resources_insert" AFTER INSERT ON ai."AiSubmissionReceipt"
FOR EACH ROW EXECUTE FUNCTION ai.resource_metadata();
CREATE TRIGGER "AiReceipt_resources_delete" BEFORE DELETE ON ai."AiSubmissionReceipt"
FOR EACH ROW EXECUTE FUNCTION ai.resource_metadata();
CREATE TRIGGER "AiNonce_resources_insert" AFTER INSERT ON ai."AiRequestNonce"
FOR EACH ROW EXECUTE FUNCTION ai.resource_metadata();
CREATE TRIGGER "AiNonce_resources_delete" BEFORE DELETE ON ai."AiRequestNonce"
FOR EACH ROW EXECUTE FUNCTION ai.resource_metadata();
