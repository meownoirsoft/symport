import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { messages: true } },
      contexts: { select: { contextId: true } },
      parentConversation: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json(conversations);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() || null : null;
  const contextIds = Array.isArray(body.contextIds)
    ? body.contextIds.map((c: unknown) => String(c)).filter(Boolean)
    : [];
  const parentConversationId = typeof body.parentConversationId === "string" ? body.parentConversationId : null;

  const conversation = await prisma.conversation.create({
    data: {
      title: title ?? "New conversation",
      userId,
      parentConversationId: parentConversationId || undefined,
      contexts: {
        create: contextIds.map((contextId: string) => ({ contextId })),
      },
    },
    include: { contexts: { select: { contextId: true } } },
  });
  return NextResponse.json(conversation);
}
