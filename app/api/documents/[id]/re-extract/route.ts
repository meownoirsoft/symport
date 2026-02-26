import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { getUploadPath } from "@/lib/uploads";
import { extractFromImageBuffer, buildSearchText, normalizeTags, type ExtractedDoc } from "@/lib/extract";
import type { Prisma } from "@prisma/client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fullPath = getUploadPath(doc.imagePath);
  if (!existsSync(fullPath)) {
    return NextResponse.json({ error: "Image file not found" }, { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  const buffer = readFileSync(fullPath);
  const userFeedback = doc.extractionNotes?.trim() || undefined;

  let extractedData: Record<string, unknown>;
  try {
    const extracted = await extractFromImageBuffer(buffer, { userFeedback });
    extractedData = extracted as Record<string, unknown>;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }

  const documentType = (extractedData.type as string) ?? "general";
  const searchText = buildSearchText(extractedData as ExtractedDoc);
  const tags = normalizeTags(extractedData.tags);

  await prisma.document.update({
    where: { id },
    data: {
      documentType,
      extractedData: extractedData as Prisma.InputJsonValue,
      searchText: searchText || null,
      tags,
    },
  });

  const updated = await prisma.document.findUnique({ where: { id } });
  return NextResponse.json(updated);
}
