#!/usr/bin/env bash
# Deploy script for WorkPhelo dev environment.
# Executed on the remote server via appleboy/ssh-action (script_path).
#
# Secret strategy — three tiers:
#   1. Shared secrets (injected once, composed into multiple .env files):
#      DATABASE_URL, RABBITMQ_URL, JWT_SECRET, ALLOWED_ORIGINS
#   2. Service-specific secrets (prefixed by service):
#      AUTH_*, NOTIFY_*
#   3. Infrastructure constants (hardcoded here — not secrets, never change per-env):
#      Internal Docker service URLs, PORT values
#
# GitHub secret names to create in the `dev` environment:
#   Shared:      DATABASE_URL, RABBITMQ_URL, JWT_SECRET, ALLOWED_ORIGINS
#   Auth:        AUTH_FRONTEND_BASE_URL, AUTH_COOKIE_SECURE, AUTH_COOKIE_SAME_SITE,
#                AUTH_GOOGLE_CLIENT_ID, AUTH_GOOGLE_CLIENT_SECRET, AUTH_GOOGLE_CALLBACK_URL,
#                AUTH_MICROSOFT_CLIENT_ID, AUTH_MICROSOFT_CLIENT_SECRET, AUTH_MICROSOFT_CALLBACK_URL
#   Notify:      NOTIFY_RESEND_API_KEY, NOTIFY_RESEND_FROM_EMAIL,
#                NOTIFY_TERMII_API_KEY, NOTIFY_TERMII_SENDER_ID
#   Seed:        SUPER_ADMIN_PASSWORD
#   GHCR:        (GITHUB_TOKEN — automatic, passed as GHCR_TOKEN by workflow)

set -euo pipefail

DEPLOY_PATH="/var/www/apps/dev.workphelo.datrixtechsolutions.com/work-phelo"
COMPOSE_FILE="infrastructure/docker-compose.dev.yml"

POLL_INTERVAL=5
POLL_TIMEOUT=120

echo "──────────────────────────────────────"
echo "  WorkPhelo Dev Deployment"
echo "  SHA: ${BUILD_SHA:-unknown}"
echo "  Ref: ${BUILD_REF:-unknown}"
echo "  Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "──────────────────────────────────────"

# ── 1. Ensure directory structure exists ──────────────────────
# The server holds no source code — only the compose file (uploaded by CI via SCP)
# and the .env files (written below). mkdir -p is a no-op on subsequent deploys.
cd "$DEPLOY_PATH"
mkdir -p \
  apps/api-gateway \
  apps/auth-service \
  apps/hr-service \
  apps/notification-service \
  apps/subscription-service \
  apps/marketing-service
echo "✓ Directory structure ready"

# ── 2. Compose .env files from individual secrets ──────────────
# Each file is written explicitly so:
#   - shared vars appear in multiple services from one source of truth
#   - service-specific vars are scoped with a prefix
#   - non-secret constants (PORT, internal URLs) are hardcoded here
#
# DATABASE_URL is the base connection string (no schema param).
# Prisma multiSchema requires each service's URL to include ?schema=<name>
# so Prisma knows which PostgreSQL schema owns the _prisma_migrations table.
# The helper below appends ?schema or &schema depending on existing query params.
db_url() {
  local schema="$1"
  if [[ "$DATABASE_URL" == *"?"* ]]; then
    echo "${DATABASE_URL}&schema=${schema}"
  else
    echo "${DATABASE_URL}?schema=${schema}"
  fi
}

# api-gateway — no DB, shared config + internal Docker service URLs
cat > apps/api-gateway/.env <<EOF
PORT=4000
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
AUTH_SERVICE_URL=http://erp-auth-dev:4001
HR_SERVICE_URL=http://erp-hr-dev:4002
NOTIFICATION_SERVICE_URL=http://erp-notification-dev:4004
SUBSCRIPTION_SERVICE_URL=http://erp-subscription-dev:4005
MARKETING_SERVICE_URL=http://erp-marketing-dev:4006
EOF

