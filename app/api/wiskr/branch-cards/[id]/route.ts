import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = typeof body.status === "string" ? body.status : undefined;
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : undefined;

  const data: { status?: string; conversationId?: string | null } = {};
  if (status !== undefined) data.status = status;
  if (conversationId !== undefined) data.conversationId = conversationId || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Provide status and/or conversationId" }, { status: 400 });
  }

  const card = await prisma.branchCard.findUnique({ where: { id } });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If opening as side conversation, create a new conversation and link it
  if (conversationId === null || (conversationId === "" && data.conversationId === null)) {
    // explicit unset
  } else if (conversationId) {
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 400 });
  }

  const updated = await prisma.branchCard.update({
    where: { id },
    data,
    include: {
      sourceMessage: { select: { id: true, content: true, role: true } },
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.branchCard.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
