#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ENV="prod"
DEPLOY_PATH="/var/www/apps/workphelo.com/work-phelo"
COMPOSE_FILE="${DEPLOY_PATH}/infrastructure/docker-compose.prod.yml"
COMPOSE_ENV_FILE="${DEPLOY_PATH}/.compose.prod.env"
COMPOSE_PROJECT_NAME="workphelo-prod"
HELPER_FILE="${DEPLOY_PATH}/.github/scripts/deploy-common.sh"

[[ -f "$HELPER_FILE" ]] || {
  echo "✗ Missing deploy helper at ${HELPER_FILE}. Upload step did not complete." >&2
  exit 1
}

# shellcheck source=/dev/null
source "$HELPER_FILE"

section "WorkPhelo Production Deployment"
log "SHA: ${BUILD_SHA:-unknown}"
log "Ref: ${BUILD_REF:-unknown}"
log "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

require_command docker

validate_required_envs "$DEPLOY_ENV"
warn_optional_envs
ensure_deploy_dirs

API_GATEWAY_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "API_GATEWAY_IMAGE" "api-gateway" "api-gateway" "prod")"
AUTH_SERVICE_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "AUTH_SERVICE_IMAGE" "auth-service" "auth-service" "prod")"
HR_SERVICE_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "HR_SERVICE_IMAGE" "hr-service" "hr-service" "prod")"
NOTIFICATION_SERVICE_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "NOTIFICATION_SERVICE_IMAGE" "notification-service" "notification-service" "prod")"
NEXTJS_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "NEXTJS_IMAGE" "nextjs-web" "nextjs-web" "prod")"

