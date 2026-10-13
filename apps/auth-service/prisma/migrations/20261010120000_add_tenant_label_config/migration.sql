-- Per-company display names for module features (e.g. "projects" shown as "Case").
ALTER TABLE "w_auth"."Tenant"
  ADD COLUMN IF NOT EXISTS "labelConfig" JSONB NOT NULL DEFAULT '{}';
