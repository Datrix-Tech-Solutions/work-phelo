#!/usr/bin/env bash
# Deploy script for WorkPhelo production environment.
# Executed on the remote server via appleboy/ssh-action (script_path).
#
# Secret strategy — three tiers:
#   1. Shared secrets (injected once, composed into multiple .env.prod files):
#      DATABASE_URL, RABBITMQ_URL, JWT_SECRET, ALLOWED_ORIGINS
#   2. Service-specific secrets (prefixed by service):
#      AUTH_*, NOTIFY_*
#   3. Infrastructure constants (hardcoded here — not secrets, never change per-env):
#      Internal Docker service URLs, PORT values
#
# Compose-level variables (redis managed by compose):
#   REDIS_PASSWORD
#   IMAGE_PREFIX, IMAGE_TAG (BUILD_SHA)
#
# GitHub secret names to create in the `production` environment:
#   Shared:      PROD_DATABASE_URL, PROD_RABBITMQ_URL, PROD_JWT_SECRET
#   Variables:   PROD_ALLOWED_ORIGINS
#   Auth:        PROD_AUTH_FRONTEND_BASE_URL, PROD_AUTH_COOKIE_SECURE, PROD_AUTH_COOKIE_SAME_SITE,
#                PROD_AUTH_GOOGLE_CLIENT_ID, PROD_AUTH_GOOGLE_CLIENT_SECRET, PROD_AUTH_GOOGLE_CALLBACK_URL,
#                PROD_AUTH_MICROSOFT_CLIENT_ID, PROD_AUTH_MICROSOFT_CLIENT_SECRET, PROD_AUTH_MICROSOFT_CALLBACK_URL
#   Notify:      PROD_NOTIFY_RESEND_API_KEY, PROD_NOTIFY_RESEND_FROM_EMAIL,
#                PROD_NOTIFY_TERMII_API_KEY, PROD_NOTIFY_TERMII_SENDER_ID
#   Redis:       PROD_REDIS_PASSWORD
#   Seed:        PROD_SUPER_ADMIN_PASSWORD
#   GHCR:        (GITHUB_TOKEN — automatic, passed as GHCR_TOKEN by workflow)

set -euo pipefail

DEPLOY_PATH="/var/www/apps/workphelo.datrixtechsolutions.com/work-phelo"
COMPOSE_FILE="infrastructure/docker-compose.prod.yml"
COMPOSE_ENV_FILE="$DEPLOY_PATH/.env"

POLL_INTERVAL=5
POLL_TIMEOUT=120

echo "──────────────────────────────────────"
echo "  WorkPhelo Production Deployment"
echo "  SHA: ${BUILD_SHA:-unknown}"
echo "  Ref: ${BUILD_REF:-unknown}"
echo "  Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "──────────────────────────────────────"

# ── 1. Ensure directory structure exists ──────────────────────
cd "$DEPLOY_PATH"
mkdir -p \
  apps/api-gateway \
  apps/auth-service \
  apps/hr-service \
  apps/notification-service \
  infrastructure
echo "✓ Directory structure ready"

# ── 2. Write compose-level .env ────────────────────────────────
# These variables are interpolated in docker-compose.prod.yml itself
# (redis config + image tags) — NOT passed into containers.
# We pass this file to docker compose explicitly because the compose file
# lives under infrastructure/, and relying on implicit .env lookup is brittle.
cat > "$COMPOSE_ENV_FILE" <<EOF
IMAGE_PREFIX=${IMAGE_PREFIX:-ghcr.io/datrix-tech-solutions/work-phelo}
IMAGE_TAG=${BUILD_SHA}
REDIS_PASSWORD=${REDIS_PASSWORD}
EOF
echo "✓ Compose .env written"

# ── 3. Compose .env.prod files from individual secrets ─────────
# Each file is written explicitly so:
#   - shared vars appear in multiple services from one source of truth
#   - service-specific vars are scoped with a prefix
#   - non-secret constants (PORT, internal URLs) are hardcoded here
#
# DATABASE_URL is the base connection string (no schema param).
# Prisma multiSchema requires each service's URL to include ?schema=<name>
# so Prisma knows which PostgreSQL schema owns the _prisma_migrations table.
db_url() {
  local schema="$1"
  if [[ "$DATABASE_URL" == *"?"* ]]; then
    echo "${DATABASE_URL}&schema=${schema}"
  else
    echo "${DATABASE_URL}?schema=${schema}"
  fi
}

# api-gateway — no DB, shared config + internal Docker service URLs
cat > apps/api-gateway/.env.prod <<EOF
PORT=4000
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
AUTH_SERVICE_URL=http://erp-auth-prod:4001
HR_SERVICE_URL=http://erp-hr-prod:4002
NOTIFICATION_SERVICE_URL=http://erp-notification-prod:4004
EOF

