// The guard and its signing scheme live in one shared package, so every service verifies
// internal calls the same way. Re-exported here so existing imports keep working.
import { ExecutionContext, Injectable } from '@nestjs/common';
import { InternalServiceAuthGuard as SharedGuard } from '@work-phelo/internal-auth';
import { requireAccountingInternalIntegration } from '../../config/activation';
export { INTERNAL_SERVICE_AUTH_HEADERS } from '@work-phelo/internal-auth';
export type { AuthenticatedInternalRequest } from '@work-phelo/internal-auth';

@Injectable()
export class InternalServiceAuthGuard extends SharedGuard {
  canActivate(context: ExecutionContext): boolean {
    requireAccountingInternalIntegration();
    return super.canActivate(context);
  }
}
