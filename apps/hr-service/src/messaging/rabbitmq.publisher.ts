import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import {
  EventPatterns,
  WithMeta,
  InviteEmployeeEvent,
  EmployeeOffboardedEvent,
  ResendEmployeeInviteEvent,
  ProvisionEmployeeInviteCommand,
  ProvisionEmployeeInviteResult,
  DeletePendingEmployeeInviteCommand,
  DeletePendingEmployeeInviteResult,
  EmployeeTerminationEvent,
  ResignationSubmittedEvent,
  LeaveRequestedEvent,
  LeaveReviewedEvent,
  LeaveCancelledEvent,
  TimeCorrectionSubmittedEvent,
} from '@work-phelo/types';

@Injectable()
export class RabbitMQPublisher {
  private readonly logger = new Logger(RabbitMQPublisher.name);

  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  private normalizeRpcError(err: unknown): Error & {
    statusCode?: number;
    error?: string;
  } {
    if (err instanceof Error) {
      return err as Error & { statusCode?: number; error?: string };
    }

    const remote =
      err && typeof err === 'object' && 'message' in err
        ? (err as {
            message?: unknown;
            statusCode?: unknown;
            error?: unknown;
          })
        : undefined;

    const payload =
      remote?.message &&
      typeof remote.message === 'object' &&
      !Array.isArray(remote.message)
        ? (remote.message as {
            message?: unknown;
            statusCode?: unknown;
            error?: unknown;
          })
        : remote;

    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : typeof remote?.message === 'string'
          ? remote.message
          : String(err);
    const wrapped = new Error(message) as Error & {
      statusCode?: number;
      error?: string;
    };

    if (typeof payload?.statusCode === 'number') {
      wrapped.statusCode = payload.statusCode;
    } else if (typeof remote?.statusCode === 'number') {
      wrapped.statusCode = remote.statusCode;
    }

    if (typeof payload?.error === 'string') {
      wrapped.error = payload.error;
    } else if (typeof remote?.error === 'string') {
      wrapped.error = remote.error;
    }

    return wrapped;
  }

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

  private request<T extends object, TResult>(
    client: ClientProxy,
    pattern: string,
    data: T,
    correlationId?: string,
  ): Promise<TResult> {
    const envelope: WithMeta<T> = {
      ...data,
      _meta: {
        messageId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.log(
      `Requesting ${pattern} | msgId=${envelope._meta.messageId} | corrId=${envelope._meta.correlationId}`,
    );

    return new Promise<TResult>((resolve, reject) => {
      client.send<TResult, WithMeta<T>>(pattern, envelope).subscribe({
        next: (result) => resolve(result),
        error: (err) => {
          this.logger.error(
            `Failed to request ${pattern} | corrId=${envelope._meta.correlationId}`,
            err,
          );
          reject(this.normalizeRpcError(err));
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

  authProvisionEmployeeInvite(
    data: ProvisionEmployeeInviteCommand,
    correlationId?: string,
  ): Promise<ProvisionEmployeeInviteResult> {
    return this.request(
      this.authClient,
      EventPatterns.AUTH_PROVISION_EMPLOYEE_INVITE,
      data,
      correlationId,
    );
  }

  authDeletePendingEmployeeInvite(
    data: DeletePendingEmployeeInviteCommand,
    correlationId?: string,
  ): Promise<DeletePendingEmployeeInviteResult> {
    return this.request(
      this.authClient,
      EventPatterns.AUTH_DELETE_PENDING_EMPLOYEE_INVITE,
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

  notificationResignationSubmitted(
    data: ResignationSubmittedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_RESIGNATION_SUBMITTED,
      data,
      correlationId,
    );
  }

  notificationLeaveRequested(
    data: LeaveRequestedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_LEAVE_REQUESTED,
      data,
      correlationId,
    );
  }

  notificationLeaveReviewed(
    data: LeaveReviewedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_LEAVE_REVIEWED,
      data,
      correlationId,
    );
  }

  notificationLeaveCancelled(
    data: LeaveCancelledEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_LEAVE_CANCELLED,
      data,
      correlationId,
    );
  }

  notificationTimeCorrectionSubmitted(
    data: TimeCorrectionSubmittedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_TIME_CORRECTION_SUBMITTED,
      data,
      correlationId,
    );
  }
}
