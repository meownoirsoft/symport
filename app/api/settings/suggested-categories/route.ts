import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCategoryForTag, documentBelongsToOnlyOther } from "@/lib/document-categories";
import { readCategoryOverrides } from "@/lib/category-overrides";

export type TagSuggestion = {
  tag: string;
  count: number;
  coTags: { tag: string; count: number }[];
};

/**
 * Return tags currently in "Other" (count >= 2), sorted by doc count desc.
 * Each suggestion includes the top co-occurring tags to help users decide on a category name.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const overrides = await readCategoryOverrides();

  const docs = await prisma.document.findMany({
    where: { userId },
    select: { tags: true },
  });

  const tagDocCount = new Map<string, number>();
  const cooccurrence = new Map<string, Map<string, number>>();

  for (const doc of docs) {
    const tags = (doc.tags ?? [])
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean);
    const otherTags = tags.filter((t) => {
      const cat = getCategoryForTag(t, overrides);
      return cat === "Other";
    });

    for (const tag of otherTags) {
      tagDocCount.set(tag, (tagDocCount.get(tag) ?? 0) + 1);
      if (!cooccurrence.has(tag)) cooccurrence.set(tag, new Map());
      for (const peer of otherTags) {
        if (peer !== tag) {
          const m = cooccurrence.get(tag)!;
          m.set(peer, (m.get(peer) ?? 0) + 1);
        }
      }
    }
  }

  const suggestions: TagSuggestion[] = [];
  for (const [tag, count] of tagDocCount) {
    if (count < 2) continue;
    const coMap = cooccurrence.get(tag) ?? new Map<string, number>();
    const coTags = [...coMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, c]) => ({ tag: t, count: c }));
    suggestions.push({ tag, count, coTags });
  }

  suggestions.sort((a, b) => b.count - a.count);

  return NextResponse.json({ suggestions });
}
