import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { buildSearchText, type ExtractedDoc } from "@/lib/extract";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const messageId = typeof body.messageId === "string" ? body.messageId.trim() : null;
  const content = typeof body.content === "string" ? body.content.trim() : null;
  const addedToContextId = typeof body.addedToContextId === "string" ? body.addedToContextId.trim() || null : null;

  if (!messageId || !content) {
    return NextResponse.json({ error: "messageId and content are required" }, { status: 400 });
  }

  // Create a visible Symport note document so the user can see & edit what was saved.
  const rawTags: string[] = ["note"];
  if (addedToContextId) {
    rawTags.push(addedToContextId.toLowerCase());
  }
  const extractedData: Record<string, unknown> = {
    type: "general",
    title:
      content.length > 80
        ? `${content.slice(0, 77)}…`
        : content || "Wiskr insight",
    summary: content,
    tags: rawTags,
  };
  const searchText = buildSearchText(extractedData as ExtractedDoc) || null;

  const doc = await prisma.document.create({
    data: {
      imagePath: null,
      noteText: content,
      status: "pending",
      extractedData: extractedData as Prisma.InputJsonValue,
      searchText,
      tags: rawTags,
    },
  });

  return NextResponse.json({ ok: true, documentId: doc.id });
}
