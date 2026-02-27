import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  const status = searchParams.get("status"); // optional filter

  const where: { sourceConversationId?: string; status?: string } = {};
  if (conversationId) where.sourceConversationId = conversationId;
  if (status) where.status = status;

  const cards = await prisma.branchCard.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      sourceMessage: { select: { id: true, content: true, role: true, createdAt: true } },
    },
  });
  return NextResponse.json(cards);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sourceConversationId = typeof body.conversationId === "string" ? body.conversationId : body.sourceConversationId;
  const sourceMessageId = typeof body.messageId === "string" ? body.messageId : body.sourceMessageId ?? null;
  const triggerText = typeof body.triggerText === "string" ? body.triggerText.trim() : null;

  if (!sourceConversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  const card = await prisma.branchCard.create({
    data: {
      sourceConversationId,
      sourceMessageId: sourceMessageId || null,
      triggerText: triggerText || null,
      status: "pending",
    },
    include: {
      sourceMessage: { select: { id: true, content: true, role: true } },
    },
  });
  return NextResponse.json(card);
}
