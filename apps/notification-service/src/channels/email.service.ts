import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly appName = 'WorkPhelo ERP';

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  }

  async sendEmailVerificationOtp(
    to: string,
    firstName: string,
    otp: string,
  ): Promise<boolean> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `${this.appName} - Verify your email`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5;">Welcome to ${this.appName}, ${firstName}!</h2>
            <p>Please verify your email address using the code below:</p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="letter-spacing: 8px; color: #333; font-size: 36px;">${otp}</h1>
            </div>
            <p>This code expires in <strong>10 minutes</strong>.</p>
            <p style="color: #666; font-size: 12px;">If you did not create an account, please ignore this email.</p>
          </div>
        `,
      });
      this.logger.log(
        `Verification OTP sent to ${to} — ID: ${result.data?.id}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send verification OTP to ${to}: ${JSON.stringify(error)}`,
      );
      return false;
    }
  }

  async sendInviteEmail(
    to: string,
    firstName: string,
    acceptInviteUrl: string,
    tenantName: string,
  ): Promise<boolean> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `You've been invited to ${tenantName} on ${this.appName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 8px;">
            <div style="background: white; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h1 style="color: #f97316; margin: 0 0 8px 0; font-size: 24px;">WorkPhelo ERP</h1>
              <h2 style="color: #111827; margin: 0 0 24px 0; font-size: 18px;">You've been invited to ${tenantName}</h2>
              <p style="color: #374151; margin: 0 0 16px 0;">Hi ${firstName},</p>
              <p style="color: #374151; margin: 0 0 16px 0;">
                <strong>${tenantName}</strong> has added you as a team member on ${this.appName}.
                Click the button below to set your password and access your account.
              </p>
              <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 12px 16px; margin: 24px 0; border-radius: 0 4px 4px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px;">
                  This link expires in <strong>48 hours</strong>. If it expires, contact your platform administrator to resend the invitation.
                </p>
              </div>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${acceptInviteUrl}"
                  style="background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                  Set Your Password
                </a>
              </div>
              <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0 0;">
                Or copy this link into your browser:<br/>
                <span style="color: #6b7280; word-break: break-all;">${acceptInviteUrl}</span>
              </p>
            </div>
            <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 16px 0 0 0;">
              This email was sent by ${this.appName}. If you did not expect this invitation, you can safely ignore it.
            </p>
          </div>
        `,
      });
      this.logger.log(`Invite email sent to ${to} — ID: ${result.data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send invite to ${to}: ${JSON.stringify(error)}`,
      );
      return false;
    }
  }

  async sendPasswordResetLink(
    to: string,
    firstName: string,
    resetLink: string,
  ): Promise<boolean> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `${this.appName} - Reset your password`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5;">Password Reset Request</h2>
            <p>Hi ${firstName},</p>
            <p>Click the button below to reset your password. This link expires in <strong>15 minutes</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}"
                style="background: #4F46E5; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 12px;">Or copy this link: ${resetLink}</p>
            <p style="color: #666; font-size: 12px;">If you did not request this, ignore this email.</p>
          </div>
        `,
      });
      this.logger.log(
        `Password reset email sent to ${to} — ID: ${result.data?.id}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send password reset to ${to}: ${JSON.stringify(error)}`,
      );
      return false;
    }
  }

  async sendPasswordResetOtp(
    to: string,
    firstName: string,
    otp: string,
  ): Promise<boolean> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `${this.appName} - Password reset code`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5;">Password Reset Code</h2>
            <p>Hi ${firstName},</p>
            <p>Use the code below to reset your password:</p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="letter-spacing: 8px; color: #333; font-size: 36px;">${otp}</h1>
            </div>
            <p>This code expires in <strong>15 minutes</strong>.</p>
          </div>
        `,
      });
      this.logger.log(
        `Password reset OTP sent to ${to} — ID: ${result.data?.id}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send password reset OTP to ${to}: ${JSON.stringify(error)}`,
      );
      return false;
    }
  }
}
