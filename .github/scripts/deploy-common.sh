#!/usr/bin/env bash

set -euo pipefail

log() {
  printf '%s\n' "$*"
}

section() {
  printf '\n── %s ────────────────────\n' "$1"
}

die() {
  printf '✗ %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

required_env_vars_for() {
  local deploy_env="$1"
  local -a required=(
    GHCR_TOKEN
    GHCR_USERNAME
    RABBITMQ_URL
    JWT_SECRET
    ALLOWED_ORIGINS
    AUTH_FRONTEND_BASE_URL
    AUTH_COOKIE_SECURE
    AUTH_COOKIE_SAME_SITE
    AUTH_GOOGLE_CLIENT_ID
    AUTH_GOOGLE_CLIENT_SECRET
    AUTH_GOOGLE_CALLBACK_URL
    AUTH_MICROSOFT_CLIENT_ID
    AUTH_MICROSOFT_CLIENT_SECRET
    AUTH_MICROSOFT_CALLBACK_URL
    NOTIFY_RESEND_API_KEY
    NOTIFY_RESEND_FROM_EMAIL
    SUPER_ADMIN_PASSWORD
    SUPER_ADMIN_EMAIL
    HR_FIELD_ENCRYPTION_KEY
    HR_FIELD_HMAC_KEY
    BUILD_SHA
    BUILD_REF
    IMAGE_PREFIX
    AUTH_TENANT_ASSET_STORAGE_PROVIDER
    AUTH_TENANT_ASSET_S3_BUCKET
    AUTH_TENANT_ASSET_S3_REGION
    AUTH_TENANT_ASSET_S3_PREFIX
    AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS
    INTERNAL_SERVICE_AUTH_SECRET
    INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES
    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
  )

  case "$deploy_env" in
  dev)
    required+=(DATABASE_URL)
    ;;
  prod)
    required+=(DATABASE_URL REDIS_PASSWORD)
    ;;
esac

  printf '%s\n' "${required[@]}"
}

contains_any() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  shift

  local token
  for token in "$@"; do
    if [[ "$value" == *"$(printf '%s' "$token" | tr '[:upper:]' '[:lower:]')"* ]]; then
      return 0
    fi
  done

  return 1
}

validate_required_envs() {
  local deploy_env="$1"
  local -a missing=()
  local name

  while IFS= read -r name; do
    [[ -n "${!name:-}" ]] || missing+=("$name")
  done < <(required_env_vars_for "$deploy_env")

  if (( ${#missing[@]} > 0 )); then
    die "Missing required deployment variables for ${deploy_env}: ${missing[*]}"
  fi

  case "${AUTH_COOKIE_SECURE}" in
    true|false) ;;
    *)
      die "AUTH_COOKIE_SECURE must be 'true' or 'false' (got '${AUTH_COOKIE_SECURE}')"
      ;;
  esac

  case "${AUTH_COOKIE_SAME_SITE}" in
    lax|strict|none) ;;
    *)
      die "AUTH_COOKIE_SAME_SITE must be one of: lax, strict, none (got '${AUTH_COOKIE_SAME_SITE}')"
      ;;
  esac

  validate_database_target "$deploy_env"
  validate_environment_boundaries "$deploy_env"
}

warn_optional_envs() {
  local -a optional=(
    NOTIFY_TERMII_API_KEY
    NOTIFY_TERMII_SENDER_ID
  )
  local name

  for name in "${optional[@]}"; do
    if [[ -z "${!name:-}" ]]; then
      log "⚠ Optional variable not set: ${name}"
    fi
  done
}

db_url_for_schema() {
  local schema="$1"
  if [[ "$DATABASE_URL" == *"?"* ]]; then
    printf '%s&schema=%s' "$DATABASE_URL" "$schema"
  else
    printf '%s?schema=%s' "$DATABASE_URL" "$schema"
  fi
}

ensure_deploy_dirs() {
  mkdir -p \
    "$DEPLOY_PATH/infrastructure" \
    "$DEPLOY_PATH/apps/api-gateway" \
    "$DEPLOY_PATH/apps/auth-service" \
    "$DEPLOY_PATH/apps/hr-service" \
    "$DEPLOY_PATH/apps/notification-service"

  if [[ "${DEPLOY_ENV}" == "dev" ]]; then
    mkdir -p \
      "$DEPLOY_PATH/apps/subscription-service" \
      "$DEPLOY_PATH/apps/marketing-service" \
      "$DEPLOY_PATH/apps/reinsurance-service" \
      "$DEPLOY_PATH/apps/accounting-service"
  fi
}

