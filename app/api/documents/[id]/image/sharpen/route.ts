import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { getUploadPath } from "@/lib/uploads";
import { sharpenIncrement } from "@/lib/sharpen";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.imagePath) return NextResponse.json({ error: "No image (note document)" }, { status: 400 });

  const fullPath = getUploadPath(doc.imagePath);
  let buffer: Buffer;
  try {
    buffer = await readFile(fullPath);
  } catch {
    return NextResponse.json({ error: "Image file not found" }, { status: 404 });
  }

  const sharpened = await sharpenIncrement(buffer);
  await writeFile(fullPath, sharpened);

  return NextResponse.json({ ok: true });
}
