-- The web app stored the HR Time Clock and Appraisal toggles as hr.timeclock / hr.appraisal,
-- while the services enforce hr.time / hr.appraisals. Move any old keys onto the keys the
-- services check. A tenant keeps access if either key was on; the old keys are then removed.
UPDATE "w_auth"."Tenant"
SET "featureConfig" = (
  "featureConfig"::jsonb
  || jsonb_build_object(
    'hr',
    (("featureConfig"::jsonb -> 'hr') - 'timeclock' - 'appraisal')
    || jsonb_build_object(
      'time',
      COALESCE(("featureConfig"::jsonb #>> '{hr,time}')::boolean, false)
        OR COALESCE(("featureConfig"::jsonb #>> '{hr,timeclock}')::boolean, false),
      'appraisals',
      COALESCE(("featureConfig"::jsonb #>> '{hr,appraisals}')::boolean, false)
        OR COALESCE(("featureConfig"::jsonb #>> '{hr,appraisal}')::boolean, false)
    )
  )
)
WHERE jsonb_typeof("featureConfig"::jsonb -> 'hr') = 'object'
  AND (
    ("featureConfig"::jsonb -> 'hr') ? 'timeclock'
    OR ("featureConfig"::jsonb -> 'hr') ? 'appraisal'
  );
