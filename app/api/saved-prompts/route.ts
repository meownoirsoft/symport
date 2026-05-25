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

  const prompts = await prisma.savedPrompt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { sourceConversation: { select: { id: true, title: true } } },
  });
  return NextResponse.json(prompts);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const sourceConversationId = typeof body.sourceConversationId === "string" ? body.sourceConversationId : null;

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const prompt = await prisma.savedPrompt.create({
    data: {
      content,
      userId,
      sourceConversationId: sourceConversationId || null,
    },
    include: { sourceConversation: { select: { id: true, title: true } } },
  });

  return NextResponse.json(prompt);
}
