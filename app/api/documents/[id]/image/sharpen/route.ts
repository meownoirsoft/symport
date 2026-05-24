import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { downloadFile, uploadFile } from "@/lib/bunny";
import { sharpenIncrement } from "@/lib/sharpen";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.imagePath) return NextResponse.json({ error: "No image (note document)" }, { status: 400 });

  let buffer: Buffer;
  try {
    buffer = await downloadFile(doc.imagePath);
  } catch {
    return NextResponse.json({ error: "Image file not found" }, { status: 404 });
  }

  const sharpened = await sharpenIncrement(buffer);
  await uploadFile(sharpened, doc.imagePath, "image/jpeg");

  return NextResponse.json({ ok: true });
}
