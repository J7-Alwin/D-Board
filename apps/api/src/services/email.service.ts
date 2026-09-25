import nodemailer, { SendMailOptions } from 'nodemailer';

export interface SendPasswordResetOtpOptions {
  toEmail: string;
  username: string;
  otp: string;
}

export interface SendPasswordResetOptions {
  toEmail: string;
  username: string;
  resetToken: string;
}

export interface SendWelcomeOptions {
  toEmail: string;
  username: string;
  fullName?: string | null;
}

export interface SendInvitationOptions {
  toEmail: string;
  inviterName: string;
  projectName: string;
  projectKey?: string | null;
  role: string;
  message?: string | null;
  expiresAt: Date;
}

export interface SendProjectJoinedOptions {
  toEmail: string;
  username: string;
  projectName: string;
  role: string;
}

export interface SendPasswordChangedAlertOptions {
  toEmail: string;
  username: string;
  changedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface SendDataExportOptions {
  toEmail: string;
  username: string;
  exportedAt?: Date;
}

export interface SendAccountDeletedOptions {
  toEmail: string;
  username: string;
}

export interface SendWorkItemAssignedOptions {
  toEmail: string;
  assigneeName: string;
  assignerName: string;
  workItemTitle: string;
  workItemType: string;
  projectName: string;
  dueDate?: Date | null;
  link?: string;
}

function getTransporter() {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return null;
}

const getEmailFrom = () => process.env.EMAIL_FROM || 'D-Board <onboarding@resend.dev>';
const getAppUrl = () => process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:5173';

/**
 * Robust email delivery dispatcher:
 * - In production: throws if SMTP configuration is missing or if delivery fails (Item 13)
 * - In non-production: simulates via console log without printing secrets or OTPs
 */
async function deliverEmail(
  mailOptions: SendMailOptions,
  simulatorFn?: () => void
): Promise<boolean> {
  const isProduction = process.env.NODE_ENV === 'production';
  const transporter = getTransporter();

  if (transporter) {
    try {
      await transporter.sendMail(mailOptions);
      return true;
    } catch (err: any) {
      console.error('[Email Service Error]: Failed to send email via SMTP transport:', err);
      if (isProduction) {
        throw new Error(`Failed to deliver transactional email: ${err?.message || 'SMTP error'}`);
      }
      return false;
    }
  }

  if (isProduction) {
    throw new Error('Production SMTP transport unavailable: SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required');
  }

  if (process.env.NODE_ENV !== 'test' && simulatorFn) {
    simulatorFn();
  }
  return true;
}

/**
 * 1. Send Welcome Email on first registration / initial Google login
 */
export async function sendWelcomeEmail(options: SendWelcomeOptions): Promise<boolean> {
  const appUrl = getAppUrl();
  const displayName = options.fullName || options.username;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #1F1F1F;">Welcome to D-Board! 🚀</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 20px;">
        Hello <strong>${displayName}</strong>,<br/>
        Your D-Board account has been successfully created. You're all set to manage engineering projects, track sprint items, collaborate with your team, and organize technical documentation.
      </p>
      <div style="margin-bottom: 28px;">
        <a href="${appUrl}/app/dashboard" style="display: inline-block; background-color: #1F1F1F; color: #FFFFFF; font-weight: 600; font-size: 15px; padding: 12px 24px; border-radius: 9999px; text-decoration: none;">
          Go to Your Workspace &rarr;
        </a>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        Need help getting started? Check out project workspaces, Kanban boards, calendar deadlines, and notes.<br/>
        — The D-Board Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: 'Welcome to D-Board — Your Workspace is Ready',
      text: `Hello ${displayName},\n\nWelcome to D-Board! Your account has been created successfully.\n\nVisit your workspace: ${appUrl}/app/dashboard\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD WELCOME EMAIL SIMULATOR (Local Dev)]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Subject: Welcome to D-Board — Your Workspace is Ready`);
      console.log(`Workspace URL: ${appUrl}/app/dashboard`);
      console.log('====================================================');
    }
  );
}