# auth-service — schema: auth
cat > apps/auth-service/.env <<EOF
PORT=4001
NODE_ENV=production
DATABASE_URL=$(db_url auth)
RABBITMQ_URL=${RABBITMQ_URL}
JWT_SECRET=${JWT_SECRET}
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
FRONTEND_BASE_URL=${AUTH_FRONTEND_BASE_URL}
APP_URL=${AUTH_FRONTEND_BASE_URL}
FRONTEND_URL=${AUTH_FRONTEND_BASE_URL}
COOKIE_SECURE=${AUTH_COOKIE_SECURE}
COOKIE_SAME_SITE=${AUTH_COOKIE_SAME_SITE}
GOOGLE_CLIENT_ID=${AUTH_GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${AUTH_GOOGLE_CLIENT_SECRET}
GOOGLE_CALLBACK_URL=${AUTH_GOOGLE_CALLBACK_URL}
MICROSOFT_CLIENT_ID=${AUTH_MICROSOFT_CLIENT_ID}
MICROSOFT_CLIENT_SECRET=${AUTH_MICROSOFT_CLIENT_SECRET}
MICROSOFT_CALLBACK_URL=${AUTH_MICROSOFT_CALLBACK_URL}
EOF

# hr-service — schema: hr
cat > apps/hr-service/.env <<EOF
PORT=4002
NODE_ENV=production
DATABASE_URL=$(db_url hr)
RABBITMQ_URL=${RABBITMQ_URL}
JWT_SECRET=${JWT_SECRET}
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
EOF

# notification-service — schema: notify
cat > apps/notification-service/.env <<EOF
PORT=4004
NODE_ENV=production
DATABASE_URL=$(db_url notify)
RABBITMQ_URL=${RABBITMQ_URL}
RESEND_API_KEY=${NOTIFY_RESEND_API_KEY}
RESEND_FROM_EMAIL=${NOTIFY_RESEND_FROM_EMAIL}
TERMII_API_KEY=${NOTIFY_TERMII_API_KEY}
TERMII_SENDER_ID=${NOTIFY_TERMII_SENDER_ID}
EOF

# subscription-service — default public schema (no multiSchema)
cat > apps/subscription-service/.env <<EOF
PORT=4005
NODE_ENV=production
DATABASE_URL=${DATABASE_URL}
RABBITMQ_URL=${RABBITMQ_URL}
EOF

# marketing-service — default public schema (no multiSchema)
cat > apps/marketing-service/.env <<EOF
PORT=4006
NODE_ENV=production
DATABASE_URL=${DATABASE_URL}
RABBITMQ_URL=${RABBITMQ_URL}
EOF

echo "✓ Env files composed"

# ── 3. Authenticate with GHCR ─────────────────────────────────
# GHCR_TOKEN is the workflow GITHUB_TOKEN (packages: read scope).
echo "$GHCR_TOKEN" | docker login ghcr.io -u datrix-tech-solutions --password-stdin
echo "✓ Authenticated with GHCR"

# ── 4. Pull updated images ─────────────────────────────────────
docker compose -f "$COMPOSE_FILE" pull
echo "✓ Images pulled"

# ── 5. Rolling restart ─────────────────────────────────────────
# --no-build: always use registry images, never locally built ones.
# --remove-orphans: clean up containers for removed services.
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans --no-build
echo "✓ Services recreated"

# ── 6. Run DB migrations ───────────────────────────────────────
echo "Running database migrations..."

# Ensure schemas exist — idempotent DDL, swallow benign errors only here.
docker exec erp-postgres-dev psql -U erp -d workphelo \
  -c "CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS hr; CREATE SCHEMA IF NOT EXISTS notify; CREATE SCHEMA IF NOT EXISTS billing; CREATE SCHEMA IF NOT EXISTS marketing;" \
  2>/dev/null || true

# Auth service — hard failure stops the deployment.
docker exec erp-auth-dev sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/auth-service/prisma/schema.prisma"

# HR service — hard failure stops the deployment.
docker exec erp-hr-dev sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/hr-service/prisma/schema.prisma"

# Notification service — baseline if schema exists but was never migration-tracked (P3005 guard).
# This only triggers when notify has tables but no _prisma_migrations table, i.e. the schema was
# created outside of Prisma migrate (db push or manual SQL). On a fresh server the schema won't
# have tables yet so migrate deploy runs normally and creates everything.
NOTIFY_HAS_TABLES=$(docker exec erp-postgres-dev psql -U erp -d workphelo -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='notify' AND table_name NOT IN ('_prisma_migrations')" \
  2>/dev/null | tr -d '[:space:]' || echo "0")
NOTIFY_TRACKED=$(docker exec erp-postgres-dev psql -U erp -d workphelo -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='notify' AND table_name='_prisma_migrations'" \
  2>/dev/null | tr -d '[:space:]' || echo "0")

if [ "$NOTIFY_HAS_TABLES" != "0" ] && [ "$NOTIFY_TRACKED" = "0" ]; then
  echo "Untracked notify schema detected — baselining all existing migrations..."
  for migration in $(docker exec erp-notification-dev sh -c "ls /app/apps/notification-service/prisma/migrations/ | grep -E '^[0-9]'"); do
    echo "  Marking applied: $migration"
    docker exec erp-notification-dev sh -c "npx prisma@5.22.0 migrate resolve --applied $migration --schema /app/apps/notification-service/prisma/schema.prisma"
  done
  echo "✓ Notification service baselined"
fi

docker exec erp-notification-dev sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/notification-service/prisma/schema.prisma"

# Subscription service — no-op until models are added; schema isolation already set.
docker exec erp-subscription-dev sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/subscription-service/prisma/schema.prisma" 2>/dev/null || true

# Marketing service — no-op until models are added; schema isolation already set.
docker exec erp-marketing-dev sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/marketing-service/prisma/schema.prisma" 2>/dev/null || true

echo "✓ Migrations complete"

# ── 7. Seed (idempotent — skip gracefully if seed binary missing) ─
echo "Running database seed..."
docker exec \
  -e SUPER_ADMIN_EMAIL=superadmin@datrix.com \
  -e SUPER_ADMIN_PASSWORD="$SUPER_ADMIN_PASSWORD" \
  erp-auth-dev node /app/apps/auth-service/prisma/seed.js \
  && echo "✓ Seed complete" \
  || echo "⚠ Seed skipped (compiled seed not found — run manually if needed)"

# ── 8. Polling health checks ───────────────────────────────────
# Checks every POLL_INTERVAL seconds up to POLL_TIMEOUT per service.
# Reacts immediately to running/unhealthy/exited — no fixed sleep.
FAILED_SERVICES=""

wait_healthy() {
  local service="$1"
  local elapsed=0
  local container_name status health

  container_name=$(docker compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null | head -1)
  if [[ -z "$container_name" ]]; then
    echo "  ✗ $service — container not found"
    FAILED_SERVICES="$FAILED_SERVICES $service"
    return
  fi

  while [[ $elapsed -lt $POLL_TIMEOUT ]]; do
    status=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null || echo "unknown")
    health=$(docker inspect \
      --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
      "$container_name" 2>/dev/null || echo "none")

    case "$status" in
      running)
        case "$health" in
          healthy|none)
            echo "  ✓ $service — running"
            return
            ;;
          unhealthy)
            echo "  ✗ $service — unhealthy"
            FAILED_SERVICES="$FAILED_SERVICES $service"
            return
            ;;
        esac
        ;;
      exited|dead)
        echo "  ✗ $service — $status"
        FAILED_SERVICES="$FAILED_SERVICES $service"
        return
        ;;
    esac

    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
    echo "  … $service — waiting (${elapsed}s / ${POLL_TIMEOUT}s)"
  done

  echo "  ✗ $service — timed out after ${POLL_TIMEOUT}s"
  FAILED_SERVICES="$FAILED_SERVICES $service"
}

warn_service() {
  local service="$1"
  local state
  state=$(docker compose -f "$COMPOSE_FILE" ps --format json "$service" 2>/dev/null \
    | jq -r '.[0].State // "unknown"' 2>/dev/null || echo "unknown")
  echo "   ⚠ $service — $state (non-critical)"
}

echo ""
echo "── Service Health ────────────────────"
wait_healthy api-gateway
wait_healthy auth-service
wait_healthy hr-service
wait_healthy notification-service
wait_healthy nextjs

warn_service subscription-service
warn_service marketing-service

# ── 9. Full status printout ────────────────────────────────────
echo ""
echo "── Container Status ──────────────────"
docker compose -f "$COMPOSE_FILE" ps

# ── 10. Clean up dangling images ───────────────────────────────
docker image prune -f --filter "until=24h"

# ── 11. Fail if any critical service is unhealthy ──────────────
if [[ -n "$FAILED_SERVICES" ]]; then
  echo ""
  echo "✗ Deployment failed — unhealthy services:$FAILED_SERVICES"
  echo "Run: docker compose -f $COMPOSE_FILE logs <service>"
  exit 1
fi

echo ""
echo "✓ Dev deployment complete at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
