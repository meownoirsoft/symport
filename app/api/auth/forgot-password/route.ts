import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { randomBytes } from "crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Always return success — prevents email enumeration
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    // Replace any existing token for this email
    await prisma.passwordResetToken.deleteMany({ where: { email } });
    await prisma.passwordResetToken.create({ data: { email, token, expiresAt } });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
    try {
      await sendPasswordResetEmail(email, resetUrl);
    } catch (err) {
      console.error("Password reset email failed:", err);
      // Don't expose mail errors to the caller
    }
  }

  return NextResponse.json({ ok: true });
}
