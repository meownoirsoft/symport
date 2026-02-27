import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeExtractedData } from "@/lib/normalize-extraction";
import { buildSearchText, type ExtractedDoc } from "@/lib/extract";
import { updateDocumentEmbedding } from "@/lib/embeddings";

/**
 * Re-normalize extractedData for all documents using the schema registry.
 * Existing data gets standard fields, aliases applied, and doc_category set.
 * Also rebuilds searchText from the normalized data.
 * Call after adding new schema kinds or changing the registry.
 */
export async function POST() {
  const docs = await prisma.document.findMany({
    select: { id: true, extractedData: true },
  });

  let updated = 0;
  for (const doc of docs) {
    const raw = (doc.extractedData as Record<string, unknown>) ?? {};
    const normalized = normalizeExtractedData(raw);
    const searchText = buildSearchText(normalized as ExtractedDoc) || null;

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        extractedData: normalized as Prisma.InputJsonValue,
        searchText,
      },
    });
    await updateDocumentEmbedding(prisma, doc.id, searchText ?? undefined);
    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
