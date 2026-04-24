import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import {
  WithMeta,
  EmailVerificationEvent,
  InviteUserEvent,
  PasswordResetLinkEvent,
  PasswordResetOtpEvent,
  SmsOtpEvent,
  EmployeeTerminationEvent,
  ResignationSubmittedEvent,
  LeaveRequestedEvent,
  LeaveReviewedEvent,
  LeaveCancelledEvent,
} from '@work-phelo/types';

@Controller()
export class NotificationHandler {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(private readonly notificationService: NotificationService) {}

  private ack(context: RmqContext) {
    context.getChannelRef().ack(context.getMessage());
  }

  private formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private settleFailure(
    context: RmqContext,
    pattern: string,
    error: unknown,
    details: string,
  ) {
    this.logger.error(
      `[${pattern}] Handler failed | ${details} | error=${this.formatError(error)}`,
      error instanceof Error ? error.stack : undefined,
    );
    this.ack(context);
  }

  @EventPattern('notification.email_verification')
  async handleEmailVerification(
    @Payload() data: WithMeta<EmailVerificationEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notification.email_verification] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendEmailVerification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notification.email_verification',
        err,
        `email=${data.email} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notification.invite_user')
  async handleInviteUser(
    @Payload() data: WithMeta<InviteUserEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notification.invite_user] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendInvite(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notification.invite_user',
        err,
        `email=${data.email} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notification.password_reset_link')
  async handlePasswordResetLink(
    @Payload() data: WithMeta<PasswordResetLinkEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notification.password_reset_link] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendPasswordResetLink(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notification.password_reset_link',
        err,
        `email=${data.email} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notification.password_reset_otp')
  async handlePasswordResetOtp(
    @Payload() data: WithMeta<PasswordResetOtpEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notification.password_reset_otp] Received | phone=${data.phone} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendPasswordResetOtp(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notification.password_reset_otp',
        err,
        `phone=${data.phone} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.employee_termination')
  async handleEmployeeTermination(
    @Payload() data: WithMeta<EmployeeTerminationEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.employee_termination] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendTerminationNotice(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.employee_termination',
        err,
        `email=${data.email} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.resignation_submitted')
  async handleResignationSubmitted(
    @Payload() data: WithMeta<ResignationSubmittedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.resignation_submitted] Received | employee=${data.employeeFirstName} ${data.employeeLastName} | adminEmail=${data.adminEmail} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendResignationSubmittedNotification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.resignation_submitted',
        err,
        `adminEmail=${data.adminEmail} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notification.sms_otp')
  async handleSmsOtp(
    @Payload() data: WithMeta<SmsOtpEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notification.sms_otp] Received | phone=${data.phone} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendSmsOtp(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notification.sms_otp',
        err,
        `phone=${data.phone} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.leave_requested')
  async handleLeaveRequested(
    @Payload() data: WithMeta<LeaveRequestedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.leave_requested] Received | employee=${data.employeeFirstName} ${data.employeeLastName} | managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
    );
    if (!data.managerEmail) {
      this.ack(context);
      return;
    }
    try {
      await this.notificationService.sendLeaveRequestedNotification({
        ...data,
        managerEmail: data.managerEmail,
      });
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.leave_requested',
        err,
        `managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.leave_reviewed')
  async handleLeaveReviewed(
    @Payload() data: WithMeta<LeaveReviewedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.leave_reviewed] Received | email=${data.employeeEmail} | status=${data.status} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendLeaveReviewedNotification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.leave_reviewed',
        err,
        `email=${data.employeeEmail} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.leave_cancelled')
  async handleLeaveCancelled(
    @Payload() data: WithMeta<LeaveCancelledEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.leave_cancelled] Received | employee=${data.employeeFirstName} ${data.employeeLastName} | managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
    );
    if (!data.managerEmail) {
      this.ack(context);
      return;
    }
    try {
      await this.notificationService.sendLeaveCancelledNotification({
        ...data,
        managerEmail: data.managerEmail,
      });
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.leave_cancelled',
        err,
        `managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
      );
    }
  }
}
