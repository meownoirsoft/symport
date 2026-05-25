import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/bunny";
import { sharpenAndEncode } from "@/lib/sharpen";
import { randomBytes } from "crypto";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    return NextResponse.json({ error: "Failed to parse form: " + String(err) }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: `File must be an image or PDF (received: ${file.type || "unknown"})` },
      { status: 400 }
    );
  }

  let rawBuffer: Buffer;
  try {
    rawBuffer = Buffer.from(await file.arrayBuffer());
  } catch (err) {
    return NextResponse.json({ error: "Failed to read file: " + String(err) }, { status: 400 });
  }

  let savedFilename: string;
  try {
    if (isPdf) {
      savedFilename = `${randomBytes(12).toString("hex")}.pdf`;
      await uploadFile(rawBuffer, savedFilename, "application/pdf");
    } else {
      savedFilename = `${randomBytes(12).toString("hex")}.jpg`;
      const imageBuffer = await sharpenAndEncode(rawBuffer);
      await uploadFile(imageBuffer, savedFilename, "image/jpeg");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Upload/sharpen failed:", msg);
    return NextResponse.json({ error: "File processing failed: " + msg }, { status: 500 });
  }

  let doc: { id: string };
  try {
    doc = await prisma.document.create({
      data: {
        imagePath: savedFilename,
        status: "pending",
        extractedData: { type: "general", title: "Processing...", summary: "" } as Prisma.InputJsonValue,
        searchText: null,
        tags: [],
        userId,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("DB create failed:", msg);
    return NextResponse.json({ error: "Database error: " + msg }, { status: 500 });
  }

  return NextResponse.json({ id: doc.id, extracting: true });
}
