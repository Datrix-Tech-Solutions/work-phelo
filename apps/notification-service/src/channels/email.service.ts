import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly appName = 'WorkPhelo ERP';
  private readonly appUrl: string;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@workphelo.com';
    this.appUrl = process.env.APP_URL || 'http://localhost:3000';
  }

  async sendEmailVerificationOtp(
    to: string,
    firstName: string,
    otp: string,
  ): Promise<boolean> {
    try {
      await this.resend.emails.send({
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
      return true;
    } catch (error) {
      this.logger.error(`Failed to send verification OTP to ${to}`, error);
      return false;
    }
  }

  async sendInviteEmail(
    to: string,
    firstName: string,
    acceptInviteUrl: string,
    tenantName: string,
  ): Promise<boolean> {
    const inviteUrl = acceptInviteUrl;
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `You've been invited to ${tenantName} on ${this.appName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5;">You've been invited!</h2>
            <p>Hi ${firstName},</p>
            <p><strong>${tenantName}</strong> has invited you to join their workspace on ${this.appName}.</p>
            <p>Click the button below to set up your account. This link expires in <strong>24 hours</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}"
                style="background: #4F46E5; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #666; font-size: 12px;">Or copy this link: ${inviteUrl}</p>
          </div>
        `,
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send invite email to ${to}`, error);
      return false;
    }
  }

  async sendPasswordResetLink(
    to: string,
    firstName: string,
    resetLink: string,
  ): Promise<boolean> {
    const resetUrl = resetLink;
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `${this.appName} - Reset your password`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5;">Password Reset Request</h2>
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your password. Click the button below to proceed.</p>
            <p>This link expires in <strong>15 minutes</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}"
                style="background: #4F46E5; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 12px;">Or copy this link: ${resetUrl}</p>
            <p style="color: #666; font-size: 12px;">If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}`, error);
      return false;
    }
  }

  async sendPasswordResetOtp(
    to: string,
    firstName: string,
    otp: string,
  ): Promise<boolean> {
    try {
      await this.resend.emails.send({
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
            <p style="color: #666; font-size: 12px;">If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset OTP to ${to}`, error);
      return false;
    }
  }
}
