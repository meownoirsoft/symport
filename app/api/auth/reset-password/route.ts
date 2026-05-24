import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Valid token and password (min 8 chars) are required" },
      { status: 400 }
    );
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record || record.expiresAt < new Date()) {
    // Delete expired record if found
    if (record) await prisma.passwordResetToken.delete({ where: { token } });
    return NextResponse.json(
      { error: "This reset link is invalid or has expired" },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, 10);

  await prisma.user.update({
    where: { email: record.email },
    data: { passwordHash },
  });

  // Consume the token so it can't be reused
  await prisma.passwordResetToken.delete({ where: { token } });

  return NextResponse.json({ ok: true });
}
