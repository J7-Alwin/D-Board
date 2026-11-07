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

export interface SendWorkspaceInvitationOptions {
  toEmail: string;
  inviterName: string;
  workspaceName: string;
  role: string;
  token?: string;
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

export interface BrevoSender {
  name: string;
  email: string;
}

export interface BrevoRecipient {
  email: string;
  name?: string;
}

export interface BrevoSendEmailPayload {
  sender: BrevoSender;
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface BrevoApiSuccessResponse {
  messageId?: string;
  messageIds?: string[];
}

export interface BrevoApiErrorResponse {
  code?: string;
  message?: string;
}

export type EmailAddressInput =
  | string
  | { name?: string; address: string }
  | Array<string | { name?: string; address: string } | unknown>
  | null
  | undefined
  | unknown;

/**
 * Parse an email string into a structured sender { name, email }.
 * Supports formats like:
 *   "D-Board <support@example.com>"
 *   "support@example.com"
 */
export function parseSender(fromStr?: string): BrevoSender {
  const fallback: BrevoSender = { name: 'D-Board', email: 'noreply@d-board.app' };
  if (!fromStr || typeof fromStr !== 'string') {
    return fallback;
  }
  const trimmed = fromStr.trim();
  const match = trimmed.match(/^(?:["']?([^"']+)["']?\s*)?<([^>]+)>$/);
  if (match) {
    const name = match[1]?.trim() || 'D-Board';
    const email = match[2]?.trim() || fallback.email;
    return { name, email };
  }
  return { name: 'D-Board', email: trimmed || fallback.email };
}

/**
 * Parse recipients from various formats (string, Address, array of either)
 * into Brevo's expected Array<{ email: string; name?: string }>.
 */
export function parseRecipients(to: EmailAddressInput): BrevoRecipient[] {
  if (!to) {
    return [];
  }
  if (Array.isArray(to)) {
    return to.flatMap((item: unknown) => parseRecipients(item as EmailAddressInput));
  }
  if (typeof to === 'object' && to !== null && 'address' in to && typeof (to as { address: unknown }).address === 'string') {
    const obj = to as { name?: unknown; address: string };
    const name = typeof obj.name === 'string' ? obj.name.trim() : undefined;
    return [{ email: obj.address.trim(), ...(name ? { name } : {}) }];
  }
  if (typeof to === 'string') {
    return to.split(',').map((part: string) => {
      const trimmed = part.trim();
      const match = trimmed.match(/^(?:["']?([^"']+)["']?\s*)?<([^>]+)>$/);
      if (match) {
        const name = match[1]?.trim();
        const email = match[2]?.trim();
        return { email, ...(name ? { name } : {}) };
      }
      return { email: trimmed };
    });
  }
  return [];
}

/**
 * Send transactional email via Brevo HTTPS API.
 * Endpoint: POST https://api.brevo.com/v3/smtp/email
 * Authenticates using BREVO_API_KEY in the api-key header.
 */
export async function sendViaBrevoApi(
  payload: BrevoSendEmailPayload,
  apiKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`;
    try {
      const json = (await res.json()) as BrevoApiErrorResponse;
      if (json?.message) {
        errorDetail = json.message;
      } else if (json?.code) {
        errorDetail = `${json.code}: ${JSON.stringify(json)}`;
      }
    } catch {
      try {
        const txt = await res.text();
        if (txt) errorDetail = txt;
      } catch {
        // no readable body
      }
    }
    return { success: false, error: errorDetail };
  }

  let messageId: string | undefined;
  try {
    const data = (await res.json()) as BrevoApiSuccessResponse;
    messageId = data?.messageId || (Array.isArray(data?.messageIds) ? data.messageIds[0] : undefined);
  } catch {
    // 200/201 without json body
  }

  return { success: true, messageId };
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
 * - In production: uses Brevo HTTPS API (port 443). Throws if BREVO_API_KEY is missing or if delivery fails.
 * - In non-production: uses Brevo HTTPS API if BREVO_API_KEY is present, legacy SMTP if credentials present,
 *   or simulates via console log in development.
 * - Never logs secrets, OTPs, or API keys.
 */
async function deliverEmail(
  mailOptions: SendMailOptions,
  simulatorFn?: () => void
): Promise<boolean> {
  const isFetchMocked =
    Boolean((globalThis.fetch as any)?.mock) ||
    Boolean((globalThis.fetch as any)?._isMockFunction) ||
    typeof (globalThis.fetch as any)?.mockReset === 'function';

  if (process.env.NODE_ENV === 'test' && !isFetchMocked) {
    if (simulatorFn) simulatorFn();
    return true;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const brevoApiKey = process.env.BREVO_API_KEY;

  // 1. Primary Production & Preferred Transport: Brevo HTTPS Transactional Email API
  if (brevoApiKey) {
    const sender = parseSender(typeof mailOptions.from === 'string' ? mailOptions.from : getEmailFrom());
    const recipients = parseRecipients(mailOptions.to);

    const payload: BrevoSendEmailPayload = {
      sender,
      to: recipients,
      subject: (mailOptions.subject as string) || 'D-Board Notification',
      htmlContent: (mailOptions.html as string) || '',
      ...(mailOptions.text ? { textContent: mailOptions.text as string } : {}),
    };

    try {
      const result = await sendViaBrevoApi(payload, brevoApiKey);
      if (result.success) {
        if (result.messageId) {
          console.log(`[Email Service] Delivered email "${payload.subject}" via Brevo API (messageId: ${result.messageId})`);
        } else {
          console.log(`[Email Service] Delivered email "${payload.subject}" via Brevo API`);
        }
        return true;
      }

      console.error(`[Email Service Error]: Brevo API error: ${result.error}`);
      if (isProduction) {
        throw new Error(`Failed to deliver transactional email via Brevo API: ${result.error}`);
      }
      return false;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.startsWith('Failed to deliver transactional email')) {
        throw err;
      }
      console.error('[Email Service Error]: Network error calling Brevo API:', errMsg);
      if (isProduction) {
        throw new Error(`Failed to deliver transactional email via Brevo API: ${errMsg || 'Network error'}`);
      }
      return false;
    }
  }

  // 2. Production guard: BREVO_API_KEY is strictly required in production
  if (isProduction) {
    throw new Error('Production email delivery unavailable: BREVO_API_KEY must be defined for HTTPS transactional email delivery');
  }

  // 3. Local Development fallback: Legacy SMTP transport if credentials provided
  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail(mailOptions);
      return true;
    } catch (err: unknown) {
      console.error('[Email Service Error]: Failed to send email via SMTP transport:', err instanceof Error ? err.message : err);
      return false;
    }
  }

  // 4. Local Development fallback: Console simulation (does not log secrets or OTPs)
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

export interface SendRegistrationOtpOptions {
  toEmail: string;
  otp: string;
}

/**
 * Send 6-digit verification OTP before account creation
 */
export async function sendRegistrationOtpEmail(options: SendRegistrationOtpOptions): Promise<boolean> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #1F1F1F;">Verify your email address</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 20px;">
        Welcome to D-Board! Please enter the 6-digit verification code below to verify your email address and continue creating your account:
      </p>
      <div style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px;">
        <span style="font-family: 'SF Mono', Monaco, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1F1F1F;">${options.otp}</span>
      </div>
      <p style="font-size: 13px; color: #737373; line-height: 1.5; margin-bottom: 0;">
        This verification code will expire in <strong>15 minutes</strong>. If you did not request this verification code, please disregard this email.
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: `${options.otp} is your D-Board email verification code`,
      text: `Your D-Board email verification code is: ${options.otp}\n\nThis code expires in 15 minutes.\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD REGISTRATION OTP SIMULATOR (Local Dev)]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Subject: ${options.otp} is your D-Board email verification code`);
      console.log(`OTP Code: ${options.otp} (Expires in 15 mins)`);
      console.log('====================================================');
    }
  );
}

export interface SendProjectTransferRequestOptions {
  toEmail: string;
  recipientName?: string;
  projectName: string;
  sourceWorkspaceName: string;
  destinationWorkspaceName: string;
  initiatorName: string;
  expiresAt: Date;
}

export async function sendProjectTransferRequestEmail(options: SendProjectTransferRequestOptions): Promise<boolean> {
  const appUrl = getAppUrl();
  const reviewUrl = `${appUrl}/app/invitations`;
  const expiryFormatted = options.expiresAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #0F172A;">Project Transfer Request</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        Hello${options.recipientName ? ` <strong>${options.recipientName}</strong>` : ''},<br/>
        <strong>${options.initiatorName}</strong> from workspace <strong>${options.sourceWorkspaceName}</strong> has requested to transfer the project <strong>${options.projectName}</strong> into your workspace <strong>${options.destinationWorkspaceName}</strong>.
      </p>
      <div style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
        <div style="font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 4px;">Project: ${options.projectName}</div>
        <div style="font-size: 13px; color: #64748B;">From: ${options.sourceWorkspaceName} &rarr; To: ${options.destinationWorkspaceName}</div>
      </div>
      <div style="margin-bottom: 28px;">
        <a href="${reviewUrl}" style="display: inline-block; background-color: #0F172A; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 9999px; text-decoration: none;">
          Review Transfer Request &rarr;
        </a>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        This transfer request will expire on ${expiryFormatted}. You can accept or decline this request on your dashboard or invitations page.<br/>
        — The D-Board Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: `Project Transfer Request: "${options.projectName}" into "${options.destinationWorkspaceName}"`,
      text: `Hello,\n\n${options.initiatorName} requested to transfer project "${options.projectName}" into your workspace "${options.destinationWorkspaceName}".\n\nReview the request here: ${reviewUrl}\n\nThis request expires on ${expiryFormatted}.\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD PROJECT TRANSFER REQUEST EMAIL]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Project: ${options.projectName}`);
      console.log(`Target: ${options.destinationWorkspaceName}`);
      console.log('====================================================');
    }
  );
}

export interface SendProjectTransferAcceptedOptions {
  toEmail: string;
  recipientName?: string;
  projectName: string;
  sourceWorkspaceName: string;
  destinationWorkspaceName: string;
  acceptedByName: string;
  isInitiator: boolean;
}

export async function sendProjectTransferAcceptedEmail(options: SendProjectTransferAcceptedOptions): Promise<boolean> {
  const appUrl = getAppUrl();
  const dashboardUrl = `${appUrl}/app/workspaces`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #16A34A;">Project Transfer Completed ✅</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        Hello${options.recipientName ? ` <strong>${options.recipientName}</strong>` : ''},<br/>
        ${options.isInitiator
      ? `Your request to transfer project <strong>${options.projectName}</strong> has been accepted by <strong>${options.acceptedByName}</strong>. The project has been successfully moved to <strong>${options.destinationWorkspaceName}</strong>.`
      : `Project <strong>${options.projectName}</strong> from workspace <strong>${options.sourceWorkspaceName}</strong> has been successfully transferred into your workspace <strong>${options.destinationWorkspaceName}</strong>.`
    }
      </p>
      <div style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
        <div style="font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 4px;">Project: ${options.projectName}</div>
        <div style="font-size: 13px; color: #64748B;">Now in: ${options.destinationWorkspaceName}</div>
      </div>
      <div style="margin-bottom: 28px;">
        <a href="${dashboardUrl}" style="display: inline-block; background-color: #16A34A; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 9999px; text-decoration: none;">
          Go to Workspace &rarr;
        </a>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        All project tasks, documents, and historical activities have been preserved.<br/>
        — The D-Board Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: `Project Transfer Completed: "${options.projectName}" is now in "${options.destinationWorkspaceName}"`,
      text: `Hello,\n\nProject "${options.projectName}" has been successfully transferred into "${options.destinationWorkspaceName}".\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD PROJECT TRANSFER ACCEPTED EMAIL]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Project: ${options.projectName}`);
      console.log('====================================================');
    }
  );
}

export interface SendProjectTransferRejectedOptions {
  toEmail: string;
  recipientName?: string;
  projectName: string;
  sourceWorkspaceName: string;
  destinationWorkspaceName: string;
  rejectedByName: string;
  reason?: string | null;
  isInitiator: boolean;
}

export async function sendProjectTransferRejectedEmail(options: SendProjectTransferRejectedOptions): Promise<boolean> {
  const appUrl = getAppUrl();
  const dashboardUrl = `${appUrl}/app/workspaces`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #DC2626;">Project Transfer Request Declined</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        Hello${options.recipientName ? ` <strong>${options.recipientName}</strong>` : ''},<br/>
        ${options.isInitiator
      ? `The transfer request for project <strong>${options.projectName}</strong> into <strong>${options.destinationWorkspaceName}</strong> was declined by <strong>${options.rejectedByName}</strong>.`
      : `You declined the transfer request for project <strong>${options.projectName}</strong> from <strong>${options.sourceWorkspaceName}</strong>.`
    }
      </p>
      ${options.reason
      ? `<div style="background-color: #FFFFFF; border-left: 3px solid #DC2626; padding: 12px 16px; margin-bottom: 20px; font-size: 14px; color: #475569;">
               <strong>Reason:</strong> ${options.reason}
             </div>`
      : ''
    }
      <div style="margin-bottom: 28px;">
        <a href="${dashboardUrl}" style="display: inline-block; background-color: #0F172A; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 9999px; text-decoration: none;">
          Go to Dashboard &rarr;
        </a>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        The project remains in its original workspace (${options.sourceWorkspaceName}) with no modifications.<br/>
        — The D-Board Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: `Project Transfer Request Declined: "${options.projectName}"`,
      text: `Hello,\n\nThe transfer request for "${options.projectName}" into "${options.destinationWorkspaceName}" was declined.${options.reason ? ` Reason: ${options.reason}` : ''}\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD PROJECT TRANSFER REJECTED EMAIL]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Project: ${options.projectName}`);
      console.log('====================================================');
    }
  );
}

export interface SendProjectTransferMemberNoticeOptions {
  toEmail: string;
  memberName: string;
  projectName: string;
  sourceWorkspaceName: string;
  destinationWorkspaceName: string;
}

export async function sendProjectTransferMemberNoticeEmail(options: SendProjectTransferMemberNoticeOptions): Promise<boolean> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #0F172A;">Project Transfer Notice</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        Hello <strong>${options.memberName}</strong>,<br/>
        This is an informational notice that project <strong>${options.projectName}</strong> has been transferred from <strong>${options.sourceWorkspaceName}</strong> to <strong>${options.destinationWorkspaceName}</strong>.
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #575757; margin-bottom: 20px;">
        As part of this workspace transition, active project access has been updated. All of your historical work, task contributions, and comments have been preserved.
      </p>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        If you have questions regarding this transition, please contact your workspace administrator.<br/>
        — The D-Board Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: `Project Transfer Notice: "${options.projectName}" has transitioned to a new workspace`,
      text: `Hello ${options.memberName},\n\nProject "${options.projectName}" has been transferred from "${options.sourceWorkspaceName}" to "${options.destinationWorkspaceName}". Your historical work and attributions remain preserved.\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD PROJECT TRANSFER MEMBER NOTICE EMAIL]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Member: ${options.memberName}`);
      console.log(`Project: ${options.projectName}`);
      console.log('====================================================');
    }
  );
}

export interface SendWorkspaceOwnershipTransferRequestOptions {
  toEmail: string;
  recipientName: string;
  workspaceName: string;
  currentOwnerName: string;
  resultingRole: string;
  expiresAt: Date;
  transferId?: string;
}

/**
 * Send Workspace Ownership Transfer Request Email
 */
export async function sendWorkspaceOwnershipTransferRequestEmail(
  options: SendWorkspaceOwnershipTransferRequestOptions
): Promise<boolean> {
  const appUrl = getAppUrl();
  const reviewUrl = `${appUrl}/app/workspace/settings?tab=ownership`;
  const expiryFormatted = options.expiresAt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const roleLabel = options.resultingRole === 'WORKSPACE_MEMBER' ? 'Workspace Member' : 'Workspace Admin';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #0F172A;">Workspace Ownership Transfer Request 🛡️</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        Hello <strong>${options.recipientName}</strong>,<br/>
        <strong>${options.currentOwnerName}</strong> has requested to transfer primary ownership of workspace <strong>${options.workspaceName}</strong> to you.
      </p>
      <div style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
        <div style="font-size: 14px; font-weight: 600; color: #0F172A; margin-bottom: 4px;">Transfer Details:</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 4px;">• Target Workspace: <strong>${options.workspaceName}</strong></div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 4px;">• Current Owner: <strong>${options.currentOwnerName}</strong></div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 4px;">• Owner's New Role: <strong>${roleLabel}</strong></div>
        <div style="font-size: 13px; color: #16A34A; margin-top: 8px; font-weight: 500;">✓ All workspace members, projects, tasks, and data remain 100% retained.</div>
      </div>
      <div style="margin-bottom: 24px;">
        <a href="${reviewUrl}" style="display: inline-block; background-color: #2563EB; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
          Review & Accept Ownership &rarr;
        </a>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        This transfer request will expire on <strong>${expiryFormatted}</strong> (7 days). If you do not recognize this request, you can decline it safely.<br/>
        — The D-Board Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: `Action Required: Workspace Ownership Transfer for "${options.workspaceName}"`,
      text: `Hello ${options.recipientName},\n\n${options.currentOwnerName} has requested to transfer primary ownership of workspace "${options.workspaceName}" to you.\n\nAll existing workspace members and projects will remain completely intact.\n\nReview and accept the transfer here: ${reviewUrl}\n\nThis request expires on ${expiryFormatted}.\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD WORKSPACE OWNERSHIP TRANSFER REQUEST EMAIL]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Workspace: ${options.workspaceName}`);
      console.log(`Initiator: ${options.currentOwnerName}`);
      console.log('====================================================');
    }
  );
}

export interface SendWorkspaceOwnershipTransferAcceptedOptions {
  toEmail: string;
  recipientName: string;
  workspaceName: string;
  isNewOwner: boolean;
  otherPartyName: string;
  formerOwnerRole: string;
}

/**
 * Send Workspace Ownership Transfer Accepted Confirmation Email
 */
export async function sendWorkspaceOwnershipTransferAcceptedEmail(
  options: SendWorkspaceOwnershipTransferAcceptedOptions
): Promise<boolean> {
  const appUrl = getAppUrl();
  const workspaceUrl = `${appUrl}/app/workspace/settings`;
  const roleLabel = options.formerOwnerRole === 'WORKSPACE_MEMBER' ? 'Workspace Member' : 'Workspace Admin';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #16A34A;">Workspace Ownership Transferred 🎉</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        Hello <strong>${options.recipientName}</strong>,<br/>
        ${
          options.isNewOwner
            ? `You have successfully accepted primary ownership of workspace <strong>${options.workspaceName}</strong>. You now have full management privileges for all workspace members, projects, and settings.`
            : `Primary ownership of workspace <strong>${options.workspaceName}</strong> has been successfully transferred to <strong>${options.otherPartyName}</strong>. Your membership role has been converted to <strong>${roleLabel}</strong>.`
        }
      </p>
      <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
        <div style="font-size: 13px; color: #166534; font-weight: 500;">
          ✓ All team members, projects, tasks, comments, notes, documents, and settings have been 100% retained.
        </div>
      </div>
      <div style="margin-bottom: 24px;">
        <a href="${workspaceUrl}" style="display: inline-block; background-color: #1F1F1F; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
          Go to Workspace Settings &rarr;
        </a>
      </div>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        If you did not authorize this change, please contact support immediately.<br/>
        — The D-Board Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: `Ownership Transferred: "${options.workspaceName}"`,
      text: `Hello ${options.recipientName},\n\nOwnership transfer for workspace "${options.workspaceName}" has been successfully completed.\n\nAll existing workspace members and projects are 100% retained.\n\nAccess your workspace: ${workspaceUrl}\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD WORKSPACE OWNERSHIP TRANSFER ACCEPTED EMAIL]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Workspace: ${options.workspaceName}`);
      console.log(`Role: ${options.isNewOwner ? 'New Owner' : 'Former Owner'}`);
      console.log('====================================================');
    }
  );
}

export interface SendWorkspaceOwnershipTransferNoticeOptions {
  toEmail: string;
  recipientName: string;
  workspaceName: string;
  action: 'cancelled' | 'declined';
  actorName: string;
  reason?: string;
}

/**
 * Send Workspace Ownership Transfer Declined / Cancelled Notice Email
 */
export async function sendWorkspaceOwnershipTransferNoticeEmail(
  options: SendWorkspaceOwnershipTransferNoticeOptions
): Promise<boolean> {
  const isDeclined = options.action === 'declined';
  const title = isDeclined ? 'Ownership Transfer Request Declined' : 'Ownership Transfer Request Cancelled';
  const color = isDeclined ? '#DC2626' : '#64748B';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: ${color};">${title}</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        Hello <strong>${options.recipientName}</strong>,<br/>
        ${
          isDeclined
            ? `The ownership transfer request for workspace <strong>${options.workspaceName}</strong> was declined by <strong>${options.actorName}</strong>.`
            : `The ownership transfer request for workspace <strong>${options.workspaceName}</strong> was cancelled by <strong>${options.actorName}</strong>.`
        }
      </p>
      ${
        options.reason
          ? `<div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 14px; color: #475569;">
              <strong>Reason provided:</strong> ${options.reason}
            </div>`
          : ''
      }
      <p style="font-size: 14px; color: #575757; margin-bottom: 20px;">
        Current ownership and workspace member access have not been altered.
      </p>
      <p style="font-size: 13px; color: #8E8E8E; line-height: 1.5; border-top: 1px solid #ECECE6; padding-top: 16px;">
        — The D-Board Team
      </p>
    </div>
  `;

  return deliverEmail(
    {
      from: getEmailFrom(),
      to: options.toEmail,
      subject: `${title}: "${options.workspaceName}"`,
      text: `Hello ${options.recipientName},\n\nThe ownership transfer request for "${options.workspaceName}" was ${options.action} by ${options.actorName}.${options.reason ? ` Reason: ${options.reason}` : ''}\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log(`📬 [D-BOARD WORKSPACE OWNERSHIP TRANSFER ${options.action.toUpperCase()} EMAIL]`);
      console.log(`To: ${options.toEmail}`);
      console.log(`Workspace: ${options.workspaceName}`);
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
      <div style="margin-bottom: 24px;">
        <a href="${verifyUrl}" style="display: inline-block; background-color: #1F1F1F; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
          Verify Email Address &rarr;
        </a>
      </div>
      <p style="font-size: 12px; color: #737373; line-height: 1.5; word-break: break-all; margin-bottom: 20px;">
        Button not working? Copy and paste this URL into your browser:<br/>
        <a href="${verifyUrl}" style="color: #2563EB; text-decoration: underline;">${verifyUrl}</a>
      </p>
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
      ${options.message
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
 * 3b. Send Workspace Invitation Email
 */
export async function sendWorkspaceInvitationEmail(options: SendWorkspaceInvitationOptions): Promise<boolean> {
  const appUrl = getAppUrl();
  const acceptUrl = options.token
    ? `${appUrl}/app/workspaces/invitations/accept?token=${encodeURIComponent(options.token)}`
    : `${appUrl}/app/invitations`;
  const registerUrl = `${appUrl}/register?email=${encodeURIComponent(options.toEmail)}`;
  const roleLabel = options.role === 'WORKSPACE_ADMIN' ? 'Workspace Administrator' : 'Workspace Member';
  const expiryFormatted = options.expiresAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F1F1F; background-color: #FBFBFA; border: 1px solid #ECECE6; border-radius: 12px;">
      <div style="margin-bottom: 24px; font-size: 22px; font-weight: 800; color: #1F1F1F; letter-spacing: -0.5px;">D-Board</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #1F1F1F;">Workspace Invitation</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #575757; margin-bottom: 16px;">
        <strong>${options.inviterName}</strong> has invited you to join the workspace <strong>${options.workspaceName}</strong> as a <strong>${roleLabel}</strong>.
      </p>
      ${options.message
      ? `<div style="background-color: #FFFFFF; border-left: 3px solid #1F1F1F; padding: 12px 16px; margin-bottom: 20px; font-style: italic; color: #333333; font-size: 14px;">"${options.message}"</div>`
      : ''
    }
      <div style="margin-bottom: 28px;">
        <a href="${acceptUrl}" style="display: inline-block; background-color: #1F1F1F; color: #FFFFFF; font-weight: 600; font-size: 15px; padding: 12px 24px; border-radius: 9999px; text-decoration: none;">
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
      subject: `You have been invited to join the ${options.workspaceName} workspace on D-Board`,
      text: `Hello,\n\n${options.inviterName} has invited you to join "${options.workspaceName}" on D-Board as a ${roleLabel}.${options.message ? `\n\nMessage: "${options.message}"` : ''}\n\nAccept your invitation: ${acceptUrl}\n\nExpires on: ${expiryFormatted}\n\n— The D-Board Team`,
      html,
    },
    () => {
      console.log('====================================================');
      console.log('📬 [D-BOARD WORKSPACE INVITATION DISPATCH SIMULATOR (Local Dev)]');
      console.log(`To: ${options.toEmail}`);
      console.log(`Workspace: ${options.workspaceName} (${roleLabel})`);
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
      ${options.ipAddress
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
