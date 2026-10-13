import { Injectable, Logger } from '@nestjs/common';
import { InternalServiceClient } from '@work-phelo/internal-auth';
import { registrationFor } from './source-registry';

export type SourceTransactionEvent = 'POSTED' | 'REVERSED' | 'REJECTED';

/**
 * Tells the module a transaction came from what happened to it in Accounting. Delivery is best
 * effort: the posting itself has already succeeded and must not fail over a notification, and the
 * module corrects itself from Accounting's history the next time it is read.
 */
@Injectable()
export class SourceEventsNotifier {
  private readonly logger = new Logger(SourceEventsNotifier.name);

  async notify(input: {
    tenantId: string;
    sourceModule: string | null | undefined;
    transactionId: string;
    event: SourceTransactionEvent;
  }): Promise<void> {
    if (!input.sourceModule) return;
    const registration = registrationFor(input.sourceModule);
    if (!registration?.callback) return;

    const client = new InternalServiceClient({
      serviceName: 'accounting-service',
      targetName: registration.serviceName,
      baseUrl: process.env[registration.callback.baseUrlEnv],
      timeoutMs: Number(process.env.INTERNAL_SERVICE_CALLBACK_TIMEOUT_MS),
    });
    if (!client.isConfigured()) {
      this.logger.debug(
        `${registration.serviceName} is not configured; skipping ${input.event}`,
      );
      return;
    }

    try {
      await client.post(registration.callback.path, {
        body: {
          tenantId: input.tenantId,
          sourceModule: input.sourceModule,
          transactionId: input.transactionId,
          event: input.event,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not tell ${registration.serviceName} that ${input.transactionId} was ${input.event}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
