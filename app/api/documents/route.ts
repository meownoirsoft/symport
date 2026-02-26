import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type")?.trim();
  const status = searchParams.get("status")?.trim();

  const where: { searchText?: { contains: string; mode: "insensitive" }; documentType?: string; status?: string } = {};
  if (q) where.searchText = { contains: q, mode: "insensitive" };
  if (type) where.documentType = type;
  if (status) where.status = status;

  const docs = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      documentType: true,
      status: true,
      tags: true,
      extractedData: true,
      createdAt: true,
    },
  });

  return NextResponse.json(docs);
}
