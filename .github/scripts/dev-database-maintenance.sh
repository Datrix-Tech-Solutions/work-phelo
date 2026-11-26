#!/usr/bin/env bash
set -euo pipefail
DEPLOY_PATH=/var/www/apps/dev.workphelo.datrixtechsolutions.com/work-phelo
[[ "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ && "${GITHUB_RUN_ATTEMPT:-}" =~ ^[0-9]+$ ]] || exit 1
[[ "${BUILD_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || exit 1
case "${MAINTENANCE_SERVICE:-}" in
  auth-service) schema=w_auth ;;
  hr-service) schema=hr ;;
  notification-service) schema=notify ;;
  reinsurance-service) schema=reinsurance ;;
  accounting-service) schema=accounting ;;
  marketing-service) schema=marketing ;;
  inventory-service) schema=inventory ;;
  *) echo 'Unsupported database service' >&2; exit 1 ;;
esac
[[ "${MAINTENANCE_IMAGE:-}" == "ghcr.io/datrix-tech-solutions/work-phelo/${MAINTENANCE_SERVICE}:${BUILD_SHA}" ]] || exit 1
case "${MAINTENANCE_OPERATION:-}" in
  migrate) ;;
  seed) [[ "$MAINTENANCE_SERVICE" == auth-service || "$MAINTENANCE_SERVICE" == hr-service ]] || exit 1 ;;
  *) exit 1 ;;
esac
stage="$DEPLOY_PATH/.dev-maintenance/${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
[[ -f "$stage/.github/scripts/dev-database-check.cjs" ]] || exit 1
exec 9>"$DEPLOY_PATH/.deploy.dev.lock"
flock -n 9 || { echo 'Another DEV deployment/maintenance holds the host lock' >&2; exit 1; }
umask 077
envfile=$(mktemp "$stage/database.XXXXXX")
output=$(mktemp "$stage/result.XXXXXX")
trap 'rm -f "$envfile" "$output"' EXIT
# Generate the connection in a network-disabled container. Never echo it or pass
# the resulting URL on a command line. Override existing schema parameters.
printf '%s' "${GHCR_TOKEN:?}" | docker login ghcr.io -u "${GHCR_USERNAME:?}" --password-stdin >/dev/null
docker pull "$MAINTENANCE_IMAGE" >/dev/null
docker run --rm --network none -e DATABASE_URL -e TARGET_SCHEMA="$schema" \
  --entrypoint node "$MAINTENANCE_IMAGE" -e '
  try { const u=new URL(process.env.DATABASE_URL); if(!["postgres:","postgresql:"].includes(u.protocol)||u.searchParams.has("options"))process.exit(1);u.searchParams.set("schema",process.env.TARGET_SCHEMA);process.stdout.write("DATABASE_URL="+u.toString()+"\n"); } catch {process.exit(1)}
  ' > "$envfile"
[[ -s "$envfile" ]] || exit 1
existing="$DEPLOY_PATH/apps/$MAINTENANCE_SERVICE/.env.dev"
[[ -f "$existing" ]] || { echo 'Existing service configuration required' >&2; exit 1; }
args=(run --rm --network workphelo-dev-network --env-file "$existing" --env-file "$envfile"
  -e AUTH_STARTUP_PERMISSION_BACKFILL_ENABLED=false --entrypoint node)
if [[ "$MAINTENANCE_OPERATION" == migrate ]]; then
  # Use the Prisma CLI already installed in the immutable candidate; no network install.
  if ! docker "${args[@]}" "$MAINTENANCE_IMAGE" /app/node_modules/prisma/build/index.js migrate deploy \
    --schema "/app/apps/$MAINTENANCE_SERVICE/prisma/schema.prisma" > "$output" 2>&1; then
    echo 'DEV migration failed; deployment remains blocked. Inspect migration history read-only; never automatically reset or resolve.' >&2
    exit 1
  fi
else
  # Seeds must not run against a schema that still needs candidate migrations.
  docker "${args[@]}" -v "$stage/.github/scripts/dev-database-check.cjs:/checks/dev-database-check.cjs:ro" \
    "$MAINTENANCE_IMAGE" /checks/dev-database-check.cjs "$MAINTENANCE_SERVICE"
  if [[ "$MAINTENANCE_SERVICE" == auth-service ]]; then
    : "${SUPER_ADMIN_EMAIL:?}" "${SUPER_ADMIN_PASSWORD:?}"
    args+=(-e SUPER_ADMIN_EMAIL -e SUPER_ADMIN_PASSWORD)
  fi
  if ! docker "${args[@]}" -e NODE_ENV=development "$MAINTENANCE_IMAGE" "/app/apps/$MAINTENANCE_SERVICE/dist/prisma/seed.js" > "$output" 2>&1; then
    echo 'DEV seed failed; partial data changes may persist. Operator review required; do not automatically retry.' >&2
    exit 1
  fi
fi
docker "${args[@]}" -v "$stage/.github/scripts/dev-database-check.cjs:/checks/dev-database-check.cjs:ro" \
  "$MAINTENANCE_IMAGE" /checks/dev-database-check.cjs "$MAINTENANCE_SERVICE"
echo 'Authorized DEV maintenance complete. No application rollout or deployment-baseline advancement occurred.'
