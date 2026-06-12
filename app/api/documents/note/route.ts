import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractFromText, buildSearchText, normalizeTags, type ExtractedDoc } from "@/lib/extract";
import { updateDocumentEmbedding } from "@/lib/embeddings";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Missing or empty text" }, { status: 400 });

  // Notes are short text — extraction is fast enough to do inline.
  let extractedData: Record<string, unknown>;
  try {
    if (process.env.OPENAI_API_KEY) {
      const extracted = await extractFromText(text);
      extractedData = extracted as Record<string, unknown>;
    } else {
      extractedData = {
        type: "general",
        title: "Note",
        summary: "Extraction skipped (no OPENAI_API_KEY)",
      };
    }
  } catch (err) {
    extractedData = {
      type: "general",
      title: "Note",
      summary: "Extraction failed: " + (err instanceof Error ? err.message : "Unknown error"),
    };
  }

  const searchText = buildSearchText(extractedData as ExtractedDoc);
  const extractedTags = normalizeTags(extractedData.tags);
  const tags = extractedTags.includes("note") ? extractedTags : [...extractedTags, "note"];

  const jsonForDb = JSON.parse(JSON.stringify(extractedData)) as Prisma.InputJsonValue;

  try {
    const doc = await prisma.document.create({
      data: {
        imagePath: null,
        noteText: text,
        status: "pending",
        extractedData: jsonForDb,
        searchText: searchText || null,
        tags,
        userId,
      },
    });
    await updateDocumentEmbedding(prisma, doc.id, searchText || undefined);
    return NextResponse.json({ id: doc.id });
  } catch (err) {
    console.error("Note create failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save note" },
      { status: 500 }
    );
  }
}
