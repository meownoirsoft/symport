import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { aiChat, NoApiKeyError, type ChatMessage, type UserKeys } from "@/lib/ai-chat";
import { buildContextPackageForConversation } from "@/lib/context-assembly";
import { getModelCapability } from "@/lib/model-capabilities";
import { decrypt } from "@/lib/encrypt";

function autoTitle(content: string): string {
  const words = content.trim().split(/\s+/);
  const snippet = words.slice(0, 7).join(" ");
  const title = words.length > 7 ? snippet + "..." : snippet;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

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
  // Verify conversation belongs to this user
  const conversation = await prisma.conversation.findUnique({ where: { id, userId } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const keyRows = await prisma.userApiKey.findMany({ where: { userId } });
  if (keyRows.length === 0) {
    return NextResponse.json(
      { error: "NO_API_KEY", message: "Add an API key in Settings to start chatting." },
      { status: 402 }
    );
  }
  const userKeys: UserKeys = {};
  for (const row of keyRows) {
    userKeys[row.provider as keyof UserKeys] = decrypt(row.encryptedKey);
  }

  const { id: conversationId } = await params;
  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const personaId = typeof body.personaId === "string" ? body.personaId : null;
  const taxYear =
    typeof body.taxYear === "string" && /^\d{4}$/.test(body.taxYear.trim())
      ? body.taxYear.trim()
      : null;

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId, userId },
    include: {
      contexts: { select: { contextId: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const contextLabels = conversation.contexts.map((c) => c.contextId);

  const persona = personaId
    ? await prisma.persona.findUnique({ where: { id: personaId } })
    : await prisma.persona.findFirst({ where: { name: "Prism" } });
  if (!persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 400 });
  }

  const { contextPackage } = await buildContextPackageForConversation({
    conversationId,
    userId,
    contextLabels,
    modelString: persona.modelString,
    latestUserMessage: content,
    taxYear,
  });

  const systemContent = `You are a helpful assistant with access to the user's personal context. Use it to give relevant, specific answers. Do not invent information not present in the context.\n\n${contextPackage}`;

  const currentSet = new Set(contextLabels.slice().sort());
  const sameContextMessages = conversation.messages.filter((m) => {
    const ids = m.activeContextIds as string[] | null | undefined;
    if (ids == null) return true;
    const msgSet = new Set([...(Array.isArray(ids) ? ids : [])].sort());
    if (currentSet.size !== msgSet.size) return false;
    for (const id of currentSet) if (!msgSet.has(id)) return false;
    return true;
  });
  const history: ChatMessage[] = sameContextMessages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));
  const messagesForApi: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...history,
    { role: "user", content },
  ];

  let assistantContent: string;
  const capability = getModelCapability(persona.modelString);
  try {
    assistantContent = await aiChat({
      model: persona.modelString,
      provider: persona.provider,
      messages: messagesForApi,
      max_tokens: capability.maxOutputTokens,
      userKeys,
    });
  } catch (err) {
    if (err instanceof NoApiKeyError) {
      return NextResponse.json(
        { error: "NO_API_KEY", message: "Add an API key in Settings to start chatting." },
        { status: 402 }
      );
    }
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const activeContextIds = contextLabels.length > 0 ? contextLabels : null;

  const [userMsg, assistantMsg] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        role: "user",
        content,
        activeContextIds: activeContextIds ?? undefined,
      },
    }),
    prisma.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: assistantContent,
        personaId: persona.id,
        activeContextIds: activeContextIds ?? undefined,
      },
      include: { persona: { select: { id: true, name: true, displayName: true } } },
    }),
  ]);

  const isFirstExchange = conversation.messages.length === 0;
  const needsTitle = isFirstExchange && (!conversation.title || conversation.title === "New conversation");

  let generatedTitle: string | null = null;
  if (needsTitle) {
    generatedTitle = autoTitle(content);
    await prisma.conversation.update({
      where: { id: conversationId, userId },
      data: { title: generatedTitle, updatedAt: new Date() },
    });
  } else {
    await prisma.conversation.update({
      where: { id: conversationId, userId },
      data: { updatedAt: new Date() },
    });
  }

  return NextResponse.json({
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    generatedTitle,
  });
}
