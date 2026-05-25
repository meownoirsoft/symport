import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCategoryForTag, documentBelongsToOnlyOther, type DocumentCategoryLabel } from "@/lib/document-categories";
import { readCategoryOverrides } from "@/lib/category-overrides";
import { getEmbedding, embeddingToVectorLiteral } from "@/lib/embeddings";

const SEMANTIC_LIMIT = 50;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const tag = searchParams.get("tag")?.trim();
  const category = searchParams.get("category")?.trim() as DocumentCategoryLabel | undefined;
  const taxCategory = searchParams.get("tax_category")?.trim() || undefined;
  const hsaFsaParam = searchParams.get("hsa_fsa_eligible")?.trim();
  const hsaFsaFilter = hsaFsaParam === "true" ? true : hsaFsaParam === "false" ? false : null;
  const taxYear = searchParams.get("tax_year")?.trim() || undefined;
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
        WHERE embedding IS NOT NULL AND "userId" = ${userId}
        ORDER BY embedding <=> ${literal}::vector
        LIMIT ${SEMANTIC_LIMIT}
      `;
      let docs = rows;
      if (category) {
        const overrides = await readCategoryOverrides();
        docs = docs.filter((doc) => {
          const tags = (doc.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
          if (category === "Other") return documentBelongsToOnlyOther(tags, overrides);
          return tags.some((t) => getCategoryForTag(t, overrides) === category);
        });
      }
      if (taxCategory) {
        docs = docs.filter((doc) => (doc.extractedData as Record<string, unknown>).tax_category === taxCategory);
      }
      if (hsaFsaFilter !== null) {
        docs = docs.filter((doc) => (doc.extractedData as Record<string, unknown>).hsa_fsa_eligible === hsaFsaFilter);
      }
      if (taxYear) {
        docs = docs.filter((doc) => {
          const d = (doc.extractedData as Record<string, unknown>).date;
          return typeof d === "string" && d.startsWith(taxYear);
        });
      }
      return NextResponse.json(docs);
    }
    // Fall through to keyword search if embedding failed (e.g. no API key)
  }

  const where: {
    userId: string;
    searchText?: { contains: string; mode: "insensitive" };
    tags?: { has: string };
  } = { userId };
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
    const overrides = await readCategoryOverrides();
    docs = docs.filter((doc) => {
      const tags = (doc.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
      if (category === "Other") return documentBelongsToOnlyOther(tags, overrides);
      return tags.some((t) => getCategoryForTag(t, overrides) === category);
    });
  }

  if (taxCategory) {
    docs = docs.filter((doc) => (doc.extractedData as Record<string, unknown>).tax_category === taxCategory);
  }

  if (hsaFsaFilter !== null) {
    docs = docs.filter((doc) => (doc.extractedData as Record<string, unknown>).hsa_fsa_eligible === hsaFsaFilter);
  }

  if (taxYear) {
    docs = docs.filter((doc) => {
      const d = (doc.extractedData as Record<string, unknown>).date;
      return typeof d === "string" && d.startsWith(taxYear);
    });
  }

  return NextResponse.json(docs);
}
