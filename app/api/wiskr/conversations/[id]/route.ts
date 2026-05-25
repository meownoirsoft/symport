import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { persona: { select: { id: true, name: true, displayName: true } } },
      },
      contexts: { select: { contextId: true } },
    },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(conversation);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() || undefined : undefined;
  const contextIds = Array.isArray(body.contextIds)
    ? body.contextIds.map((c: unknown) => String(c)).filter(Boolean)
    : undefined;

  const data: { title?: string } = {};
  if (title !== undefined) data.title = title;

  const conversation = await prisma.conversation.findUnique({ where: { id, userId } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (contextIds !== undefined) {
    await prisma.conversationContext.deleteMany({ where: { conversationId: id } });
    if (contextIds.length > 0) {
      await prisma.conversationContext.createMany({
        data: contextIds.map((contextId: string) => ({ conversationId: id, contextId })),
      });
    }
  }

  const updated = await prisma.conversation.update({
    where: { id, userId },
    data,
    include: { contexts: { select: { contextId: true } } },
  });
  return NextResponse.json(updated);
}
