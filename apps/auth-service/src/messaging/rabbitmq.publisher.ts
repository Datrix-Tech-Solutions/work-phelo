import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class RabbitMQPublisher {
  private readonly logger = new Logger(RabbitMQPublisher.name);

  constructor(
    @Inject('NOTIFICATION_SERVICE') private readonly client: ClientProxy,
    @Inject('HR_SERVICE') private readonly hrClient: ClientProxy,
  ) {}

  emit(pattern: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.emit(pattern, data).subscribe({
        complete: () => resolve(),
        error: (err) => {
          this.logger.error(`Failed to emit event ${pattern}`, err);
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      });
    });
  }

  emitToHr(pattern: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.hrClient.emit(pattern, data).subscribe({
        complete: () => resolve(),
        error: (err) => {
          this.logger.error(`Failed to emit HR event ${pattern}`, err);
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      });
    });
  }

  async sendEmailVerification(data: {
    userId: string;
    tenantId: string;
    email: string;
    firstName: string;
    otp: string;
  }) {
    return this.emit('notification.email_verification', data);
  }

  async sendInviteEmail(data: {
    userId: string;
    tenantId: string;
    email: string;
    firstName: string;
    inviteToken: string;
    acceptInviteUrl: string;
    tenantName: string;
  }) {
    return this.emit('notification.invite_user', data);
  }

  async sendPasswordResetLink(data: {
    userId: string;
    tenantId: string;
    email: string;
    firstName: string;
    resetToken: string;
  }) {
    return this.emit('notification.password_reset_link', data);
  }

  async sendPasswordResetOtp(data: {
    userId: string;
    tenantId: string;
    email: string;
    firstName: string;
    otp: string;
  }) {
    return this.emit('notification.password_reset_otp', data);
  }

  async sendSmsOtp(data: {
    userId: string;
    tenantId: string;
    phone: string;
    otp: string;
    context: string;
  }) {
    return this.emit('notification.sms_otp', data);
  }
}