/**
 * 2. Send 6-digit OTP verification code for password reset
 */
export async function sendPasswordResetOtpEmail(options: SendPasswordResetOtpOptions): Promise<boolean> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #1F1F1F;">Password Reset Verification Code</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 20px;">
        Hello <strong>${options.username}</strong>,<br/>
        We received a request to reset the password for your D-Board account. Use the 6-digit verification code below to set a new password:
      </p>
      <div style="margin-bottom: 24px; text-align: center;">
        <div style="display: inline-block; background-color: #FFFFFF; border: 2px dashed #1F1F1F; padding: 14px 32px; border-radius: 10px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1F1F1F; font-family: monospace;">
          ${options.otp}
        </div>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        This code is valid for <strong>15 minutes</strong> and can only be used once.<br/>
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: 'Your D-Board Password Reset Verification Code',
      text: `Hello ${options.username},\n\nYour password reset verification code is: ${options.otp}\n\nThis code expires in 15 minutes.\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD PASSWORD RESET OTP SIMULATOR (Local Dev)]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Subject: Your D-Board Password Reset Verification Code`);
      console.log(`OTP Code: [REDACTED] (Expires in 15 mins)`);
      console.log('====================================================');
    }
  );
}

export interface SendEmailVerificationOptions {
  toEmail: string;
  username: string;
  token: string;
}

/**
 * Send email verification link
 */
export async function sendEmailVerificationEmail(options: SendEmailVerificationOptions): Promise<boolean> {
  const appUrl = getAppUrl();
  const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(options.token)}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #1F1F1F;">Verify Your Email Address</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 20px;">
        Hello <strong>${options.username}</strong>,<br/>
        Thank you for joining D-Board. Please click the button below to verify your email address and activate project collaboration features:
      </p>
      <div style="margin-bottom: 28px;">
        <a href="${verifyUrl}" style="display: inline-block; background-color: #1F1F1F; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
          Verify Email Address &rarr;
        </a>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        This verification link will expire in 24 hours. If you did not create a D-Board account, please disregard this email.
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: 'Verify your D-Board email address',
      text: `Hello ${options.username},\n\nPlease verify your email by clicking the link below:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD EMAIL VERIFICATION SIMULATOR (Local Dev)]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Verify Link: ${appUrl}/verify-email?token=[REDACTED]`);
      console.log('====================================================');
    }
  );
}

/**
 * 3. Send Project Invitation Email (with direct join & register URL)
 */
export async function sendInvitationEmail(options: SendInvitationOptions): Promise<boolean> {
  const appUrl = getAppUrl();
  const invitationsUrl = `${appUrl}/app/invitations`;
  const registerUrl = `${appUrl}/register?email=${encodeURIComponent(options.toEmail)}`;
  const roleLabel = options.role === 'PROJECT_ADMIN' ? 'Project Administrator' : 'Project Member';
  const expiryFormatted = options.expiresAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #1F1F1F;">Project Invitation</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        <strong>${options.inviterName}</strong> has invited you to collaborate on <strong>${options.projectName}</strong>${options.projectKey ? ` [${options.projectKey}]` : ''} as a <strong>${roleLabel}</strong>.
      </p>
      ${
        options.message
          ? `<div style="background-color: #FFFFFF; border-left: 3px solid #1F1F1F; padding: 12px 16px; margin-bottom: 20px; font-style: italic; color: #333333; font-size: 14px;">"${options.message}"</div>`
          : ''
      }
      <div style="margin-bottom: 28px;">
        <a href="${invitationsUrl}" style="display: inline-block; background-color: #1F1F1F; color: #FFFFFF; font-weight: 600; font-size: 15px; padding: 12px 24px; border-radius: 9999px; text-decoration: none;">
          View & Accept Invitation &rarr;
        </a>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        This invitation will expire on ${expiryFormatted}.<br/>
        Don't have an account yet? <a href="${registerUrl}" style="color: #1F1F1F; font-weight: 600;">Sign up here</a> with this email address and your invitation will be waiting on your dashboard.
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: `You have been invited to join ${options.projectName} on D-Board`,
      text: `Hello,\n\n${options.inviterName} has invited you to join "${options.projectName}" on D-Board as a ${roleLabel}.${options.message ? `\n\nMessage: "${options.message}"` : ''}\n\nAccept your invitation: ${invitationsUrl}\n\nExpires on: ${expiryFormatted}\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD INVITATION DISPATCH SIMULATOR (Local Dev)]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Project: ${options.projectName} (${roleLabel})`);
      console.log(`Invited By: ${options.inviterName}`);
      console.log('====================================================');
    }
  );
}

