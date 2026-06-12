import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const personas = await prisma.persona.findMany({
    orderBy: [{ costTier: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(personas);
}
