import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildContextPackageForConversation } from "@/lib/context-assembly";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id: conversationId } = await params;
  const body = await request.json().catch(() => ({}));

  const content =
    typeof body.content === "string" ? body.content.trim() : "";
  const personaId =
    typeof body.personaId === "string" ? body.personaId : null;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId, userId },
    include: {
      contexts: { select: { contextId: true } },
    },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const contextLabels = conversation.contexts.map((c) => c.contextId);

  const persona = personaId
    ? await prisma.persona.findUnique({ where: { id: personaId } })
    : await prisma.persona.findFirst({ where: { name: "Prism" } });

  if (!persona) {
    return NextResponse.json(
      { error: "Persona not found" },
      { status: 400 }
    );
  }

  const result = await buildContextPackageForConversation({
    conversationId,
    userId,
    contextLabels,
    modelString: persona.modelString,
    latestUserMessage: content,
  });

  return NextResponse.json(result);
}
