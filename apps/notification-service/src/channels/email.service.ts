import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly appName = 'WorkPhelo ERP';

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || '';
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  }

  private async send(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    try {
      const res = await axios.post(
        'https://api.resend.com/emails',
        { from: this.fromEmail, to, subject, html },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const resData = res.data as { id?: string };
      this.logger.log(`Email sent to ${to} — ID: ${resData?.id}`);
      return true;
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown }; message?: string };
      this.logger.error(
        `Failed to send email to ${to}: ${JSON.stringify(e?.response?.data || e?.message)}`,
      );
      return false;
    }
  }

  async sendEmailVerificationOtp(
    to: string,
    firstName: string,
    otp: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `${otp} is your ${this.appName} verification code`,
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #f97316;">WorkPhelo ERP</h2>
        <p>Hi ${firstName},</p>
        <p>Your verification code is:</p>
        <div style="background: #f97316; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 24px 0;">
          ${otp}
        </div>
        <p style="color: #666;">This code expires in 10 minutes. Do not share it with anyone.</p>
      </div>
      `,
    );
  }

  async sendInviteEmail(
    to: string,
    firstName: string,
    tenantName: string,
    acceptInviteUrl: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `You've been invited to ${tenantName} on ${this.appName}`,
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 8px;">
        <div style="background: white; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h1 style="color: #f97316; margin: 0 0 8px 0;">WorkPhelo ERP</h1>
          <h2 style="color: #111827; margin: 0 0 24px 0;">You've been invited to ${tenantName}</h2>
          <p style="color: #374151;">Hi ${firstName},</p>
          <p style="color: #374151;"><strong>${tenantName}</strong> has added you as a team member on ${this.appName}.</p>
          <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 12px 16px; margin: 24px 0; border-radius: 0 4px 4px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">⏰ This link expires in <strong>48 hours</strong>.</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${acceptInviteUrl}" style="background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
              Set Your Password
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 12px;">Or copy: <span style="word-break: break-all;">${acceptInviteUrl}</span></p>
        </div>
      </div>
      `,
    );
  }

  async sendPasswordResetLink(
    to: string,
    firstName: string,
    resetLink: string,
    otpCode?: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `Reset your ${this.appName} password`,
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #f97316;">WorkPhelo ERP</h2>
        <p>Hi ${firstName},</p>
        <p>We received a request to reset your password. You have two ways to proceed — pick whichever is easiest:</p>

        <p style="font-weight: 600; margin-top: 24px;">Option 1 — Click the button</p>
        <div style="text-align: center; margin: 16px 0 24px;">
          <a href="${resetLink}" style="background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>

        ${
          otpCode
            ? `
        <p style="font-weight: 600; margin-top: 8px;">Option 2 — Enter this code on the verification page</p>
        <div style="text-align: center; margin: 16px 0 24px;">
          <div style="display: inline-block; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 32px;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827; font-family: monospace;">${otpCode}</span>
          </div>
        </div>
        `
            : ''
        }

        <p style="color: #6b7280; font-size: 13px; margin-top: 8px;">This code and link expire in <strong>15 minutes</strong>.</p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">If you did not request a password reset, you can safely ignore this email.</p>
      </div>
      `,
    );
  }
}
