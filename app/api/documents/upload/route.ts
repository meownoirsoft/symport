import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUploadPath, ensureUploadDir } from "@/lib/uploads";
import { extractFromImageBuffer, buildSearchText, normalizeTags, type ExtractedDoc } from "@/lib/extract";
import { updateDocumentEmbedding } from "@/lib/embeddings";
import { sharpenAndEncode } from "@/lib/sharpen";
import { randomBytes } from "crypto";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  const filename = `${randomBytes(12).toString("hex")}.jpg`;
  ensureUploadDir();
  const fullPath = getUploadPath(filename);

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const buffer = await sharpenAndEncode(rawBuffer);
  const fs = await import("fs");
  const { writeFile } = fs.promises;
  await writeFile(fullPath, buffer);

  if (!process.env.OPENAI_API_KEY) {
    await prisma.document.create({
      data: {
        imagePath: filename,
        status: "pending",
        extractedData: { type: "general", title: "Document", summary: "Extraction skipped (no OPENAI_API_KEY)" },
        searchText: "Extraction skipped",
        tags: [],
      },
    });
    const doc = await prisma.document.findFirst({
      where: { imagePath: filename },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ id: doc?.id ?? "" });
  }

  let extractedData: Record<string, unknown>;
  try {
    const extracted = await extractFromImageBuffer(buffer);
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
      imagePath: filename,
      status: "pending",
      extractedData: extractedData as Prisma.InputJsonValue,
      searchText: searchText || null,
      tags,
    },
  });

  await updateDocumentEmbedding(prisma, doc.id, searchText || undefined);
  return NextResponse.json({ id: doc.id });
}
