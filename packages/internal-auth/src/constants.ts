export const INTERNAL_SERVICE_AUTH_HEADERS = {
  service: 'x-workphelo-service',
  timestamp: 'x-workphelo-timestamp',
  signature: 'x-workphelo-signature',
  /** Optional second signature that also covers the query, the body and the acting user. */
  requestSignature: 'x-workphelo-request-signature',
  /** User on whose behalf a service makes the call. Only trusted when the request signature verifies. */
  actingUser: 'x-workphelo-acting-user',
} as const;

export const INTERNAL_SERVICE_AUTH_MIN_SECRET_LENGTH = 32;
export const DEFAULT_MAX_CLOCK_SKEW_SECONDS = 300;
/** Set to "true" on a receiver to reject callers that only send the legacy signature. */
export const INTERNAL_SERVICE_AUTH_REQUIRE_REQUEST_SIGNATURE_ENV =
  'INTERNAL_SERVICE_AUTH_REQUIRE_REQUEST_SIGNATURE';
