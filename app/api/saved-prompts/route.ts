import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const prompts = await prisma.savedPrompt.findMany({
    orderBy: { createdAt: "desc" },
    include: { sourceConversation: { select: { id: true, title: true } } },
  });
  return NextResponse.json(prompts);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const sourceConversationId = typeof body.sourceConversationId === "string" ? body.sourceConversationId : null;

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const prompt = await prisma.savedPrompt.create({
    data: {
      content,
      sourceConversationId: sourceConversationId || null,
    },
    include: { sourceConversation: { select: { id: true, title: true } } },
  });

  return NextResponse.json(prompt);
}
