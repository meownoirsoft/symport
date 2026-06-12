import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "noreply@symport.app";

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Reset your Symport password",
    html: `
      <p>Hi,</p>
      <p>Someone requested a password reset for your Symport account. Click the link below to set a new password. <strong>This link expires in 1 hour.</strong></p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
    `,
    text: [
      "Reset your Symport password",
      "",
      "Someone requested a password reset for your account.",
      "Click the link below to set a new password (expires in 1 hour):",
      "",
      resetUrl,
      "",
      "If you didn't request this, ignore this email.",
    ].join("\n"),
  });
}
