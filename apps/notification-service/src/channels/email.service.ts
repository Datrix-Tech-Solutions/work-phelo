import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly appName = 'WorkPhelo ERP';

  constructor() {
    this.fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '';

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE !== 'false', // true for 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmailVerificationOtp(
    to: string,
    firstName: string,
    otp: string,
  ): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: `"${this.appName}" <${this.fromEmail}>`,
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
      this.logger.log(`✅ Verification OTP sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send verification OTP to ${to}: ${JSON.stringify(error)}`,
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
      await this.transporter.sendMail({
        from: `"${this.appName}" <${this.fromEmail}>`,
        to,
        subject: `You've been invited to ${tenantName} on ${this.appName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5;">You've been invited!</h2>
            <p>Hi ${firstName},</p>
            <p><strong>${tenantName}</strong> has invited you to join their workspace on ${this.appName}.</p>
            <p>Click the button below to set up your account. This link expires in <strong>24 hours</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptInviteUrl}"
                style="background: #4F46E5; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #666; font-size: 12px;">Or copy this link: ${acceptInviteUrl}</p>
          </div>
        `,
      });
      this.logger.log(`✅ Invite email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send invite email to ${to}: ${JSON.stringify(error)}`,
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
      await this.transporter.sendMail({
        from: `"${this.appName}" <${this.fromEmail}>`,
        to,
        subject: `${this.appName} - Reset your password`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5;">Password Reset Request</h2>
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your password. Click the button below to proceed.</p>
            <p>This link expires in <strong>15 minutes</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}"
                style="background: #4F46E5; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 12px;">Or copy this link: ${resetLink}</p>
            <p style="color: #666; font-size: 12px;">If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
      this.logger.log(`✅ Password reset email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send password reset email to ${to}: ${JSON.stringify(error)}`,
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
      await this.transporter.sendMail({
        from: `"${this.appName}" <${this.fromEmail}>`,
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
      this.logger.log(`✅ Password reset OTP sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send password reset OTP to ${to}: ${JSON.stringify(error)}`,
      );
      return false;
    }
  }
}
