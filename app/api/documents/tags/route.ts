import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Return all tags in use with document counts for topic discovery.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const docs = await prisma.document.findMany({
    where: { userId },
    select: { tags: true },
  });

  const countByTag = new Map<string, number>();
  for (const doc of docs) {
    const tags = doc.tags ?? [];
    for (const tag of tags) {
      if (typeof tag === "string" && tag.trim()) {
        const t = tag.trim();
        countByTag.set(t, (countByTag.get(t) ?? 0) + 1);
      }
    }
  }

  const tags = Array.from(countByTag.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ tags });
}
