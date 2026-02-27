import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { openRouterChat, type OpenRouterMessage } from "@/lib/openrouter";
import { buildContextPackage } from "@/lib/context-assembly";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    include: { persona: { select: { id: true, name: true, displayName: true } } },
  });
  return NextResponse.json(messages);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const personaId = typeof body.personaId === "string" ? body.personaId : null;

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contexts: { select: { contextId: true } }, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const contextLabels = conversation.contexts.map((c) => c.contextId);
  const contextPackage = await buildContextPackage(contextLabels);
  const systemContent = `You are a helpful assistant with access to the user's personal context. Use it to give relevant, specific answers. Do not invent information not present in the context.\n\n${contextPackage}`;

  const history: OpenRouterMessage[] = conversation.messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));
  const messagesForApi: OpenRouterMessage[] = [
    { role: "system", content: systemContent },
    ...history,
    { role: "user", content },
  ];

  const persona = personaId
    ? await prisma.persona.findUnique({ where: { id: personaId } })
    : await prisma.persona.findFirst({ where: { name: "Prism" } });
  if (!persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 400 });
  }

  let assistantContent: string;
  try {
    const response = await openRouterChat({
      model: persona.modelString,
      messages: messagesForApi,
      max_tokens: 2048,
    });
    assistantContent = response.choices?.[0]?.message?.content?.trim() ?? "No response generated.";
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenRouter request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const [userMsg, assistantMsg] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, role: "user", content },
    }),
    prisma.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: assistantContent,
        personaId: persona.id,
      },
      include: { persona: { select: { id: true, name: true, displayName: true } } },
    }),
  ]);

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    userMessage: userMsg,
    assistantMessage: assistantMsg,
  });
}
