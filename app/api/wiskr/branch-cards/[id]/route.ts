import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
  const status = typeof body.status === "string" ? body.status : undefined;
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : undefined;

  const data: { status?: string; conversationId?: string | null } = {};
  if (status !== undefined) data.status = status;
  if (conversationId !== undefined) data.conversationId = conversationId || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Provide status and/or conversationId" }, { status: 400 });
  }

  // Verify ownership via source conversation
  const card = await prisma.branchCard.findFirst({
    where: { id, sourceConversation: { userId } },
  });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If linking to a branch conversation, verify that conversation also belongs to this user
  if (conversationId) {
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId, userId } });
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
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id } = await params;
  // Verify ownership before deleting
  const card = await prisma.branchCard.findFirst({
    where: { id, sourceConversation: { userId } },
  });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.branchCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
