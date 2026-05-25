import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  const action: string = typeof body.action === "string" ? body.action : "";

  if (!ids.length) return NextResponse.json({ error: "ids is required" }, { status: 400 });

  if (action === "setStatus") {
    const VALID = new Set(["pending", "paid", "unpaid", "submitted", "reimbursed", "not_eligible"]);
    const status = typeof body.status === "string" ? body.status : "";
    if (!VALID.has(status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });
    await prisma.document.updateMany({ where: { id: { in: ids }, userId }, data: { status } });
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  if (action === "addTag") {
    const tag = typeof body.tag === "string" ? body.tag.trim().replace(/\s+/g, "_") : "";
    if (!tag) return NextResponse.json({ error: "tag is required" }, { status: 400 });
    const docs = await prisma.document.findMany({ where: { id: { in: ids }, userId }, select: { id: true, tags: true } });
    await Promise.all(
      docs.map((doc) => {
        const next = doc.tags.includes(tag) ? doc.tags : [...doc.tags, tag];
        return prisma.document.update({ where: { id: doc.id, userId }, data: { tags: next } });
      })
    );
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  if (action === "delete") {
    await prisma.document.deleteMany({ where: { id: { in: ids }, userId } });
    return NextResponse.json({ ok: true, deleted: ids.length });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
