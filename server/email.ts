interface PasswordResetEmailInput {
  to: string;
  resetUrl: string;
  expiresAt: Date;
}

interface EmailResult {
  sent: boolean;
  provider: "resend" | "development" | "unconfigured";
  error?: string;
}

function getBaseEmailText(resetUrl: string, expiresAt: Date): string {
  return [
    "You requested a password reset for your Open Way account.",
    "",
    `Reset your password here: ${resetUrl}`,
    "",
    `This link expires at ${expiresAt.toISOString()}.`,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
}

function getBaseEmailHtml(resetUrl: string, expiresAt: Date): string {
  return `
    <p>You requested a password reset for your Open Way account.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>This link expires at ${expiresAt.toISOString()}.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
}

async function sendViaResend(input: PasswordResetEmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESET_EMAIL_FROM;

  if (!apiKey || !from) {
    return { sent: false, provider: "unconfigured", error: "Resend email is not configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: "Reset your Open Way password",
      text: getBaseEmailText(input.resetUrl, input.expiresAt),
      html: getBaseEmailHtml(input.resetUrl, input.expiresAt),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    return { sent: false, provider: "resend", error: detail || response.statusText };
  }

  return { sent: true, provider: "resend" };
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<EmailResult> {
  if (process.env.RESEND_API_KEY && process.env.RESET_EMAIL_FROM) {
    return sendViaResend(input);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("=".repeat(60));
    console.log("PASSWORD RESET REQUESTED");
    console.log(`Email: ${input.to}`);
    console.log(`Reset Link: ${input.resetUrl}`);
    console.log(`Expires: ${input.expiresAt.toISOString()}`);
    console.log("Configure RESEND_API_KEY and RESET_EMAIL_FROM to send real email.");
    console.log("=".repeat(60));
    return { sent: false, provider: "development", error: "Email provider not configured" };
  }

  return { sent: false, provider: "unconfigured", error: "Email provider not configured" };
}
