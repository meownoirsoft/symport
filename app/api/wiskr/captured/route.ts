import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { extractFromText, buildSearchText, normalizeTags, type ExtractedDoc } from "@/lib/extract";
import { updateDocumentEmbedding } from "@/lib/embeddings";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const messageId = typeof body.messageId === "string" ? body.messageId.trim() : null;
  const content = typeof body.content === "string" ? body.content.trim() : null;
  const addedToContextId = typeof body.addedToContextId === "string" ? body.addedToContextId.trim() || null : null;

  if (!messageId || !content) {
    return NextResponse.json({ error: "messageId and content are required" }, { status: 400 });
  }

  // Record capture in CapturedResponse
  await prisma.capturedResponse.create({
    data: { messageId, content, addedToContextId },
  });

  // Run full extraction so the saved answer enters the semantic index
  let extractedData: Record<string, unknown>;
  if (process.env.OPENAI_API_KEY) {
    try {
      extractedData = (await extractFromText(content)) as Record<string, unknown>;
    } catch {
      extractedData = {
        type: "general",
        title: content.length > 80 ? `${content.slice(0, 77)}…` : content,
        summary: content,
      };
    }
  } else {
    extractedData = {
      type: "general",
      title: content.length > 80 ? `${content.slice(0, 77)}…` : content,
      summary: content,
    };
  }

  const baseTags = normalizeTags(extractedData.tags);
  const contextTag = addedToContextId ? addedToContextId.toLowerCase().replace(/\s+/g, "_") : null;
  const tags = [
    ...new Set([
      "note",
      ...(contextTag ? [contextTag] : []),
      ...baseTags,
    ]),
  ];
  extractedData.tags = tags;

  const searchText = buildSearchText(extractedData as ExtractedDoc) || content.slice(0, 500);
  const jsonForDb = JSON.parse(JSON.stringify(extractedData)) as Prisma.InputJsonValue;

  const doc = await prisma.document.create({
    data: {
      imagePath: null,
      noteText: content,
      status: "pending",
      extractedData: jsonForDb,
      searchText,
      tags,
    },
  });

  await updateDocumentEmbedding(prisma, doc.id, searchText);

  return NextResponse.json({ ok: true, documentId: doc.id });
}
