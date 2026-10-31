-- Marketing options changed from leads/pipeline/contacts to campaign/sales-crm/transport.
-- sales-crm keeps whatever leads/pipeline granted. campaign and transport were ungated until
-- now, so tenants with the Marketing module enabled keep them on to avoid losing access.
UPDATE "w_auth"."Tenant"
SET "featureConfig" = jsonb_set(
  "featureConfig"::jsonb,
  '{marketing}',
  (("featureConfig"::jsonb -> 'marketing') - 'leads' - 'pipeline' - 'contacts')
    || jsonb_build_object(
      'sales-crm', COALESCE(("featureConfig"::jsonb #>> '{marketing,leads}')::boolean, false)
        OR COALESCE(("featureConfig"::jsonb #>> '{marketing,pipeline}')::boolean, false),
      'campaign', COALESCE(("moduleConfig"::jsonb ->> 'marketing')::boolean, false),
      'transport', COALESCE(("moduleConfig"::jsonb ->> 'marketing')::boolean, false)
    )
)
WHERE "featureConfig"::jsonb ? 'marketing';

ALTER TABLE "w_auth"."Tenant" ALTER COLUMN "featureConfig" SET DEFAULT '{"hr": {"leave": false, "time": false, "payroll": false, "appraisals": false, "projects": false, "assets": false}, "marketing": {"campaign": false, "sales-crm": false, "transport": false}}';
