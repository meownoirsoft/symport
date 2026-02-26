import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCategoryForTag, type DocumentCategoryLabel } from "@/lib/document-categories";
import { readCategoryOverrides } from "@/lib/category-overrides";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const tag = searchParams.get("tag")?.trim();
  const category = searchParams.get("category")?.trim() as DocumentCategoryLabel | undefined;

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
    docs = docs.filter((doc) =>
      (doc.tags ?? []).some((t) => getCategoryForTag(String(t), overrides) === category)
    );
  }

  return NextResponse.json(docs);
}
