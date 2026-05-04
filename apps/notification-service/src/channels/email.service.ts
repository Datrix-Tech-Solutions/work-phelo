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

  async sendEmployeeInviteEmail(
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
          This invitation link will expire. If it expires before you use it, contact your HR administrator and they will send you a new one.
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

  async sendTenantAdminWelcomeEmail(
    to: string,
    firstName: string,
    tenantName: string,
    acceptInviteUrl: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `Welcome to ${tenantName} on ${this.appName}`,
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Welcome to WorkPhelo</title>
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
              Welcome to your company workspace
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:30px; color:#555; font-size:15px; line-height:1.6;">
        <p>Hi ${firstName},</p>

        <p>
          Welcome to <strong>${tenantName}</strong> on WorkPhelo. Your company workspace is ready and your Company Admin account has been created.
        </p>

        <p>
          To activate your account, set your password using the button below. Once signed in, you will be able to complete your company setup and manage your team.
        </p>

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
            Activate Company Admin Account →
          </a>
        </p>

        <p style="color:#777;">
          This invitation link will expire. If it expires before you use it, contact the platform owner or request a fresh invite.
        </p>

        <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />

        <p style="color:#555;">As Company Admin, you will be able to:</p>
        <ul style="color:#555; padding-left:20px; line-height:1.8;">
          <li>Finish setting up your company workspace</li>
          <li>Invite employees and assign access</li>
          <li>Configure HR settings, departments, and roles</li>
          <li>Manage your company operations in WorkPhelo</li>
        </ul>

        <p style="margin-top:24px;">We’re excited to have you on board.</p>
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
    detailLink?: string,
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

        <p><strong>${employeeFirstName} ${employeeLastName}</strong> has submitted a leave request.</p>
        <p>Company Admin review is required before this request can be approved or rejected.</p>

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

        ${
          detailLink
            ? `
        <p style="margin:24px 0;">
          <a href="${detailLink}" style="
            background:#1a3557;
            color:#ffffff;
            padding:12px 20px;
            text-decoration:none;
            border-radius:6px;
            display:inline-block;
            font-weight:500;
          ">
            Open leave request
          </a>
        </p>`
            : ''
        }

        <p style="color:#777; font-size:14px;">
          Open WorkPhelo to view the request details and follow up as needed.
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

        

        <p style="color: #6b7280; font-size: 13px; margin-top: 8px;">This code and link expire in <strong>15 minutes</strong>.</p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">If you did not request a password reset, you can safely ignore this email.</p>
      </div>
      `,
    );
  }

  async sendTimeCorrectionNotification(
    to: string,
    recipientFirstName: string,
    employeeFullName: string,
    attendanceDate: string,
    requestedIn: string | null,
    requestedOut: string | null,
    reason: string,
    detailLink?: string,
  ): Promise<boolean> {
    const formatTime = (iso: string | null) =>
      iso
        ? new Date(iso).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        : '—';

    return this.send(
      to,
      `Time correction request pending your approval — ${employeeFullName}`,
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Time Correction Request</title>
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
        <p style="font-size:28px; font-weight:600; color:#555; margin:0;">Time Correction Request</p>
      </td>
    </tr>
    <tr>
      <td style="padding:30px; color:#555; font-size:15px; line-height:1.6;">
        <p>Hi ${recipientFirstName},</p>
        <p><strong>${employeeFullName}</strong> has submitted a time correction request that requires your approval.</p>
        <p><strong>Correction details:</strong></p>
        <table style="width:100%; border-collapse:collapse; margin:15px 0; color:#555; font-size:14px;">
          <tr style="background:#f9fafb;">
            <td style="padding:10px 12px; border:1px solid #e5e7eb; font-weight:600; width:40%;">Date</td>
            <td style="padding:10px 12px; border:1px solid #e5e7eb;">${attendanceDate}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px; border:1px solid #e5e7eb; font-weight:600;">Requested Clock-In</td>
            <td style="padding:10px 12px; border:1px solid #e5e7eb;">${formatTime(requestedIn)}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:10px 12px; border:1px solid #e5e7eb; font-weight:600;">Requested Clock-Out</td>
            <td style="padding:10px 12px; border:1px solid #e5e7eb;">${formatTime(requestedOut)}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px; border:1px solid #e5e7eb; font-weight:600;">Reason</td>
            <td style="padding:10px 12px; border:1px solid #e5e7eb;">${reason}</td>
          </tr>
        </table>
        ${
          detailLink
            ? `
        <p style="margin:24px 0;">
          <a href="${detailLink}" style="background:#1a3557; color:#ffffff; padding:12px 20px; text-decoration:none; border-radius:6px; display:inline-block; font-weight:500;">
            Review Correction →
          </a>
        </p>`
            : ''
        }
        <p style="color:#777; font-size:13px;">Please log in to WorkPhelo to approve or reject this request.</p>
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

  async sendAppraisalSelfSubmittedNotification(
    to: string,
    managerFirstName: string,
    employeeFullName: string,
    cycleTitle: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `Self-assessment submitted by ${employeeFullName}`,
      `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Self-Assessment Submitted</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;margin:40px auto;border-radius:8px;overflow:hidden;">
    <tr><td style="padding:20px 30px;">
      <h2 style="margin:0;font-weight:bold;">
        <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
      </h2>
    </td></tr>
    <tr><td style="background:#eef1f4;padding:40px 30px;">
      <p style="font-size:28px;font-weight:600;color:#555;margin:0;">Self-Assessment Ready for Review</p>
    </td></tr>
    <tr><td style="padding:30px;color:#555;font-size:15px;line-height:1.6;">
      <p>Hi ${managerFirstName},</p>
      <p><strong>${employeeFullName}</strong> has submitted their self-assessment for the <strong>${cycleTitle}</strong> appraisal cycle and it is now ready for your manager review.</p>
      <p>Please log in to WorkPhelo to complete your review.</p>
      <p style="margin-top:30px;">Thank you,</p>
    </td></tr>
    <tr><td style="padding:20px 30px;border-top:1px solid #eee;">
      <h3 style="margin:0;"><span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span></h3>
      <p style="color:#888;font-size:12px;margin-top:5px;">© 2026 WorkPhelo All rights reserved</p>
    </td></tr>
  </table>
</body>
</html>`,
    );
  }

  async sendAppraisalSelfReminderNotification(
    to: string,
    employeeFirstName: string,
    cycleTitle: string,
    deadline: string,
    daysRemaining: number,
  ): Promise<boolean> {
    const deadlineLabel = new Date(`${deadline}T00:00:00`).toLocaleDateString(
      'en-GB',
      {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      },
    );
    const headline =
      daysRemaining === 0
        ? 'Your Self-Assessment Is Due Today'
        : 'Self-Assessment Reminder';
    const bodyCopy =
      daysRemaining === 0
        ? `Your self-assessment for the <strong>${cycleTitle}</strong> appraisal cycle is due today.`
        : `Your self-assessment for the <strong>${cycleTitle}</strong> appraisal cycle is due in <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>.`;

    return this.send(
      to,
      daysRemaining === 0
        ? `Your self-assessment is due today — ${cycleTitle}`
        : `Self-assessment reminder — ${cycleTitle}`,
      `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Self-Assessment Reminder</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;margin:40px auto;border-radius:8px;overflow:hidden;">
    <tr><td style="padding:20px 30px;">
      <h2 style="margin:0;font-weight:bold;">
        <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
      </h2>
    </td></tr>
    <tr><td style="background:#eef1f4;padding:40px 30px;">
      <p style="font-size:28px;font-weight:600;color:#555;margin:0;">${headline}</p>
    </td></tr>
    <tr><td style="padding:30px;color:#555;font-size:15px;line-height:1.6;">
      <p>Hi ${employeeFirstName},</p>
      <p>${bodyCopy}</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Deadline</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${deadlineLabel}</td>
        </tr>
      </table>
      <p>Please log in to WorkPhelo to complete your appraisal submission.</p>
      <p style="margin-top:30px;">Thank you,</p>
    </td></tr>
    <tr><td style="padding:20px 30px;border-top:1px solid #eee;">
      <h3 style="margin:0;"><span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span></h3>
      <p style="color:#888;font-size:12px;margin-top:5px;">© 2026 WorkPhelo All rights reserved</p>
    </td></tr>
  </table>
</body>
</html>`,
    );
  }

  async sendAppraisalManagerReminderNotification(
    to: string,
    managerFirstName: string,
    employeeFullName: string,
    cycleTitle: string,
    deadline: string,
    daysRemaining: number,
  ): Promise<boolean> {
    const deadlineLabel = new Date(`${deadline}T00:00:00`).toLocaleDateString(
      'en-GB',
      {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      },
    );
    const headline =
      daysRemaining === 0
        ? 'Manager Review Due Today'
        : 'Manager Review Reminder';
    const bodyCopy =
      daysRemaining === 0
        ? `Your manager review for <strong>${employeeFullName}</strong> in the <strong>${cycleTitle}</strong> appraisal cycle is due today.`
        : `Your manager review for <strong>${employeeFullName}</strong> in the <strong>${cycleTitle}</strong> appraisal cycle is due in <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>.`;

    return this.send(
      to,
      daysRemaining === 0
        ? `Manager review is due today — ${cycleTitle}`
        : `Manager review reminder — ${cycleTitle}`,
      `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Manager Review Reminder</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;margin:40px auto;border-radius:8px;overflow:hidden;">
    <tr><td style="padding:20px 30px;">
      <h2 style="margin:0;font-weight:bold;">
        <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
      </h2>
    </td></tr>
    <tr><td style="background:#eef1f4;padding:40px 30px;">
      <p style="font-size:28px;font-weight:600;color:#555;margin:0;">${headline}</p>
    </td></tr>
    <tr><td style="padding:30px;color:#555;font-size:15px;line-height:1.6;">
      <p>Hi ${managerFirstName},</p>
      <p>${bodyCopy}</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Deadline</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${deadlineLabel}</td>
        </tr>
      </table>
      <p>Please log in to WorkPhelo to complete the manager review.</p>
      <p style="margin-top:30px;">Thank you,</p>
    </td></tr>
    <tr><td style="padding:20px 30px;border-top:1px solid #eee;">
      <h3 style="margin:0;"><span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span></h3>
      <p style="color:#888;font-size:12px;margin-top:5px;">© 2026 WorkPhelo All rights reserved</p>
    </td></tr>
  </table>
</body>
</html>`,
    );
  }

  async sendSchedulePublishedNotification(
    to: string,
    employeeFirstName: string,
    effectiveFrom: string,
    shiftType: string,
    startTime: string,
    endTime: string,
    scheduleLink: string,
  ): Promise<boolean> {
    const formattedDate = new Date(
      effectiveFrom + 'T00:00:00',
    ).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const shiftLabel = shiftType.charAt(0) + shiftType.slice(1).toLowerCase();
    return this.send(
      to,
      'Your shift schedule has been published',
      `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Schedule Published</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;margin:40px auto;border-radius:8px;overflow:hidden;">
    <tr><td style="padding:20px 30px;">
      <h2 style="margin:0;font-weight:bold;">
        <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
      </h2>
    </td></tr>
    <tr><td style="background:#eef1f4;padding:40px 30px;">
      <p style="font-size:28px;font-weight:600;color:#555;margin:0;">Your Schedule Has Been Published</p>
    </td></tr>
    <tr><td style="padding:30px;color:#555;font-size:15px;line-height:1.6;">
      <p>Hi ${employeeFirstName},</p>
      <p>A new shift schedule has been published for you. Here are the details:</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin:16px 0;">
        <tr><td style="font-weight:600;color:#333;width:140px;">Effective From</td><td style="color:#555;">${formattedDate}</td></tr>
        <tr style="background:#f9f9f9;"><td style="font-weight:600;color:#333;">Shift Type</td><td style="color:#555;">${shiftLabel}</td></tr>
        <tr><td style="font-weight:600;color:#333;">Hours</td><td style="color:#555;">${startTime} – ${endTime}</td></tr>
      </table>
      <p>
        <a href="${scheduleLink}" style="display:inline-block;padding:12px 24px;background:#0d1b3e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">View My Schedule</a>
      </p>
      <p style="margin-top:30px;">Thank you,</p>
    </td></tr>
    <tr><td style="padding:20px 30px;border-top:1px solid #eee;">
      <h3 style="margin:0;"><span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span></h3>
      <p style="color:#888;font-size:12px;margin-top:5px;">© 2026 WorkPhelo All rights reserved</p>
    </td></tr>
  </table>
</body>
      </html>`,
    );
  }

  private sendShiftSwapEmail(
    to: string,
    subject: string,
    heading: string,
    firstName: string,
    bodyHtml: string,
    ctaLabel?: string,
    ctaLink?: string,
  ): Promise<boolean> {
    const cta =
      ctaLabel && ctaLink
        ? `<p>
        <a href="${ctaLink}" style="display:inline-block;padding:12px 24px;background:#0d1b3e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">${ctaLabel}</a>
      </p>`
        : '';

    return this.send(
      to,
      subject,
      `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>${heading}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;margin:40px auto;border-radius:8px;overflow:hidden;">
    <tr><td style="padding:20px 30px;">
      <h2 style="margin:0;font-weight:bold;">
        <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
      </h2>
    </td></tr>
    <tr><td style="background:#eef1f4;padding:40px 30px;">
      <p style="font-size:28px;font-weight:600;color:#555;margin:0;">${heading}</p>
    </td></tr>
    <tr><td style="padding:30px;color:#555;font-size:15px;line-height:1.6;">
      <p>Hi ${firstName},</p>
      ${bodyHtml}
      ${cta}
      <p style="margin-top:30px;">Thank you,</p>
    </td></tr>
    <tr><td style="padding:20px 30px;border-top:1px solid #eee;">
      <h3 style="margin:0;"><span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span></h3>
      <p style="color:#888;font-size:12px;margin-top:5px;">© 2026 WorkPhelo All rights reserved</p>
    </td></tr>
  </table>
</body>
</html>`,
    );
  }

  async sendShiftSwapRequestedNotification(
    to: string,
    firstName: string,
    recipientRole: 'REQUESTER' | 'COLLEAGUE',
    counterpartFullName: string,
    requesterFullName: string,
    requesterShiftLabel: string,
    targetShiftLabel: string,
    reason?: string | null,
    scheduleLink?: string,
  ): Promise<boolean> {
    const body = [
      recipientRole === 'REQUESTER'
        ? `<p>Your shift swap request with <strong>${counterpartFullName}</strong> has been submitted and is awaiting their response.</p>`
        : `<p><strong>${requesterFullName}</strong> has requested a shift swap with you.</p>`,
      `<table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Their shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${requesterShiftLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">Swap target</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${targetShiftLabel}</td>
        </tr>
      </table>`,
      reason ? `<p><strong>Reason:</strong> ${reason}</p>` : '',
      recipientRole === 'COLLEAGUE'
        ? `<p>Please log in to WorkPhelo to accept or decline this request within 48 hours.</p>`
        : '<p>You can track the request status from your schedule screen.</p>',
    ].join('');

    return this.sendShiftSwapEmail(
      to,
      recipientRole === 'REQUESTER'
        ? `Shift swap request submitted with ${counterpartFullName}`
        : `${requesterFullName} requested a shift swap with you`,
      recipientRole === 'REQUESTER'
        ? 'Shift Swap Request Submitted'
        : 'Shift Swap Request Received',
      firstName,
      body,
      scheduleLink ? 'Open Scheduling' : undefined,
      scheduleLink,
    );
  }

  async sendShiftSwapPendingManagerNotification(
    to: string,
    firstName: string,
    requesterFullName: string,
    targetFullName: string,
    requesterShiftLabel: string,
    targetShiftLabel: string,
    reason?: string | null,
    reviewLink?: string,
  ): Promise<boolean> {
    const body = [
      `<p>A shift swap between <strong>${requesterFullName}</strong> and <strong>${targetFullName}</strong> is awaiting your approval.</p>`,
      `<table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Requester shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${requesterShiftLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">Colleague shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${targetShiftLabel}</td>
        </tr>
      </table>`,
      reason ? `<p><strong>Reason:</strong> ${reason}</p>` : '',
      '<p>Please review the request in the scheduling section.</p>',
    ].join('');

    return this.sendShiftSwapEmail(
      to,
      `Shift swap awaiting your approval — ${requesterFullName} and ${targetFullName}`,
      'Shift Swap Awaiting Approval',
      firstName,
      body,
      reviewLink ? 'Review Swap Request' : undefined,
      reviewLink,
    );
  }

  async sendShiftSwapDeclinedNotification(
    to: string,
    firstName: string,
    counterpartFullName: string,
    scheduleLink?: string,
  ): Promise<boolean> {
    return this.sendShiftSwapEmail(
      to,
      `Shift swap update with ${counterpartFullName}`,
      'Shift Swap Declined',
      firstName,
      `<p>Your shift swap request with <strong>${counterpartFullName}</strong> was declined. Your original shifts remain unchanged.</p>`,
      scheduleLink ? 'Open Scheduling' : undefined,
      scheduleLink,
    );
  }

  async sendShiftSwapApprovedNotification(
    to: string,
    firstName: string,
    counterpartFullName: string,
    requesterShiftLabel: string,
    targetShiftLabel: string,
    scheduleLink?: string,
  ): Promise<boolean> {
    return this.sendShiftSwapEmail(
      to,
      `Your shift swap with ${counterpartFullName} was approved`,
      'Shift Swap Approved',
      firstName,
      `<p>Your shift swap with <strong>${counterpartFullName}</strong> was approved.</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Original requester shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${requesterShiftLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">Original colleague shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${targetShiftLabel}</td>
        </tr>
      </table>
      <p>Your schedule has been updated to reflect the approved swap.</p>`,
      scheduleLink ? 'View Updated Schedule' : undefined,
      scheduleLink,
    );
  }

  async sendShiftSwapRejectedNotification(
    to: string,
    firstName: string,
    counterpartFullName: string,
    rejectionReason: string,
    requesterShiftLabel: string,
    targetShiftLabel: string,
    scheduleLink?: string,
  ): Promise<boolean> {
    return this.sendShiftSwapEmail(
      to,
      `Your shift swap with ${counterpartFullName} was rejected`,
      'Shift Swap Rejected',
      firstName,
      `<p>Your shift swap with <strong>${counterpartFullName}</strong> was rejected by the manager.</p>
      <p><strong>Reason:</strong> ${rejectionReason}</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Requester shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${requesterShiftLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">Colleague shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${targetShiftLabel}</td>
        </tr>
      </table>
      <p>Your original shifts remain unchanged.</p>`,
      scheduleLink ? 'Open Scheduling' : undefined,
      scheduleLink,
    );
  }

  async sendShiftSwapExpiredNotification(
    to: string,
    firstName: string,
    counterpartFullName: string,
    requesterShiftLabel: string,
    targetShiftLabel: string,
    scheduleLink?: string,
  ): Promise<boolean> {
    return this.sendShiftSwapEmail(
      to,
      `Your shift swap with ${counterpartFullName} expired`,
      'Shift Swap Expired',
      firstName,
      `<p>Your shift swap with <strong>${counterpartFullName}</strong> expired without a response within 48 hours.</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Requester shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${requesterShiftLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">Colleague shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${targetShiftLabel}</td>
        </tr>
      </table>
      <p>Your original shifts remain unchanged.</p>`,
      scheduleLink ? 'Open Scheduling' : undefined,
      scheduleLink,
    );
  }

  async sendAppraisalManagerReviewedNotification(
    to: string,
    employeeFirstName: string,
    cycleTitle: string,
    finalScore: number,
    finalRating: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `Your appraisal review is complete — ${cycleTitle}`,
      `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Appraisal Complete</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;margin:40px auto;border-radius:8px;overflow:hidden;">
    <tr><td style="padding:20px 30px;">
      <h2 style="margin:0;font-weight:bold;">
        <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
      </h2>
    </td></tr>
    <tr><td style="background:#eef1f4;padding:40px 30px;">
      <p style="font-size:28px;font-weight:600;color:#555;margin:0;">Appraisal Review Complete</p>
    </td></tr>
    <tr><td style="padding:30px;color:#555;font-size:15px;line-height:1.6;">
      <p>Hi ${employeeFirstName},</p>
      <p>Your manager has completed the review for the <strong>${cycleTitle}</strong> appraisal cycle.</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Final Score</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${finalScore}%</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">Rating</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${finalRating}</td>
        </tr>
      </table>
      <p>Log in to WorkPhelo to view your full appraisal details.</p>
      <p style="margin-top:30px;">Thank you,</p>
    </td></tr>
    <tr><td style="padding:20px 30px;border-top:1px solid #eee;">
      <h3 style="margin:0;"><span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span></h3>
      <p style="color:#888;font-size:12px;margin-top:5px;">© 2026 WorkPhelo All rights reserved</p>
    </td></tr>
  </table>
</body>
</html>`,
    );
  }
}
