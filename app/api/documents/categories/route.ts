import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCategoryForTag, type DocumentCategoryLabel } from "@/lib/document-categories";
import { readCategoryOverrides, getEffectiveCategories } from "@/lib/category-overrides";

/**
 * Return all topic categories with document counts. A doc counts in a category
 * if it has at least one tag that maps to that category.
 */
export async function GET() {
  const overrides = readCategoryOverrides();
  const categories = getEffectiveCategories();
  const docs = await prisma.document.findMany({
    select: { tags: true },
  });

  const countByCategory = new Map<string, number>();
  for (const label of categories) {
    countByCategory.set(label, 0);
  }

  for (const doc of docs) {
    const tags = doc.tags ?? [];
    const categoriesInDoc = new Set<DocumentCategoryLabel>();
    for (const tag of tags) {
      if (typeof tag === "string" && tag.trim()) {
        const cat = getCategoryForTag(tag, overrides);
        if (categories.includes(cat)) categoriesInDoc.add(cat);
      }
    }
    for (const cat of categoriesInDoc) {
      countByCategory.set(cat, (countByCategory.get(cat) ?? 0) + 1);
    }
  }

  const result = categories.map((name) => ({
    name,
    count: countByCategory.get(name) ?? 0,
  })).filter((c) => c.count > 0 || c.name === "Other");

  return NextResponse.json({ categories: result });
}
