import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCategoryForTag, documentBelongsToOnlyOther, type DocumentCategoryLabel } from "@/lib/document-categories";
import { readCategoryOverrides } from "@/lib/category-overrides";
import { getEmbedding, embeddingToVectorLiteral } from "@/lib/embeddings";

const SEMANTIC_LIMIT = 50;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const tag = searchParams.get("tag")?.trim();
  const category = searchParams.get("category")?.trim() as DocumentCategoryLabel | undefined;
  const useSemantic = searchParams.get("semantic") === "1" || searchParams.get("semantic") === "true";

  // Semantic search: vector similarity (Wiskr / pgvector)
  if (useSemantic && q) {
    const vec = await getEmbedding(q);
    if (vec?.length) {
      const literal = embeddingToVectorLiteral(vec);
      type Row = { id: string; tags: string[]; extractedData: unknown; createdAt: Date };
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT id, tags, "extractedData", "createdAt"
        FROM "Document"
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${literal}::vector
        LIMIT ${SEMANTIC_LIMIT}
      `;
      let docs = rows;
      if (category) {
        const overrides = readCategoryOverrides();
        docs = docs.filter((doc) => {
          const tags = (doc.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
          if (category === "Other") return documentBelongsToOnlyOther(tags, overrides);
          return tags.some((t) => getCategoryForTag(t, overrides) === category);
        });
      }
      return NextResponse.json(docs);
    }
    // Fall through to keyword search if embedding failed (e.g. no API key)
  }

  const where: {
    searchText?: { contains: string; mode: "insensitive" };
    tags?: { has: string };
  } = {};
  if (q) where.searchText = { contains: q, mode: "insensitive" };
  if (tag) where.tags = { has: tag };

  let docs = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tags: true,
      extractedData: true,
      createdAt: true,
    },
  });

  if (category) {
    const overrides = readCategoryOverrides();
    docs = docs.filter((doc) => {
      const tags = (doc.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
      if (category === "Other") return documentBelongsToOnlyOther(tags, overrides);
      return tags.some((t) => getCategoryForTag(t, overrides) === category);
    });
  }

  return NextResponse.json(docs);
}
