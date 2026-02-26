import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status")?.trim();
  const tag = searchParams.get("tag")?.trim();

  const where: {
    searchText?: { contains: string; mode: "insensitive" };
    status?: string;
    tags?: { has: string };
  } = {};
  if (q) where.searchText = { contains: q, mode: "insensitive" };
  if (status) where.status = status;
  if (tag) where.tags = { has: tag };

  const docs = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      tags: true,
      extractedData: true,
      createdAt: true,
    },
  });

  return NextResponse.json(docs);
}
