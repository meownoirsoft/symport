import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { downloadFile } from "@/lib/bunny";
import { extractFromImageBuffer, extractFromText, buildSearchText, normalizeTags, type ExtractedDoc } from "@/lib/extract";
import { updateDocumentEmbedding } from "@/lib/embeddings";
import type { Prisma } from "@prisma/client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id, userId } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  const userFeedback = doc.extractionNotes?.trim() || undefined;
  let extractedData: Record<string, unknown>;

  if (doc.noteText) {
    try {
      const extracted = await extractFromText(doc.noteText, { userFeedback });
      extractedData = extracted as Record<string, unknown>;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Extraction failed" },
        { status: 500 }
      );
    }
  } else if (doc.imagePath) {
    let buffer: Buffer;
    try {
      buffer = await downloadFile(doc.imagePath);
    } catch {
      return NextResponse.json({ error: "Image file not found" }, { status: 404 });
    }
    try {
      const extracted = await extractFromImageBuffer(buffer, { userFeedback });
      extractedData = extracted as Record<string, unknown>;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Extraction failed" },
        { status: 500 }
      );
    }
  } else {
    return NextResponse.json({ error: "Document has no image or note text" }, { status: 400 });
  }

  const searchText = buildSearchText(extractedData as ExtractedDoc);
  const tags = normalizeTags(extractedData.tags);

  await prisma.document.update({
    where: { id, userId },
    data: {
      extractedData: extractedData as Prisma.InputJsonValue,
      searchText: searchText || null,
      tags,
    },
  });
  await updateDocumentEmbedding(prisma, id, searchText || undefined);

  const updated = await prisma.document.findUnique({ where: { id, userId } });
  return NextResponse.json(updated);
}
