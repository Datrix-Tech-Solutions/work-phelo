// The guard and its signing scheme live in one shared package, so every service verifies
// internal calls the same way. Re-exported here so existing imports keep working.
export {
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from '@work-phelo/internal-auth';
export type { AuthenticatedInternalRequest } from '@work-phelo/internal-auth';