/**
 * 4. Send Confirmation Email after successfully joining a project
 */
export async function sendProjectJoinedConfirmationEmail(options: SendProjectJoinedOptions): Promise<boolean> {
  const appUrl = getAppUrl();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #1F1F1F;">Project Joined Successfully 🎉</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 20px;">
        Hello <strong>${options.username}</strong>,<br/>
        You have successfully joined the project <strong>${options.projectName}</strong>. You now have full access to view tasks, participate in discussions, edit shared documents, and collaborate with your team.
      </p>
      <div style="margin-bottom: 28px;">
        <a href="${appUrl}/app/dashboard" style="display: inline-block; background-color: #1F1F1F; color: #FFFFFF; font-weight: 600; font-size: 15px; padding: 12px 24px; border-radius: 9999px; text-decoration: none;">
          Open Project Workspace &rarr;
        </a>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        You can view your active projects and assignments anytime on your dashboard.<br/>
        — The D-Board Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: `You've joined ${options.projectName} on D-Board`,
      text: `Hello ${options.username},\n\nYou have successfully joined "${options.projectName}".\n\nOpen your workspace: ${appUrl}/app/dashboard\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD PROJECT JOINED CONFIRMATION SIMULATOR]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Project: ${options.projectName}`);
      console.log('====================================================');
    }
  );
}

/**
 * 5. Legacy link-based password reset email
 */
export async function sendPasswordResetEmail(options: SendPasswordResetOptions): Promise<boolean> {
  const resetUrl = `${getAppUrl()}/reset-password?token=${encodeURIComponent(options.resetToken)}`;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: 'Reset your D-Board password',
      text: `Hello ${options.username},\n\nClick the link below to set a new password:\n${resetUrl}\n\n— The D-Board Team`,
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD PASSWORD RESET SIMULATOR]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Reset Token: [REDACTED]`);
      console.log('====================================================');
    }
  );
}

/**
 * 6. Send Security Alert: Password Changed
 */
export async function sendPasswordChangedAlertEmail(options: SendPasswordChangedAlertOptions): Promise<boolean> {
  const appUrl = getAppUrl();
  const timeFormatted = (options.changedAt || new Date()).toUTCString();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #DC2626;">Security Alert: Password Changed 🔒</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        Hello <strong>${options.username}</strong>,<br/>
        The password for your D-Board account was recently changed on <strong>${timeFormatted}</strong>.
      </p>
      ${
        options.ipAddress
          ? `<p style="font-size: 13px; color: #666666; margin-bottom: 16px;"><strong>Originating IP:</strong> ${options.ipAddress}</p>`
          : ''
      }
      <p style="font-size: 14px; line-height: 1.6; color: #575757; margin-bottom: 20px;">
        If you made this change, no further action is required. If you did <strong>not</strong> make this change, please reset your password immediately and contact security support.
      </p>
      <div style="margin-bottom: 28px;">
        <a href="${appUrl}/forgot-password" style="display: inline-block; background-color: #DC2626; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 9999px; text-decoration: none;">
          Secure Your Account &rarr;
        </a>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        This automated security notification was sent to ${options.toEmail}.<br/>
        — The D-Board Security Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: 'Security Alert: Your D-Board Password Was Changed',
      text: `Hello ${options.username},\n\nYour D-Board password was changed on ${timeFormatted}.\n\nIf you did not do this, please reset your password immediately: ${appUrl}/forgot-password\n\n— The D-Board Security Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD SECURITY ALERT SIMULATOR]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Time: ${timeFormatted}`);
      console.log('====================================================');
    }
  );
}

/**
 * 7. Send Data Export Completed Email
 */
export async function sendDataExportCompletedEmail(options: SendDataExportOptions): Promise<boolean> {
  const appUrl = getAppUrl();
  const timeFormatted = (options.exportedAt || new Date()).toUTCString();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #1F1F1F;">Personal Workspace Export Ready 📦</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        Hello <strong>${options.username}</strong>,<br/>
        Your personal workspace export was generated on <strong>${timeFormatted}</strong>. It contains your profile records, created projects, assigned work items, shared team notes, and recent activity history.
      </p>
      <div style="margin-bottom: 28px;">
        <a href="${appUrl}/app/settings/profile" style="display: inline-block; background-color: #1F1F1F; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 9999px; text-decoration: none;">
          Go to Account Settings &rarr;
        </a>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        — The D-Board Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: 'Your D-Board Workspace Export is Ready',
      text: `Hello ${options.username},\n\nYour workspace export was generated on ${timeFormatted}.\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD DATA EXPORT EMAIL SIMULATOR]');
      console.log(`To: ${options.toEmail}`);
      console.log('====================================================');
    }
  );
}

