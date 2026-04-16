import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import {
  EventPatterns,
  WithMeta,
  InviteEmployeeEvent,
  EmployeeOffboardedEvent,
  ResendEmployeeInviteEvent,
  EmployeeTerminationEvent,
} from '@work-phelo/types';

@Injectable()
export class RabbitMQPublisher {
  private readonly logger = new Logger(RabbitMQPublisher.name);

  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  // ── Internal publish ───────────────────────────────────────────────────────

  private publish<T extends object>(
    client: ClientProxy,
    pattern: string,
    data: T,
    correlationId?: string,
  ): Promise<void> {
    const envelope: WithMeta<T> = {
      ...data,
      _meta: {
        messageId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.log(
      `Publishing ${pattern} | msgId=${envelope._meta.messageId} | corrId=${envelope._meta.correlationId}`,
    );

    return new Promise((resolve, reject) => {
      client.emit(pattern, envelope).subscribe({
        complete: () => resolve(),
        error: (err) => {
          this.logger.error(
            `Failed to publish ${pattern} | corrId=${envelope._meta.correlationId}`,
            err,
          );
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      });
    });
  }

  // ── HR → Auth ──────────────────────────────────────────────────────────────

  authInviteEmployee(
    data: InviteEmployeeEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.authClient,
      EventPatterns.AUTH_INVITE_EMPLOYEE,
      data,
      correlationId,
    );
  }

  authEmployeeOffboarded(
    data: EmployeeOffboardedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.authClient,
      EventPatterns.AUTH_EMPLOYEE_OFFBOARDED,
      data,
      correlationId,
    );
  }

  authResendEmployeeInvite(
    data: ResendEmployeeInviteEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.authClient,
      EventPatterns.AUTH_RESEND_EMPLOYEE_INVITE,
      data,
      correlationId,
    );
  }

  // ── HR → Notification ──────────────────────────────────────────────────────

  notificationEmployeeTermination(
    data: EmployeeTerminationEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_EMPLOYEE_TERMINATION,
      data,
      correlationId,
    );
  }
}
