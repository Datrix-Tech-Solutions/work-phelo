-- Recruitment is now its own HR option. It was ungated before, so tenants with the HR module
-- enabled keep it on to avoid losing access.
UPDATE "w_auth"."Tenant"
SET "featureConfig" = jsonb_set(
  "featureConfig"::jsonb,
  '{hr,recruitment}',
  to_jsonb(COALESCE(("moduleConfig"::jsonb ->> 'hr')::boolean, false)),
  true
)
WHERE "featureConfig"::jsonb ? 'hr';

ALTER TABLE "w_auth"."Tenant" ALTER COLUMN "featureConfig" SET DEFAULT '{"hr": {"leave": false, "time": false, "payroll": false, "appraisals": false, "projects": false, "assets": false, "recruitment": false}, "marketing": {"campaign": false, "sales-crm": false, "transport": false}}';
