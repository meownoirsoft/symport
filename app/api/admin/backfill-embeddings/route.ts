import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateDocumentEmbedding } from "@/lib/embeddings";

/**
 * Backfill embedding vectors for documents that have searchText (or all if ?all=1).
 * Use after adding pgvector to populate embeddings for existing documents.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "1" || searchParams.get("all") === "true";

  const docs = await prisma.document.findMany({
    select: { id: true, searchText: true },
    ...(all ? {} : { where: { searchText: { not: null } } }),
  });

  for (const doc of docs) {
    const text = doc.searchText?.trim();
    if (!text) continue;
    await updateDocumentEmbedding(prisma, doc.id, text);
  }

  return NextResponse.json({ ok: true, processed: docs.length });
}