# auth-service — schema: auth
cat > apps/auth-service/.env.prod <<EOF
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
SUPER_ADMIN_EMAIL=${SUPER_ADMIN_EMAIL}
EOF

# hr-service — schema: hr
cat > apps/hr-service/.env.prod <<EOF
PORT=4002
NODE_ENV=production
DATABASE_URL=$(db_url hr)
RABBITMQ_URL=${RABBITMQ_URL}
JWT_SECRET=${JWT_SECRET}
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
EOF

# notification-service — schema: notify
cat > apps/notification-service/.env.prod <<EOF
PORT=4004
NODE_ENV=production
DATABASE_URL=$(db_url notify)
RABBITMQ_URL=${RABBITMQ_URL}
RESEND_API_KEY=${NOTIFY_RESEND_API_KEY}
RESEND_FROM_EMAIL=${NOTIFY_RESEND_FROM_EMAIL}
TERMII_API_KEY=${NOTIFY_TERMII_API_KEY}
TERMII_SENDER_ID=${NOTIFY_TERMII_SENDER_ID}
EOF

echo "✓ Env files composed"

# ── 4. Authenticate with GHCR ─────────────────────────────────
echo "$GHCR_TOKEN" | docker login ghcr.io -u datrix-tech-solutions --password-stdin
echo "✓ Authenticated with GHCR"

docker_compose() {
  docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# ── 5. Pull updated images ─────────────────────────────────────
docker_compose pull
echo "✓ Images pulled"

# ── 6. Start / recreate services ──────────────────────────────
# --no-build: always use registry images, never locally built ones.
# --remove-orphans: clean up containers for removed services.
docker_compose up -d --remove-orphans --no-build
echo "✓ Services recreated"

# ── 7. Polling health checks ───────────────────────────────────
FAILED_SERVICES=""

wait_healthy() {
  local service="$1"
  local elapsed=0
  local container_name status health

  container_name=$(docker_compose ps -q "$service" 2>/dev/null | head -1)
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

# Wait for infrastructure before running migrations
echo ""
echo "── Infrastructure Health ─────────────"
wait_healthy redis

if [[ -n "$FAILED_SERVICES" ]]; then
  echo ""
  echo "✗ Infrastructure failed — cannot run migrations:$FAILED_SERVICES"
  exit 1
fi

# ── 8. Run DB migrations ───────────────────────────────────────
echo ""
echo "Running database migrations..."

# Auth service — hard failure stops the deployment.
docker exec erp-auth-prod sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/auth-service/prisma/schema.prisma"

# HR service — hard failure stops the deployment.
docker exec erp-hr-prod sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/hr-service/prisma/schema.prisma"

docker exec erp-notification-prod sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/notification-service/prisma/schema.prisma"

# Subscription service — run only if service is part of prod compose.
if docker ps --format '{{.Names}}' | grep -q '^erp-subscription-prod$'; then
  docker exec erp-subscription-prod sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/subscription-service/prisma/schema.prisma"
fi

# Marketing service — run only if service is part of prod compose.
if docker ps --format '{{.Names}}' | grep -q '^erp-marketing-prod$'; then
  docker exec erp-marketing-prod sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/marketing-service/prisma/schema.prisma"
fi

echo "✓ Migrations complete"

# ── 9. Seed (idempotent — skip gracefully if seed binary missing) ─
echo "Running database seed..."
docker exec \
  -e SUPER_ADMIN_EMAIL=superadmin@datrix.com \
  -e SUPER_ADMIN_PASSWORD="$SUPER_ADMIN_PASSWORD" \
  erp-auth-prod node /app/apps/auth-service/prisma/seed.js \
  && echo "✓ Seed complete" \
  || echo "⚠ Seed skipped (compiled seed not found — run manually if needed)"

# ── 10. Application health checks ─────────────────────────────
echo ""
echo "── Service Health ────────────────────"
wait_healthy api-gateway
wait_healthy auth-service
wait_healthy hr-service
wait_healthy notification-service
wait_healthy nextjs

# ── 11. Full status printout ───────────────────────────────────
echo ""
echo "── Container Status ──────────────────"
docker_compose ps

# ── 12. Clean up dangling images ──────────────────────────────
docker image prune -f --filter "until=24h"

# ── 13. Fail if any critical service is unhealthy ─────────────
if [[ -n "$FAILED_SERVICES" ]]; then
  echo ""
  echo "✗ Deployment failed — unhealthy services:$FAILED_SERVICES"
  echo "Run: docker compose --env-file $COMPOSE_ENV_FILE -f $COMPOSE_FILE logs <service>"
  exit 1
fi

echo ""
echo "✓ Production deployment complete at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