write_env_file() {
  local target="$1"
  shift
  local tmp_file
  tmp_file="$(mktemp "${target##*/}.XXXXXX")"

  for line in "$@"; do
    printf '%s\n' "$line" >> "$tmp_file"
  done

  chmod 600 "$tmp_file"
  mv "$tmp_file" "$target"
}

read_env_value() {
  local file="$1"
  local key="$2"

  [[ -f "$file" ]] || return 1

  local line
  line="$(grep -E "^${key}=" "$file" | tail -1 || true)"
  [[ -n "$line" ]] || return 1
  printf '%s\n' "${line#*=}"
}

service_changed() {
  local service_name="$1"
  local changed_services="${CHANGED_SERVICES:-}"

  [[ "$changed_services" == *"\"${service_name}\""* ]]
}

resolve_image_ref() {
  local existing_env_file="$1"
  local env_var_name="$2"
  local image_name="$3"
  local change_key="$4"
  local fallback_tag="$5"
  local existing_ref=""

  if existing_ref="$(read_env_value "$existing_env_file" "$env_var_name" 2>/dev/null)"; then
    :
  else
    existing_ref=""
  fi

  if service_changed "$change_key"; then
    printf '%s/%s:%s\n' "$IMAGE_PREFIX" "$image_name" "$BUILD_SHA"
  elif [[ -n "$existing_ref" ]]; then
    printf '%s\n' "$existing_ref"
  else
    printf '%s/%s:%s\n' "$IMAGE_PREFIX" "$image_name" "$fallback_tag"
  fi
}

docker_compose() {
  docker compose \
    --project-name "$COMPOSE_PROJECT_NAME" \
    --env-file "$COMPOSE_ENV_FILE" \
    -f "$COMPOSE_FILE" \
    "$@"
}

docker_compose_exec() {
  docker_compose exec -T "$@"
}

validate_compose_render() {
  local tmp
  tmp="$(mktemp)"
  docker_compose config >"$tmp"
  [[ -s "$tmp" ]] || die "Docker Compose config rendered empty output"
  rm -f "$tmp"
  log "Docker Compose config validation passed"
}

preflight_runtime_env() {
  local image_ref="$1"
  local env_file="$2"
  local validation_script="$3"
  local label="$4"

  log "  • ${label}"
  docker run \
    --rm \
    --network none \
    --env-file "$env_file" \
    "$image_ref" \
    node "$validation_script"
}

ensure_image_available() {
  local image_ref="$1"
  local change_key="$2"
  local label="$3"

  if service_changed "$change_key" || ! docker image inspect "$image_ref" >/dev/null 2>&1; then
    log "  • pulling ${label}: ${image_ref}"
    docker pull "$image_ref"
  else
    log "  • reusing local ${label}: ${image_ref}"
  fi
}

wait_for_container_health() {
  local service_name="$1"
  local timeout_seconds="${2:-120}"
  local poll_interval=5
  local elapsed=0
  local container_id

  container_id="$(docker_compose ps -q "$service_name" | head -1)"
  [[ -n "$container_id" ]] || die "${service_name}: container not found"

  while (( elapsed < timeout_seconds )); do
    local status
    local health
    status="$(docker inspect --format='{{.State.Status}}' "$container_id" 2>/dev/null || printf 'unknown')"
    health="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || printf 'none')"

    if [[ "$status" == "running" && ( "$health" == "healthy" || "$health" == "none" ) ]]; then
      log "  ✓ ${service_name} container healthy"
      return 0
    fi

    if [[ "$status" == "exited" || "$status" == "dead" || "$health" == "unhealthy" ]]; then
      print_service_diagnostics "$service_name" "$container_id"
      die "${service_name}: container status=${status} health=${health}"
    fi

    sleep "$poll_interval"
    elapsed=$((elapsed + poll_interval))
    log "  … ${service_name} container status=${status} health=${health} (${elapsed}s/${timeout_seconds}s)"
  done

  print_service_diagnostics "$service_name" "$container_id"
  die "${service_name}: timed out waiting for container health"
}

http_get_ok() {
  local url="$1"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --max-time 10 "$url" >/dev/null
    return 0
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO- --timeout=10 "$url" >/dev/null
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$url" <<'PY'
import sys
import urllib.request

with urllib.request.urlopen(sys.argv[1], timeout=10) as response:
    if response.status >= 400:
        raise SystemExit(1)
PY
    return 0
  fi

  die "Need one of curl, wget, or python3 to perform HTTP reachability checks"
}

wait_for_http_ok() {
  local label="$1"
  local url="$2"
  local timeout_seconds="${3:-120}"
  local poll_interval=5
  local elapsed=0

  while (( elapsed < timeout_seconds )); do
    if http_get_ok "$url"; then
      log "  ✓ ${label} reachable at ${url}"
      return 0
    fi

    sleep "$poll_interval"
    elapsed=$((elapsed + poll_interval))
    log "  … ${label} not reachable yet (${elapsed}s/${timeout_seconds}s): ${url}"
  done

  die "${label}: timed out waiting for ${url}"
}

print_service_logs() {
  local service_name="$1"
  log ""
  log "Recent logs for ${service_name}:"
  docker_compose logs --no-color --tail 120 "$service_name" || true
}

print_service_health_inspect() {
  local container_id="$1"

  log ""
  log "Health inspection for ${container_id}:"
  docker inspect \
    --format='Container={{.Name}} Status={{.State.Status}} Health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} StartedAt={{.State.StartedAt}} FinishedAt={{.State.FinishedAt}} ExitCode={{.State.ExitCode}} Error={{.State.Error}}' \
    "$container_id" || true

  log ""
  log "Healthcheck log entries for ${container_id}:"
  docker inspect \
    --format='{{if .State.Health}}{{range .State.Health.Log}}- Start={{.Start}} End={{.End}} ExitCode={{.ExitCode}} Output={{printf "%q" .Output}}{{println}}{{end}}{{else}}No Docker healthcheck log available.{{end}}' \
    "$container_id" || true
}

print_service_diagnostics() {
  local service_name="$1"
  local container_id="$2"

  log ""
  log "Compose service status:"
  docker_compose ps || true

  print_service_logs "$service_name"

  if [[ -n "$container_id" ]]; then
    print_service_health_inspect "$container_id"
  else
    log ""
    log "No container id found for ${service_name}; skipping health inspection."
  fi
}

validate_database_target() {
  local deploy_env="$1"
  local db_url="${DATABASE_URL:-}"

  [[ -n "$db_url" ]] || die "DATABASE_URL is required"

  case "$deploy_env" in
    prod)
      [[ "$db_url" != *"dev"* ]] || die "Prod deployment must not use dev database URL"
      [[ "$db_url" != *"staging"* ]] || die "Prod deployment must not use staging database URL"
      ;;
    dev)
      [[ "$db_url" != *"prod"* ]] || die "Dev deployment must not use prod database URL"
      [[ "$db_url" != *"production"* ]] || die "Dev deployment must not use production database URL"
      ;;
  esac
}

