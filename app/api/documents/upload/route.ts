import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/bunny";
import { extractFromImageBuffer, extractFromPDF, buildSearchText, normalizeTags, type ExtractedDoc } from "@/lib/extract";
import { updateDocumentEmbedding } from "@/lib/embeddings";
import { sharpenAndEncode } from "@/lib/sharpen";
import { randomBytes } from "crypto";

const ACCEPTED_TYPES = ["image/", "application/pdf"];

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: `File must be an image or PDF (received: ${file.type || "unknown"})` },
      { status: 400 }
    );
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());

  // PDFs are stored as-is; images are sharpened and saved as JPEG
  let savedFilename: string;
  let imageBuffer: Buffer | null = null;

  if (isPdf) {
    savedFilename = `${randomBytes(12).toString("hex")}.pdf`;
    await uploadFile(rawBuffer, savedFilename, "application/pdf");
  } else {
    savedFilename = `${randomBytes(12).toString("hex")}.jpg`;
    imageBuffer = await sharpenAndEncode(rawBuffer);
    await uploadFile(imageBuffer, savedFilename, "image/jpeg");
  }

  if (!process.env.OPENAI_API_KEY) {
    const doc = await prisma.document.create({
      data: {
        imagePath: savedFilename,
        status: "pending",
        extractedData: { type: "general", title: "Document", summary: "Extraction skipped (no OPENAI_API_KEY)" },
        searchText: "Extraction skipped",
        tags: [],
      },
    });
    return NextResponse.json({ id: doc.id });
  }

  let extractedData: Record<string, unknown>;
  try {
    const extracted = isPdf
      ? await extractFromPDF(rawBuffer)
      : await extractFromImageBuffer(imageBuffer!);
    extractedData = extracted as Record<string, unknown>;
  } catch (err) {
    extractedData = {
      type: "general",
      summary: "Extraction failed: " + (err instanceof Error ? err.message : "Unknown error"),
    };
  }

  const searchText = buildSearchText(extractedData as ExtractedDoc);
  const tags = normalizeTags(extractedData.tags);

  const doc = await prisma.document.create({
    data: {
      imagePath: savedFilename,
      status: "pending",
      extractedData: extractedData as Prisma.InputJsonValue,
      searchText: searchText || null,
      tags,
    },
  });

  await updateDocumentEmbedding(prisma, doc.id, searchText || undefined);
  return NextResponse.json({ id: doc.id });
}

// Suppress unused import warning — ACCEPTED_TYPES used for documentation only
void ACCEPTED_TYPES;
