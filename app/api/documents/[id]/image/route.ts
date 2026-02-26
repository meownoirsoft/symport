import { NextResponse } from "next/server";
import { Readable } from "stream";
import { writeFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { readUploadStream, getUploadPath, ensureUploadDir } from "@/lib/uploads";
import { sharpenAndEncode } from "@/lib/sharpen";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stream = readUploadStream(doc.imagePath);
  if (!stream) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const webStream = Readable.toWeb(stream) as ReadableStream;
  return new Response(webStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-cache",
    },
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
  const fullPath = getUploadPath(doc.imagePath);
  ensureUploadDir();
  await writeFile(fullPath, buffer);

  return NextResponse.json({ ok: true });
}
