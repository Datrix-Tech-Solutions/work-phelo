import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class RabbitMQPublisher {
  private readonly logger = new Logger(RabbitMQPublisher.name);

  constructor(
    @Inject('NOTIFICATION_SERVICE') private readonly client: ClientProxy,
  ) {}

  emit(pattern: string, data: any) {
    this.client.emit(pattern, data).subscribe({
      error: (err) => this.logger.error(`Failed to emit event ${pattern}`, err),
    });
  }

  sendEmailVerification(data: {
    userId: string;
    tenantId: string;
    email: string;
    firstName: string;
    otp: string;
  }) {
    this.emit('notification.email_verification', data);
  }

  sendInviteEmail(data: {
    userId: string;
    tenantId: string;
    email: string;
    firstName: string;
    inviteToken: string;
    acceptInviteUrl: string;
    tenantName: string;
  }) {
    this.emit('notification.invite_user', data);
  }

  sendPasswordResetLink(data: {
    userId: string;
    tenantId: string;
    email: string;
    firstName: string;
    resetToken: string;
  }) {
    this.emit('notification.password_reset_link', data);
  }

  sendPasswordResetOtp(data: {
    userId: string;
    tenantId: string;
    email: string;
    firstName: string;
    otp: string;
  }) {
    this.emit('notification.password_reset_otp', data);
  }

  sendSmsOtp(data: {
    userId: string;
    tenantId: string;
    phone: string;
    otp: string;
    context: string;
  }) {
    this.emit('notification.sms_otp', data);
  }
}
