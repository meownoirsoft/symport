import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { downloadFile, uploadFile } from "@/lib/bunny";
import { sharpenIncrement } from "@/lib/sharpen";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id, userId } });
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
