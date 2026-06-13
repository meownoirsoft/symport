import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encrypt";

const VALID_PROVIDERS = ["openrouter", "openai", "anthropic"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.userApiKey.findMany({ where: { userId: session.user.id } });
  const connected: Record<string, boolean> = { openrouter: false, openai: false, anthropic: false };
  for (const row of rows) connected[row.provider] = true;
  return NextResponse.json(connected);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const provider = typeof body.provider === "string" ? body.provider.toLowerCase() : "";
  const key = typeof body.key === "string" ? body.key.trim() : "";

  if (!VALID_PROVIDERS.includes(provider as Provider) || !key) {
    return NextResponse.json({ error: "provider and key are required" }, { status: 400 });
  }

  const encryptedKey = encrypt(key);
  await prisma.userApiKey.upsert({
    where: { userId_provider: { userId: session.user.id, provider } },
    create: { userId: session.user.id, provider, encryptedKey },
    update: { encryptedKey },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const provider = typeof body.provider === "string" ? body.provider.toLowerCase() : "";

  if (!VALID_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json({ error: "valid provider required" }, { status: 400 });
  }

  await prisma.userApiKey.deleteMany({ where: { userId: session.user.id, provider } });
  return NextResponse.json({ ok: true });
}
