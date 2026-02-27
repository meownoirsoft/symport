import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildSearchText, type ExtractedDoc } from "@/lib/extract";
import { updateDocumentEmbedding } from "@/lib/embeddings";

/**
 * Rebuild searchText for all documents from their extractedData.
 * Ensures every doc has effective title (and the rest) in search.
 * Call once after updating buildSearchText, or anytime to fix stale search.
 */
export async function POST() {
  const docs = await prisma.document.findMany({
    select: { id: true, extractedData: true },
  });

  let updated = 0;
  for (const doc of docs) {
    const data = doc.extractedData as Record<string, unknown> | null;
    const searchText = data ? buildSearchText(data as ExtractedDoc) || null : null;
    await prisma.document.update({
      where: { id: doc.id },
      data: { searchText },
    });
    await updateDocumentEmbedding(prisma, doc.id, searchText ?? undefined);
    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