validate_environment_boundaries() {
  local deploy_env="$1"
  local frontend_url="${AUTH_FRONTEND_BASE_URL:-}"
  local allowed_origins="${ALLOWED_ORIGINS:-}"
  local rabbitmq_url="${RABBITMQ_URL:-}"

  case "$deploy_env" in
  prod)
    [[ "${AUTH_COOKIE_SECURE}" == "true" ]] ||
      die "Production deployments require AUTH_COOKIE_SECURE=true"

    if contains_any "$frontend_url" "localhost" "127.0.0.1" "dev.workphelo" "staging"; then
      die "Production AUTH_FRONTEND_BASE_URL appears to point at a non-production host"
    fi

    if contains_any "$allowed_origins" "localhost" "127.0.0.1" "dev.workphelo" "staging"; then
      die "Production ALLOWED_ORIGINS contains local/dev/staging origins"
    fi

    if contains_any "$rabbitmq_url" "localhost" "127.0.0.1" "workphelo-dev"; then
      die "Production RABBITMQ_URL appears to point at a local/dev broker"
    fi
    ;;
  dev)
    if contains_any "$frontend_url" "https://workphelo.com"; then
      die "Dev AUTH_FRONTEND_BASE_URL appears to point at production"
    fi

    if contains_any "$allowed_origins" "https://workphelo.com"; then
      die "Dev ALLOWED_ORIGINS contains the production origin"
    fi
    ;;
  *)
    die "Unknown DEPLOY_ENV '${deploy_env}'. Expected dev or prod."
    ;;
  esac
}
