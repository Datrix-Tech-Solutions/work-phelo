import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import {
  EventPatterns,
  WithMeta,
  TenantApprovedEvent,
  EmployeeActivatedEvent,
  EmailVerificationEvent,
  InviteUserEvent,
  PasswordResetLinkEvent,
  PasswordResetOtpEvent,
  SmsOtpEvent,
} from '@work-phelo/types';

@Injectable()
export class RabbitMQPublisher {
  private readonly logger = new Logger(RabbitMQPublisher.name);

  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('HR_SERVICE') private readonly hrClient: ClientProxy,
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

  // ── Auth → HR ──────────────────────────────────────────────────────────────

  hrTenantApproved(
    data: TenantApprovedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.hrClient,
      EventPatterns.HR_TENANT_APPROVED,
      data,
      correlationId,
    );
  }

  hrEmployeeActivated(
    data: EmployeeActivatedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.hrClient,
      EventPatterns.HR_EMPLOYEE_ACTIVATED,
      data,
      correlationId,
    );
  }

  // ── Auth → Notification ────────────────────────────────────────────────────

  notificationEmailVerification(
    data: EmailVerificationEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFICATION_EMAIL_VERIFICATION,
      data,
      correlationId,
    );
  }

  notificationInviteUser(
    data: InviteUserEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFICATION_INVITE_USER,
      data,
      correlationId,
    );
  }

  notificationPasswordResetLink(
    data: PasswordResetLinkEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFICATION_PASSWORD_RESET_LINK,
      data,
      correlationId,
    );
  }

  notificationPasswordResetOtp(
    data: PasswordResetOtpEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFICATION_PASSWORD_RESET_OTP,
      data,
      correlationId,
    );
  }

  notificationSmsOtp(data: SmsOtpEvent, correlationId?: string): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFICATION_SMS_OTP,
      data,
      correlationId,
    );
  }
}