section "Compose Env"
write_env_file "$COMPOSE_ENV_FILE" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}" \
  "IMAGE_PREFIX=${IMAGE_PREFIX}" \
  "REDIS_PASSWORD=${REDIS_PASSWORD}" \
  "API_GATEWAY_IMAGE=${API_GATEWAY_IMAGE}" \
  "AUTH_SERVICE_IMAGE=${AUTH_SERVICE_IMAGE}" \
  "HR_SERVICE_IMAGE=${HR_SERVICE_IMAGE}" \
  "NOTIFICATION_SERVICE_IMAGE=${NOTIFICATION_SERVICE_IMAGE}" \
  "NEXTJS_IMAGE=${NEXTJS_IMAGE}" \
  "WEB_PUBLIC_API_URL=${WEB_PUBLIC_API_URL:-https://api.workphelo.com/api/v1}" \
  "WEB_PUBLIC_APP_BASE_URL=${WEB_PUBLIC_APP_BASE_URL:-https://app.workphelo.com}"
log "✓ ${COMPOSE_ENV_FILE}"

section "Service Env Files"
write_env_file "${DEPLOY_PATH}/apps/api-gateway/.env.prod" \
  "PORT=4000" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "JWT_SECRET=${JWT_SECRET}" \
  "ALLOWED_ORIGINS=${ALLOWED_ORIGINS}" \
  "AUTH_SERVICE_URL=http://auth-service:4001" \
  "HR_SERVICE_URL=http://hr-service:4002" \
  "NOTIFICATION_SERVICE_URL=http://notification-service:4004"

write_env_file "${DEPLOY_PATH}/apps/auth-service/.env.prod" \
  "PORT=4001" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "DATABASE_URL=$(db_url_for_schema w_auth)" \
  "RABBITMQ_URL=${RABBITMQ_URL}" \
  "JWT_SECRET=${JWT_SECRET}" \
  "ALLOWED_ORIGINS=${ALLOWED_ORIGINS}" \
  "FRONTEND_BASE_URL=${AUTH_FRONTEND_BASE_URL}" \
  "APP_URL=${AUTH_FRONTEND_BASE_URL}" \
  "FRONTEND_URL=${AUTH_FRONTEND_BASE_URL}" \
  "COOKIE_SECURE=${AUTH_COOKIE_SECURE}" \
  "COOKIE_SAME_SITE=${AUTH_COOKIE_SAME_SITE}" \
  "GOOGLE_CLIENT_ID=${AUTH_GOOGLE_CLIENT_ID}" \
  "GOOGLE_CLIENT_SECRET=${AUTH_GOOGLE_CLIENT_SECRET}" \
  "GOOGLE_CALLBACK_URL=${AUTH_GOOGLE_CALLBACK_URL}" \
  "MICROSOFT_CLIENT_ID=${AUTH_MICROSOFT_CLIENT_ID}" \
  "MICROSOFT_CLIENT_SECRET=${AUTH_MICROSOFT_CLIENT_SECRET}" \
  "MICROSOFT_CALLBACK_URL=${AUTH_MICROSOFT_CALLBACK_URL}" \
  "SUPER_ADMIN_EMAIL=${SUPER_ADMIN_EMAIL}"

write_env_file "${DEPLOY_PATH}/apps/hr-service/.env.prod" \
  "PORT=4002" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "DATABASE_URL=$(db_url_for_schema hr)" \
  "RABBITMQ_URL=${RABBITMQ_URL}" \
  "REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379" \
  "JWT_SECRET=${JWT_SECRET}" \
  "ALLOWED_ORIGINS=${ALLOWED_ORIGINS}" \
  "FRONTEND_BASE_URL=${AUTH_FRONTEND_BASE_URL}" \
  "FIELD_ENCRYPTION_KEY=${HR_FIELD_ENCRYPTION_KEY}" \
  "FIELD_HMAC_KEY=${HR_FIELD_HMAC_KEY}"

write_env_file "${DEPLOY_PATH}/apps/notification-service/.env.prod" \
  "PORT=4004" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "DATABASE_URL=$(db_url_for_schema notify)" \
  "RABBITMQ_URL=${RABBITMQ_URL}" \
  "JWT_SECRET=${JWT_SECRET}" \
  "FRONTEND_BASE_URL=${AUTH_FRONTEND_BASE_URL}" \
  "RESEND_API_KEY=${NOTIFY_RESEND_API_KEY}" \
  "RESEND_FROM_EMAIL=${NOTIFY_RESEND_FROM_EMAIL}" \
  "TERMII_API_KEY=${NOTIFY_TERMII_API_KEY:-}" \
  "TERMII_SENDER_ID=${NOTIFY_TERMII_SENDER_ID:-WorkPhelo}"
log "✓ Service env files written"

section "Compose Validation"
validate_compose_render
log "✓ docker compose config"

section "Registry Auth"
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
log "✓ Authenticated with GHCR"

section "Pull Images"
docker_compose pull redis
ensure_image_available "$API_GATEWAY_IMAGE" "api-gateway" "api-gateway"
ensure_image_available "$AUTH_SERVICE_IMAGE" "auth-service" "auth-service"
ensure_image_available "$HR_SERVICE_IMAGE" "hr-service" "hr-service"
ensure_image_available "$NOTIFICATION_SERVICE_IMAGE" "notification-service" "notification-service"
ensure_image_available "$NEXTJS_IMAGE" "nextjs-web" "nextjs-web"
log "✓ Required images available"

section "Runtime Env Preflight"
preflight_runtime_env "$API_GATEWAY_IMAGE" "${DEPLOY_PATH}/apps/api-gateway/.env.prod" "dist/config/runtime-env.js" "api-gateway"
preflight_runtime_env "$AUTH_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/auth-service/.env.prod" "dist/config/runtime-env.js" "auth-service"
preflight_runtime_env "$HR_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/hr-service/.env.prod" "dist/config/runtime-env.js" "hr-service"
preflight_runtime_env "$NOTIFICATION_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/notification-service/.env.prod" "dist/config/runtime-env.js" "notification-service"
log "✓ Runtime env validation passed"

section "Database Migrations"
# Run migrations before the health-gated rollout. New service images can require
# tables/columns that do not exist yet, so waiting for app health first can
# deadlock deployments when startup hooks query the database.
docker_compose run --rm --no-deps auth-service sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/auth-service/prisma/schema.prisma"
docker_compose run --rm --no-deps hr-service sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/hr-service/prisma/schema.prisma"
docker_compose run --rm --no-deps notification-service sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/notification-service/prisma/schema.prisma"
log "✓ Migrations complete"

section "Deploy"
docker_compose up -d --remove-orphans --no-build
log "✓ Compose rollout finished"

section "Container Health"
wait_for_container_health redis
wait_for_container_health auth-service
wait_for_container_health hr-service
wait_for_container_health notification-service
wait_for_container_health api-gateway
wait_for_container_health nextjs

section "Database Seed"
if docker_compose_exec \
  -e SUPER_ADMIN_EMAIL="${SUPER_ADMIN_EMAIL}" \
  -e SUPER_ADMIN_PASSWORD="${SUPER_ADMIN_PASSWORD}" \
  -e NODE_ENV=production \
  auth-service \
  node /app/apps/auth-service/dist/prisma/seed.js; then
  log "✓ Seed complete"
else
  log "✗ Seed FAILED: database not seeded with super admin user"
  exit 1
fi

section "Reachability"
wait_for_http_ok "prod auth-service" "http://127.0.0.1:4101/health"
wait_for_http_ok "prod hr-service" "http://127.0.0.1:4102/health"
wait_for_http_ok "prod notification-service" "http://127.0.0.1:4104/api/health"
wait_for_http_ok "prod api-gateway" "http://127.0.0.1:4110/health"
wait_for_http_ok "prod nextjs" "http://127.0.0.1:3001/health"

section "Container Status"
docker_compose ps

docker image prune -f --filter "until=24h" >/dev/null || true

log ""
log "✓ Production deployment complete at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "Safe logs command:"
log "  docker compose --project-name ${COMPOSE_PROJECT_NAME} --env-file ${COMPOSE_ENV_FILE} -f ${COMPOSE_FILE} logs --tail 200 <service>"
