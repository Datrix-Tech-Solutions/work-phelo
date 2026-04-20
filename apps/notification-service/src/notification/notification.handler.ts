import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import {
  WithMeta,
  EmailVerificationEvent,
  InviteUserEvent,
  PasswordResetLinkEvent,
  PasswordResetOtpEvent,
  SmsOtpEvent,
  EmployeeTerminationEvent,
  LeaveRequestedEvent,
  LeaveReviewedEvent,
  LeaveCancelledEvent,
} from '@work-phelo/types';

@Controller()
export class NotificationHandler {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('notification.email_verification')
  async handleEmailVerification(
    @Payload() data: WithMeta<EmailVerificationEvent>,
  ) {
    this.logger.log(
      `[notification.email_verification] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendEmailVerification(data);
    } catch (err) {
      this.logger.error(
        '[notification.email_verification] Handler failed',
        err,
      );
    }
  }

  @EventPattern('notification.invite_user')
  async handleInviteUser(@Payload() data: WithMeta<InviteUserEvent>) {
    this.logger.log(
      `[notification.invite_user] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendInvite(data);
    } catch (err) {
      this.logger.error('[notification.invite_user] Handler failed', err);
    }
  }

  @EventPattern('notification.password_reset_link')
  async handlePasswordResetLink(
    @Payload() data: WithMeta<PasswordResetLinkEvent>,
  ) {
    this.logger.log(
      `[notification.password_reset_link] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendPasswordResetLink(data);
    } catch (err) {
      this.logger.error(
        '[notification.password_reset_link] Handler failed',
        err,
      );
    }
  }

  @EventPattern('notification.password_reset_otp')
  async handlePasswordResetOtp(
    @Payload() data: WithMeta<PasswordResetOtpEvent>,
  ) {
    this.logger.log(
      `[notification.password_reset_otp] Received | phone=${data.phone} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendPasswordResetOtp(data);
    } catch (err) {
      this.logger.error(
        '[notification.password_reset_otp] Handler failed',
        err,
      );
    }
  }

  @EventPattern('notify.employee_termination')
  async handleEmployeeTermination(
    @Payload() data: WithMeta<EmployeeTerminationEvent>,
  ) {
    this.logger.log(
      `[notify.employee_termination] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendTerminationNotice(data);
    } catch (err) {
      this.logger.error('[notify.employee_termination] Handler failed', err);
    }
  }

  @EventPattern('notification.sms_otp')
  async handleSmsOtp(@Payload() data: WithMeta<SmsOtpEvent>) {
    this.logger.log(
      `[notification.sms_otp] Received | phone=${data.phone} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendSmsOtp(data);
    } catch (err) {
      this.logger.error('[notification.sms_otp] Handler failed', err);
    }
  }

  @EventPattern('notify.leave_requested')
  async handleLeaveRequested(@Payload() data: WithMeta<LeaveRequestedEvent>) {
    this.logger.log(
      `[notify.leave_requested] Received | employee=${data.employeeFirstName} ${data.employeeLastName} | managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
    );
    if (!data.managerEmail) return;
    try {
      await this.notificationService.sendLeaveRequestedNotification({
        ...data,
        managerEmail: data.managerEmail,
      });
    } catch (err) {
      this.logger.error('[notify.leave_requested] Handler failed', err);
    }
  }

  @EventPattern('notify.leave_reviewed')
  async handleLeaveReviewed(@Payload() data: WithMeta<LeaveReviewedEvent>) {
    this.logger.log(
      `[notify.leave_reviewed] Received | email=${data.employeeEmail} | status=${data.status} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendLeaveReviewedNotification(data);
    } catch (err) {
      this.logger.error('[notify.leave_reviewed] Handler failed', err);
    }
  }

  @EventPattern('notify.leave_cancelled')
  async handleLeaveCancelled(@Payload() data: WithMeta<LeaveCancelledEvent>) {
    this.logger.log(
      `[notify.leave_cancelled] Received | employee=${data.employeeFirstName} ${data.employeeLastName} | managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
    );
    if (!data.managerEmail) return;
    try {
      await this.notificationService.sendLeaveCancelledNotification({
        ...data,
        managerEmail: data.managerEmail,
      });
    } catch (err) {
      this.logger.error('[notify.leave_cancelled] Handler failed', err);
    }
  }
}
