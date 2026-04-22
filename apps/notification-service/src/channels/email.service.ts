import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly appName = 'WorkPhelo ERP';

  constructor() {
    if (!process.env.RESEND_API_KEY)
      throw new Error('RESEND_API_KEY is required');
    if (!process.env.RESEND_FROM_EMAIL)
      throw new Error('RESEND_FROM_EMAIL is required');
    this.apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL;
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
      `You're invited to ${tenantName} on ${this.appName}`,
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Invitation</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial, sans-serif;">

  <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; margin:40px auto; border-radius:8px; overflow:hidden;">

    <tr>
      <td style="padding:20px 30px;">
        <h2 style="margin:0; font-weight:bold;">
          <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
        </h2>
      </td>
    </tr>

    <tr>
      <td style="background:#eef1f4; padding:40px 30px;">
        <table width="100%">
          <tr>
            <td style="font-size:28px; font-weight:600; color:#555;">
              You've been invited
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:30px; color:#555; font-size:15px; line-height:1.6;">

        <p>Hi ${firstName},</p>

        <p>
          Welcome to <strong>${tenantName}</strong>. Your HR administrator has set up your account on WorkPhelo.
        </p>

        <p>To get started, click the button below to set your password and log in for the first time.</p>

        <p style="margin:30px 0;">
          <a href="${acceptInviteUrl}" style="
            background:#1a3557;
            color:#ffffff;
            padding:12px 20px;
            text-decoration:none;
            border-radius:6px;
            display:inline-block;
            font-weight:500;
          ">
            Set My Password →
          </a>
        </p>

        <p style="color:#777;">
          This link expires in 48 hours. If it expires before you use it, contact your HR administrator and they will send you a new one.
        </p>

        <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />

        <p style="color:#555;">Once you're in, you'll be able to:</p>
        <ul style="color:#555; padding-left:20px; line-height:1.8;">
          <li>View your leave balance and request time off</li>
          <li>Clock in and out</li>
          <li>Access your payslips</li>
          <li>Update your personal information</li>
        </ul>

        <p style="margin-top:24px;">Welcome aboard.</p>

      </td>
    </tr>

    <tr>
      <td style="padding:20px 30px; border-top:1px solid #eee;">
        <h3 style="margin:0;">
          <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
        </h3>
        <p style="color:#888; font-size:12px; margin-top:5px;">
          © 2026 WorkPhelo All rights reserved
        </p>
      </td>
    </tr>

  </table>

</body>
</html>`,
    );
  }

  async sendTerminationNotice(
    to: string,
    firstName: string,
    lastName: string,
    reason: string,
    lastWorkingDate: string,
  ): Promise<boolean> {
    const reasonLabels: Record<string, string> = {
      TERMINATION: 'Termination',
      CONTRACT_ENDED: 'End of Contract',
      RESIGNATION: 'Resignation',
      RETIREMENT: 'Retirement',
      REDUNDANCY: 'Redundancy',
      OTHER: 'Other',
    };
    const reasonLabel = reasonLabels[reason] ?? reason;
    const formattedDate = new Date(lastWorkingDate).toLocaleDateString(
      'en-GB',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      },
    );

    return this.send(
      to,
      `Important notice regarding your employment — ${this.appName}`,
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 8px;">
        <div style="background: white; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h1 style="color: #f97316; margin: 0 0 8px 0;">WorkPhelo ERP</h1>
          <h2 style="color: #111827; margin: 0 0 24px 0;">Employment Notice</h2>
          <p style="color: #374151;">Dear ${firstName} ${lastName},</p>
          <p style="color: #374151;">
            We are writing to formally notify you that your employment has ended
            due to: <strong>${reasonLabel}</strong>.
          </p>
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 24px 0; border-radius: 0 4px 4px 0;">
            <p style="color: #991b1b; margin: 0; font-size: 14px;">
              Your last working date is <strong>${formattedDate}</strong>.
            </p>
          </div>
          <p style="color: #374151;">
            Please ensure all company assets are returned and any outstanding
            clearance items are completed before your last working day.
          </p>
          <p style="color: #374151;">
            Your access to WorkPhelo and all associated systems will be revoked
            effective from your last working date.
          </p>
          <p style="color: #6b7280; font-size: 13px; margin-top: 32px;">
            If you have any questions, please contact your HR department directly.
          </p>
        </div>
      </div>
      `,
    );
  }

  async sendResignationSubmittedNotification(
    to: string,
    employeeFirstName: string,
    employeeLastName: string,
    lastWorkingDate: string,
    reason?: string,
    additionalNotes?: string,
    detailLink?: string,
  ): Promise<boolean> {
    const formattedDate = new Date(lastWorkingDate).toLocaleDateString(
      'en-GB',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      },
    );

    return this.send(
      to,
      `Resignation submitted by ${employeeFirstName} ${employeeLastName}`,
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 8px;">
        <div style="background: white; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h1 style="color: #f97316; margin: 0 0 8px 0;">WorkPhelo ERP</h1>
          <h2 style="color: #111827; margin: 0 0 24px 0;">New Resignation Submitted</h2>
          <p style="color: #374151;">
            <strong>${employeeFirstName} ${employeeLastName}</strong> has submitted a resignation.
          </p>
          <p style="color: #374151;">
            Proposed last working date: <strong>${formattedDate}</strong>
          </p>
          ${
            reason
              ? `<p style="color: #374151;">Reason: <strong>${reason}</strong></p>`
              : ''
          }
          ${
            additionalNotes
              ? `<p style="color: #374151;">Additional notes:<br />${additionalNotes}</p>`
              : ''
          }
          ${
            detailLink
              ? `<p style="margin-top: 24px;">
                  <a href="${detailLink}" style="
                    background:#1a3557;
                    color:#ffffff;
                    padding:12px 20px;
                    text-decoration:none;
                    border-radius:6px;
                    display:inline-block;
                    font-weight:500;
                  ">
                    View resignation details
                  </a>
                </p>`
              : ''
          }
        </div>
      </div>
      `,
    );
  }

  async sendLeaveRequestedNotification(
    to: string,
    employeeFirstName: string,
    employeeLastName: string,
    leaveTypeName: string,
    startDate: string,
    endDate: string,
    totalDays: number,
    reason?: string,
  ): Promise<boolean> {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

    return this.send(
      to,
      `Leave request from ${employeeFirstName} ${employeeLastName}`,
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Leave Request</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial, sans-serif;">

  <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; margin:40px auto; border-radius:8px; overflow:hidden;">

    <tr>
      <td style="padding:20px 30px;">
        <h2 style="margin:0; font-weight:bold;">
          <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
        </h2>
      </td>
    </tr>

    <tr>
      <td style="background:#eef1f4; padding:40px 30px;">
        <table width="100%">
          <tr>
            <td style="font-size:28px; font-weight:600; color:#555;">New Leave Request</td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:30px; color:#555; font-size:15px; line-height:1.6;">

        <p><strong>${employeeFirstName} ${employeeLastName}</strong> has submitted a leave request that requires your approval.</p>

        <p><strong>Request details:</strong></p>

        <table style="width:100%; border-collapse:collapse; margin:15px 0; color:#555; font-size:15px;">
          <tr>
            <td style="padding:8px 0; width:160px; font-weight:500;">Employee:</td>
            <td style="padding:8px 0;">${employeeFirstName} ${employeeLastName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:500;">Leave type:</td>
            <td style="padding:8px 0;">${leaveTypeName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:500;">Start date:</td>
            <td style="padding:8px 0;">${fmt(startDate)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:500;">End date:</td>
            <td style="padding:8px 0;">${fmt(endDate)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:500;">Working days:</td>
            <td style="padding:8px 0;">${totalDays} day${totalDays !== 1 ? 's' : ''}</td>
          </tr>
        </table>

        ${
          reason
            ? `
        <p><strong>Notes from ${employeeFirstName}:</strong></p>
        <p style="background:#f9f9f9; padding:16px; border-left:4px solid #ff6a00; margin:15px 0; color:#444; line-height:1.5;">
          ${reason}
        </p>`
            : ''
        }

        <p style="color:#777; font-size:14px;">
          Please log in to WorkPhelo to approve or reject this request.
        </p>

        <p style="margin-top:30px;">Thank you,</p>

      </td>
    </tr>

    <tr>
      <td style="padding:20px 30px; border-top:1px solid #eee;">
        <h3 style="margin:0;">
          <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
        </h3>
        <p style="color:#888; font-size:12px; margin-top:5px;">© 2026 WorkPhelo All rights reserved</p>
      </td>
    </tr>

  </table>

</body>
</html>`,
    );
  }

  async sendLeaveReviewedNotification(
    to: string,
    firstName: string,
    status: 'APPROVED' | 'REJECTED',
    leaveTypeName: string,
    startDate: string,
    endDate: string,
    totalDays: number,
    note?: string,
  ): Promise<boolean> {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

    const isApproved = status === 'APPROVED';
    const accentColor = isApproved ? '#16a34a' : '#dc2626';
    const bgColor = isApproved ? '#f0fdf4' : '#fef2f2';
    const borderColor = isApproved ? '#86efac' : '#fca5a5';
    const heroLabel = isApproved
      ? 'Leave Request Approved'
      : 'Leave Request Not Approved';

    return this.send(
      to,
      `Your ${leaveTypeName} request has been ${status.toLowerCase()}`,
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Leave Request ${status}</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial, sans-serif;">

  <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; margin:40px auto; border-radius:8px; overflow:hidden;">

    <tr>
      <td style="padding:20px 30px;">
        <h2 style="margin:0; font-weight:bold;">
          <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
        </h2>
      </td>
    </tr>

    <tr>
      <td style="background:#eef1f4; padding:40px 30px;">
        <table width="100%">
          <tr>
            <td style="font-size:28px; font-weight:600; color:#555;">${heroLabel}</td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:30px; color:#555; font-size:15px; line-height:1.6;">

        <p>Hi ${firstName},</p>

        <p style="background:${bgColor}; border:1px solid ${borderColor}; border-radius:6px; padding:16px; color:${accentColor}; font-weight:600; font-size:16px; margin:20px 0;">
          Your leave request has been <strong>${isApproved ? 'Approved' : 'Rejected'}</strong>.
        </p>

        <p><strong>Request details:</strong></p>

        <table style="width:100%; border-collapse:collapse; margin:15px 0; color:#555; font-size:15px;">
          <tr>
            <td style="padding:8px 0; width:160px; font-weight:500;">Leave type:</td>
            <td style="padding:8px 0;">${leaveTypeName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:500;">Start date:</td>
            <td style="padding:8px 0;">${fmt(startDate)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:500;">End date:</td>
            <td style="padding:8px 0;">${fmt(endDate)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:500;">Working days:</td>
            <td style="padding:8px 0;">${totalDays} day${totalDays !== 1 ? 's' : ''}</td>
          </tr>
        </table>

        ${
          note
            ? `
        <p><strong>Note from your reviewer:</strong></p>
        <p style="background:#f9f9f9; padding:16px; border-left:4px solid #ff6a00; margin:15px 0; color:#444; line-height:1.5;">
          ${note}
        </p>`
            : ''
        }

        <p style="color:#777; font-size:14px;">
          ${
            isApproved
              ? 'You can view your full leave history and remaining balances at any time by logging in.'
              : 'Your leave balance has not been affected by this decision. If you have questions, please speak with your manager or HR administrator.'
          }
        </p>

        <p style="margin-top:30px;">${isApproved ? 'Enjoy your time off!' : 'Thank you,'}</p>

      </td>
    </tr>

    <tr>
      <td style="padding:20px 30px; border-top:1px solid #eee;">
        <h3 style="margin:0;">
          <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
        </h3>
        <p style="color:#888; font-size:12px; margin-top:5px;">© 2026 WorkPhelo All rights reserved</p>
      </td>
    </tr>

  </table>

</body>
</html>`,
    );
  }

  async sendLeaveCancelledNotification(
    to: string,
    employeeFirstName: string,
    employeeLastName: string,
    leaveTypeName: string,
    startDate: string,
    endDate: string,
    totalDays: number,
  ): Promise<boolean> {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

    return this.send(
      to,
      `Leave request cancelled — ${employeeFirstName} ${employeeLastName}`,
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Leave Request Cancelled</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial, sans-serif;">

  <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; margin:40px auto; border-radius:8px; overflow:hidden;">

    <tr>
      <td style="padding:20px 30px;">
        <h2 style="margin:0; font-weight:bold;">
          <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
        </h2>
      </td>
    </tr>

    <tr>
      <td style="background:#eef1f4; padding:40px 30px;">
        <table width="100%">
          <tr>
            <td style="font-size:28px; font-weight:600; color:#555;">Leave Request Cancelled</td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:30px; color:#555; font-size:15px; line-height:1.6;">

        <p><strong>${employeeFirstName} ${employeeLastName}</strong> has cancelled their leave request. No action is required.</p>

        <p><strong>Cancelled request details:</strong></p>

        <table style="width:100%; border-collapse:collapse; margin:15px 0; color:#555; font-size:15px;">
          <tr>
            <td style="padding:8px 0; width:160px; font-weight:500;">Employee:</td>
            <td style="padding:8px 0;">${employeeFirstName} ${employeeLastName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:500;">Leave type:</td>
            <td style="padding:8px 0;">${leaveTypeName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:500;">Start date:</td>
            <td style="padding:8px 0;">${fmt(startDate)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:500;">End date:</td>
            <td style="padding:8px 0;">${fmt(endDate)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:500;">Working days:</td>
            <td style="padding:8px 0;">${totalDays} day${totalDays !== 1 ? 's' : ''}</td>
          </tr>
        </table>

        <p style="color:#777; font-size:14px;">
          The employee's leave balance has been restored and no further action is needed on your part.
        </p>

        <p style="margin-top:30px;">Thank you,</p>

      </td>
    </tr>

    <tr>
      <td style="padding:20px 30px; border-top:1px solid #eee;">
        <h3 style="margin:0;">
          <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
        </h3>
        <p style="color:#888; font-size:12px; margin-top:5px;">© 2026 WorkPhelo All rights reserved</p>
      </td>
    </tr>

  </table>

</body>
</html>`,
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
