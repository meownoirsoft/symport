import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { prisma } from "@/lib/db";
import { getUploadPath } from "@/lib/uploads";
import { extractFromImageBuffer, extractFromText, buildSearchText, normalizeTags, type ExtractedDoc } from "@/lib/extract";

/**
 * Re-run AI extraction and update only the document's tags (and searchText for consistency).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
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
    const fullPath = getUploadPath(doc.imagePath);
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: "Image file not found" }, { status: 404 });
    }
    const buffer = readFileSync(fullPath);
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

  const tags = normalizeTags(extractedData.tags);
  const searchText = buildSearchText({ ...extractedData, tags } as ExtractedDoc);

  await prisma.document.update({
    where: { id },
    data: { tags, searchText: searchText || null },
  });

  const updated = await prisma.document.findUnique({ where: { id } });
  return NextResponse.json(updated);
}
