export const INTERNAL_SERVICE_AUTH_HEADERS = {
  service: 'x-workphelo-service',
  timestamp: 'x-workphelo-timestamp',
  signature: 'x-workphelo-signature',
} as const;

export const INTERNAL_SERVICE_AUTH_MIN_SECRET_LENGTH = 32;
export const DEFAULT_MAX_CLOCK_SKEW_SECONDS = 300;
