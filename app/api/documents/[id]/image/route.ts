import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadFile, getFileUrl } from "@/lib/bunny";
import { sharpenAndEncode } from "@/lib/sharpen";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.imagePath) return NextResponse.json({ error: "No image (note document)" }, { status: 404 });

  // Redirect to CDN — auth is enforced by middleware before we get here
  return NextResponse.redirect(getFileUrl(doc.imagePath), { status: 307 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.imagePath) return NextResponse.json({ error: "Cannot replace image on a note document" }, { status: 400 });

  const form = await request.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const buffer = await sharpenAndEncode(rawBuffer);
  await uploadFile(buffer, doc.imagePath, "image/jpeg");

  return NextResponse.json({ ok: true });
}