/**
 * 8. Send Account Deactivated Farewell Email
 */
export async function sendAccountDeletedEmail(options: SendAccountDeletedOptions): Promise<boolean> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #1F1F1F;">Account Deactivated</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        Hello <strong>${options.username}</strong>,<br/>
        As requested, your D-Board account has been deactivated and your personal details have been anonymized.
      </p>
      <p style="font-size: 14px; line-height: 1.5; color: #666666;">
        Thank you for collaborating with D-Board. If you ever wish to return, you can register a new account anytime.
      </p>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px; margin-top: 24px;">
        — The D-Board Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: 'Your D-Board Account Has Been Deactivated',
      text: `Hello ${options.username},\n\nYour account has been deactivated as requested.\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD ACCOUNT DEACTIVATED EMAIL SIMULATOR]');
      console.log(`To: ${options.toEmail}`);
      console.log('====================================================');
    }
  );
}

/**
 * 9. Send Work Item Assigned Notification Email
 */
export async function sendWorkItemAssignedEmail(options: SendWorkItemAssignedOptions): Promise<boolean> {
  const appUrl = getAppUrl();
  const link = options.link || `${appUrl}/app/my-work`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #2563EB;">New Work Item Assigned 📋</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        Hello <strong>${options.assigneeName}</strong>,<br/>
        <strong>${options.assignerName}</strong> assigned you a <strong>${options.workItemType}</strong> on project <strong>${options.projectName}</strong>:
      </p>
      <div style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
        <div style="font-size: 16px; font-weight: 700; color: #0F172A; margin-bottom: 4px;">${options.workItemTitle}</div>
        ${options.dueDate ? `<div style="font-size: 13px; color: #64748B;">Due Date: ${new Date(options.dueDate).toLocaleDateString()}</div>` : ''}
      </div>
      <div style="margin-bottom: 28px;">
        <a href="${link}" style="display: inline-block; background-color: #2563EB; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 10px 22px; border-radius: 9999px; text-decoration: none;">
          View Work Item &rarr;
        </a>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        You can customize your email notification preferences in Account Settings.<br/>
        — The D-Board Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: `[${options.projectName}] Assigned to you: ${options.workItemTitle}`,
      text: `Hello ${options.assigneeName},\n\n${options.assignerName} assigned you "${options.workItemTitle}" on project "${options.projectName}".\n\nView it here: ${link}\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD WORK ITEM ASSIGNED EMAIL SIMULATOR]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Title: ${options.workItemTitle}`);
      console.log(`Project: ${options.projectName}`);
      console.log('====================================================');
    }
  );
}
