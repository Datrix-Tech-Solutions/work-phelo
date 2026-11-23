#!/usr/bin/env bash

set -euo pipefail
umask 077

DEPLOY_ENV="prod"
LIVE_DEPLOY_PATH="/var/www/apps/workphelo.com/work-phelo"
[[ "${BUILD_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid production BUILD_SHA' >&2; exit 1; }
# Uploaded assets and generated env files stay isolated until health/reachability pass.
DEPLOY_PATH="${LIVE_DEPLOY_PATH}/.incoming-${BUILD_SHA}"
[[ -d "$DEPLOY_PATH" ]] || { echo 'Missing staged deployment assets' >&2; exit 1; }
chmod 700 "$DEPLOY_PATH"
COMPOSE_FILE="${DEPLOY_PATH}/infrastructure/docker-compose.prod.yml"
COMPOSE_ENV_FILE="${DEPLOY_PATH}/.compose.prod.env"
PREVIOUS_COMPOSE_ENV_FILE="${LIVE_DEPLOY_PATH}/.compose.prod.env"
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

API_GATEWAY_IMAGE="$(resolve_image_ref "$PREVIOUS_COMPOSE_ENV_FILE" "API_GATEWAY_IMAGE" "api-gateway" "api-gateway" "prod")"
AUTH_SERVICE_IMAGE="$(resolve_image_ref "$PREVIOUS_COMPOSE_ENV_FILE" "AUTH_SERVICE_IMAGE" "auth-service" "auth-service" "prod")"
HR_SERVICE_IMAGE="$(resolve_image_ref "$PREVIOUS_COMPOSE_ENV_FILE" "HR_SERVICE_IMAGE" "hr-service" "hr-service" "prod")"
NOTIFICATION_SERVICE_IMAGE="$(resolve_image_ref "$PREVIOUS_COMPOSE_ENV_FILE" "NOTIFICATION_SERVICE_IMAGE" "notification-service" "notification-service" "prod")"
REINSURANCE_SERVICE_IMAGE="$(resolve_image_ref "$PREVIOUS_COMPOSE_ENV_FILE" "REINSURANCE_SERVICE_IMAGE" "reinsurance-service" "reinsurance-service" "prod")"
ACCOUNTING_SERVICE_IMAGE="$(resolve_image_ref "$PREVIOUS_COMPOSE_ENV_FILE" "ACCOUNTING_SERVICE_IMAGE" "accounting-service" "accounting-service" "prod")"
MARKETING_SERVICE_IMAGE="$(resolve_image_ref "$PREVIOUS_COMPOSE_ENV_FILE" "MARKETING_SERVICE_IMAGE" "marketing-service" "marketing-service" "prod")"
NEXTJS_IMAGE="$(resolve_image_ref "$PREVIOUS_COMPOSE_ENV_FILE" "NEXTJS_IMAGE" "nextjs-web" "nextjs-web" "prod")"

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
  "REINSURANCE_SERVICE_IMAGE=${REINSURANCE_SERVICE_IMAGE}" \
  "ACCOUNTING_SERVICE_IMAGE=${ACCOUNTING_SERVICE_IMAGE}" \
  "MARKETING_SERVICE_IMAGE=${MARKETING_SERVICE_IMAGE}" \
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
  "NOTIFICATION_SERVICE_URL=http://notification-service:4004" \
  "REINSURANCE_SERVICE_URL=http://reinsurance-service:4007" \
  "ACCOUNTING_SERVICE_URL=http://accounting-service:4008" \
  "MARKETING_SERVICE_URL=http://marketing-service:4006"

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
  "CAREERS_SITE_URL=${AUTH_CAREERS_SITE_URL:-}" \
  "COOKIE_SECURE=${AUTH_COOKIE_SECURE}" \
  "COOKIE_SAME_SITE=${AUTH_COOKIE_SAME_SITE}" \
  "GOOGLE_CLIENT_ID=${AUTH_GOOGLE_CLIENT_ID}" \
  "GOOGLE_CLIENT_SECRET=${AUTH_GOOGLE_CLIENT_SECRET}" \
  "GOOGLE_CALLBACK_URL=${AUTH_GOOGLE_CALLBACK_URL}" \
  "MICROSOFT_CLIENT_ID=${AUTH_MICROSOFT_CLIENT_ID}" \
  "MICROSOFT_CLIENT_SECRET=${AUTH_MICROSOFT_CLIENT_SECRET}" \
  "MICROSOFT_CALLBACK_URL=${AUTH_MICROSOFT_CALLBACK_URL}" \
  "SUPER_ADMIN_EMAIL=${SUPER_ADMIN_EMAIL}" \
  "AUTH_TENANT_ASSET_STORAGE_PROVIDER=${AUTH_TENANT_ASSET_STORAGE_PROVIDER}" \
  "AUTH_TENANT_ASSET_S3_BUCKET=${AUTH_TENANT_ASSET_S3_BUCKET}" \
  "AUTH_TENANT_ASSET_S3_REGION=${AUTH_TENANT_ASSET_S3_REGION}" \
  "AUTH_TENANT_ASSET_S3_PREFIX=${AUTH_TENANT_ASSET_S3_PREFIX}" \
  "AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS=${AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS}" \
  "AUTH_TENANT_ASSET_CLOUDINARY_ROOT_FOLDER=${AUTH_TENANT_ASSET_CLOUDINARY_ROOT_FOLDER:-}" \
  "CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME:-}" \
  "CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY:-}" \
  "CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET:-}" \
  "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}" \
  "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}" \
  "INTERNAL_SERVICE_AUTH_SECRET=${INTERNAL_SERVICE_AUTH_SECRET}" \
  "INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES=${INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES}"


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
  "FIELD_HMAC_KEY=${HR_FIELD_HMAC_KEY}" \
  "AUTH_TENANT_ASSET_STORAGE_PROVIDER=${AUTH_TENANT_ASSET_STORAGE_PROVIDER}" \
  "AUTH_TENANT_ASSET_S3_BUCKET=${AUTH_TENANT_ASSET_S3_BUCKET}" \
  "AUTH_TENANT_ASSET_S3_REGION=${AUTH_TENANT_ASSET_S3_REGION}" \
  "AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS=${AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS}" \
  "CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME:-}" \
  "CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY:-}" \
  "CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET:-}" \
  "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}" \
  "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}"

write_env_file "${DEPLOY_PATH}/apps/notification-service/.env.prod" \
  "PORT=4004" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "DATABASE_URL=$(db_url_for_schema notify)" \
  "RABBITMQ_URL=${RABBITMQ_URL}" \
  "JWT_SECRET=${JWT_SECRET}" \
  "FRONTEND_BASE_URL=${AUTH_FRONTEND_BASE_URL}" \
  "CAREERS_SITE_URL=${AUTH_CAREERS_SITE_URL:-}" \
  "RESEND_API_KEY=${NOTIFY_RESEND_API_KEY}" \
  "RESEND_FROM_EMAIL=${NOTIFY_RESEND_FROM_EMAIL}" \
  "SMS_PROVIDER=${NOTIFY_SMS_PROVIDER:-termii}" \
  "TERMII_API_KEY=${NOTIFY_TERMII_API_KEY:-}" \
  "TERMII_SENDER_ID=${NOTIFY_TERMII_SENDER_ID:-WorkPhelo}" \
  "PILOSMS_API_KEY=${NOTIFY_PILOSMS_API_KEY:-}" \
  "PILOSMS_SENDER_ID=${NOTIFY_PILOSMS_SENDER_ID:-WorkPhelo}" \
  "SASUSYNC_API_KEY=${NOTIFY_SASUSYNC_API_KEY:-}" \
  "SASUSYNC_SENDER_ID=${NOTIFY_SASUSYNC_SENDER_ID:-WorkPhelo}" \
  "SASUSYNC_BASE_URL=${NOTIFY_SASUSYNC_BASE_URL:-https://sms.sasusync.com}" \
  "SASUSYNC_SANDBOX=${NOTIFY_SASUSYNC_SANDBOX:-true}" \
  "AGOOSMS_API_KEY=${NOTIFY_AGOOSMS_API_KEY:-}" \
  "AGOOSMS_BASE_URL=${NOTIFY_AGOOSMS_BASE_URL:-https://api.agoosms.com}" \
  "AGOOSMS_SANDBOX=${NOTIFY_AGOOSMS_SANDBOX:-true}" \
  "AGOOSMS_SANDBOX_PATH=${NOTIFY_AGOOSMS_SANDBOX_PATH:-/v1/sms/send}" \
  "AGOOSMS_LIVE_PATH=${NOTIFY_AGOOSMS_LIVE_PATH:-/v1/sms/send}"

write_env_file "${DEPLOY_PATH}/apps/reinsurance-service/.env.prod" \
  "PORT=4007" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "DATABASE_URL=$(db_url_for_schema reinsurance)" \
  "RABBITMQ_URL=${RABBITMQ_URL}" \
  "JWT_SECRET=${JWT_SECRET}" \
  "AUTH_SERVICE_URL=http://auth-service:4001" \
  "INTERNAL_SERVICE_AUTH_SECRET=${INTERNAL_SERVICE_AUTH_SECRET}" \
  "REINSURANCE_DOCUMENT_STORAGE_PROVIDER=${REINSURANCE_DOCUMENT_STORAGE_PROVIDER}" \
  "REINSURANCE_DOCUMENT_CLOUDINARY_ROOT_FOLDER=${REINSURANCE_DOCUMENT_CLOUDINARY_ROOT_FOLDER}" \
  "REINSURANCE_DOCUMENT_SIGNED_URL_TTL_SECONDS=${REINSURANCE_DOCUMENT_SIGNED_URL_TTL_SECONDS:-300}" \
  "CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}" \
  "CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}" \
  "CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}" \
  "REINSURANCE_DOCUMENT_S3_BUCKET=${REINSURANCE_DOCUMENT_S3_BUCKET:-}" \
  "REINSURANCE_DOCUMENT_S3_REGION=${REINSURANCE_DOCUMENT_S3_REGION:-}" \
  "REINSURANCE_DOCUMENT_S3_PREFIX=${REINSURANCE_DOCUMENT_S3_PREFIX:-reinsurance}" \
  "REINSURANCE_DOCUMENT_S3_ENDPOINT=${REINSURANCE_DOCUMENT_S3_ENDPOINT:-}" \
  "REINSURANCE_DOCUMENT_S3_FORCE_PATH_STYLE=${REINSURANCE_DOCUMENT_S3_FORCE_PATH_STYLE:-false}" \
  "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-}" \
  "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-}" \
  "REINSURANCE_TENANT_PROFILE_CACHE_TTL_SECONDS=${REINSURANCE_TENANT_PROFILE_CACHE_TTL_SECONDS:-}" \
  "REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED=false"
write_env_file "${DEPLOY_PATH}/apps/accounting-service/.env.prod" \
  "PORT=4008" \
  "DEPLOY_ENV=prod" \
  "NODE_ENV=production" \
  "DATABASE_URL=$(db_url_for_schema accounting)" \
  "JWT_SECRET=${JWT_SECRET}" \
  "ACCOUNTING_RECURRING_JOURNALS_ENABLED=false" \
  "ACCOUNTING_INTERNAL_INTEGRATION_ENABLED=false"

write_env_file "${DEPLOY_PATH}/apps/marketing-service/.env.prod" \
  "PORT=4006" \
  "DEPLOY_ENV=prod" \
  "NODE_ENV=production" \
  "DATABASE_URL=$(db_url_for_schema marketing)" \
  "JWT_SECRET=${JWT_SECRET}" \
  "AUTH_SERVICE_URL=http://auth-service:4001" \
  "HR_SERVICE_URL=http://hr-service:4002" \
  "INTERNAL_SERVICE_AUTH_SECRET=${INTERNAL_SERVICE_AUTH_SECRET}" \
  "RABBITMQ_URL=${RABBITMQ_URL}" \
  "MARKETING_OUTBOUND_COMMUNICATION_ENABLED=false" \
  "MARKETING_AUTOMATIC_PROCESSING_ENABLED=false" \
  "MARKETING_RABBITMQ_CONSUMER_ENABLED=false" \
  "MARKETING_ACCOUNTING_INTEGRATION_ENABLED=false" \
  "SMS_SENDER_READINESS_MODE=strict"
log "✓ Service env files written; new service business activation remains disabled"

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
ensure_image_available "$REINSURANCE_SERVICE_IMAGE" "reinsurance-service" "reinsurance-service"
ensure_image_available "$ACCOUNTING_SERVICE_IMAGE" "accounting-service" "accounting-service"
ensure_image_available "$MARKETING_SERVICE_IMAGE" "marketing-service" "marketing-service"
ensure_image_available "$NEXTJS_IMAGE" "nextjs-web" "nextjs-web"
log "✓ Required images available"

section "Runtime Env Preflight"
preflight_runtime_env "$API_GATEWAY_IMAGE" "${DEPLOY_PATH}/apps/api-gateway/.env.prod" "dist/config/runtime-env.js" "api-gateway"
preflight_runtime_env "$AUTH_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/auth-service/.env.prod" "dist/config/runtime-env.js" "auth-service"
preflight_runtime_env "$HR_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/hr-service/.env.prod" "dist/config/runtime-env.js" "hr-service"
preflight_runtime_env "$NOTIFICATION_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/notification-service/.env.prod" "dist/config/runtime-env.js" "notification-service"
preflight_runtime_env "$REINSURANCE_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/reinsurance-service/.env.prod" "dist/config/runtime-env.js" "reinsurance-service"
preflight_runtime_env "$ACCOUNTING_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/accounting-service/.env.prod" "dist/config/runtime-env.js" "accounting-service"
preflight_runtime_env "$MARKETING_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/marketing-service/.env.prod" "dist/config/runtime-env.js" "marketing-service"
log "✓ Runtime env validation passed"

section "Read-only Database Migration Preflight"
# SQL application and seeding require a separately approved, backed-up operation.
for service in auth-service hr-service notification-service reinsurance-service accounting-service marketing-service; do
  if ! docker_compose run --rm --no-deps "$service" sh -c "npx prisma@5.22.0 migrate status --schema /app/apps/$service/prisma/schema.prisma"; then
    die "$service migration history requires review; no migrations or seeds were run. Obtain backup/schema approval and prepare the database separately."
  fi
done

section "Deploy"
if docker_compose up -d --no-build; then
  :
else
  print_compose_failure_diagnostics
  exit 1
fi
log "✓ Compose rollout finished"

section "Container Health"
wait_for_container_health redis
wait_for_container_health auth-service
wait_for_container_health hr-service
wait_for_container_health notification-service
wait_for_container_health reinsurance-service
wait_for_container_health accounting-service
wait_for_container_health marketing-service
wait_for_container_health api-gateway
wait_for_container_health nextjs

log "Automatic production seeding is disabled; permission/data changes require separate approval."

section "Reachability"
wait_for_http_ok "prod auth-service" "http://127.0.0.1:4101/health"
wait_for_http_ok "prod hr-service" "http://127.0.0.1:4102/health"
wait_for_http_ok "prod notification-service" "http://127.0.0.1:4104/api/health"
wait_for_http_ok "prod reinsurance-service" "http://127.0.0.1:4107/api/health"
wait_for_http_ok "prod accounting-service" "http://127.0.0.1:4108/api/health"
wait_for_http_ok "prod marketing-service" "http://127.0.0.1:4106/api/health"
wait_for_http_ok "prod gateway accounting route" "http://127.0.0.1:4110/api/v1/accounting/health"
wait_for_http_ok "prod api-gateway" "http://127.0.0.1:4110/health"
wait_for_http_ok "prod gateway reinsurance route" "http://127.0.0.1:4110/api/v1/operations/reinsurance/health"
wait_for_http_ok "prod nextjs" "http://127.0.0.1:3001/health"

section "Publish Verified Deployment Configuration"
ROLLBACK_CONFIG_PATH="$(mktemp -d "${LIVE_DEPLOY_PATH}/.rollback-config-${BUILD_SHA}.XXXXXX")"
for relative in .compose.prod.env infrastructure/docker-compose.prod.yml .github/scripts/deploy-common.sh; do
  if [[ -f "${LIVE_DEPLOY_PATH}/${relative}" ]]; then
    mkdir -p "${ROLLBACK_CONFIG_PATH}/$(dirname "$relative")"
    install -m 600 "${LIVE_DEPLOY_PATH}/${relative}" "${ROLLBACK_CONFIG_PATH}/${relative}"
  fi
done
for service in api-gateway auth-service hr-service notification-service reinsurance-service accounting-service marketing-service; do
  mkdir -p "${LIVE_DEPLOY_PATH}/apps/${service}"
  if [[ -f "${LIVE_DEPLOY_PATH}/apps/${service}/.env.prod" ]]; then
    mkdir -p "${ROLLBACK_CONFIG_PATH}/apps/${service}"
    install -m 600 "${LIVE_DEPLOY_PATH}/apps/${service}/.env.prod" "${ROLLBACK_CONFIG_PATH}/apps/${service}/.env.prod"
  fi
  install -m 600 "${DEPLOY_PATH}/apps/${service}/.env.prod" "${LIVE_DEPLOY_PATH}/apps/${service}/.env.prod"
done
install -m 600 "$COMPOSE_ENV_FILE" "$PREVIOUS_COMPOSE_ENV_FILE"
install -m 644 "$COMPOSE_FILE" "${LIVE_DEPLOY_PATH}/infrastructure/docker-compose.prod.yml"
install -m 644 "$HELPER_FILE" "${LIVE_DEPLOY_PATH}/.github/scripts/deploy-common.sh"
COMPOSE_ENV_FILE="$PREVIOUS_COMPOSE_ENV_FILE"
COMPOSE_FILE="${LIVE_DEPLOY_PATH}/infrastructure/docker-compose.prod.yml"
log "Previous configuration retained privately at ${ROLLBACK_CONFIG_PATH}; do not print its contents."
record_successful_deploy_images

section "Container Status"
docker_compose ps

post_deploy_capacity_maintenance

log ""
log "✓ Production deployment complete at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "Safe logs command:"
log "  docker compose --project-name ${COMPOSE_PROJECT_NAME} --env-file ${COMPOSE_ENV_FILE} -f ${COMPOSE_FILE} logs --tail 200 <service>"
