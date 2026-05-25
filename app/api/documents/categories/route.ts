import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCategoryForTag, documentBelongsToOnlyOther, type DocumentCategoryLabel } from "@/lib/document-categories";
import { readCategoryOverrides, getEffectiveCategories } from "@/lib/category-overrides";

/**
 * Return all topic categories with document counts.
 * A doc counts in a non-Other category if it has at least one tag mapping to that category.
 * A doc counts in Other only if it has no tag mapping to any other category (Other is the default for uncategorized).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const overrides = await readCategoryOverrides();
  const categories = await getEffectiveCategories();
  const docs = await prisma.document.findMany({
    where: { userId },
    select: { tags: true },
  });

  const countByCategory = new Map<string, number>();
  const countByTag = new Map<string, number>();

  for (const label of categories) {
    countByCategory.set(label, 0);
  }

  for (const doc of docs) {
    const tags = (doc.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
    const categoriesInDoc = new Set<DocumentCategoryLabel>();
    for (const tag of tags) {
      const cat = getCategoryForTag(tag, overrides);
      if (categories.includes(cat)) categoriesInDoc.add(cat);
      countByTag.set(tag, (countByTag.get(tag) ?? 0) + 1);
    }
    for (const cat of categoriesInDoc) {
      if (cat !== "Other") {
        countByCategory.set(cat, (countByCategory.get(cat) ?? 0) + 1);
      }
    }
    if (documentBelongsToOnlyOther(tags, overrides)) {
      countByCategory.set("Other", (countByCategory.get("Other") ?? 0) + 1);
    }
  }

  const result = categories.map((name) => ({
    name,
    count: countByCategory.get(name) ?? 0,
  })).filter((c) => c.count > 0 || c.name === "Other");

  return NextResponse.json({
    categories: result,
    tagCounts: Object.fromEntries(countByTag),
  });
}
