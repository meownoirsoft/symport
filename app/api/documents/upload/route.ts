import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/bunny";
import { sharpenAndEncode } from "@/lib/sharpen";
import { randomBytes } from "crypto";

const ACCEPTED_TYPES = ["image/", "application/pdf"];

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const form = await request.formData();
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

  const rawBuffer = Buffer.from(await file.arrayBuffer());

  // PDFs are stored as-is; images are sharpened and saved as JPEG
  let savedFilename: string;

  if (isPdf) {
    savedFilename = `${randomBytes(12).toString("hex")}.pdf`;
    await uploadFile(rawBuffer, savedFilename, "application/pdf");
  } else {
    savedFilename = `${randomBytes(12).toString("hex")}.jpg`;
    const imageBuffer = await sharpenAndEncode(rawBuffer);
    await uploadFile(imageBuffer, savedFilename, "image/jpeg");
  }

  // Create a pending record immediately — extraction happens via /re-extract
  // to avoid hitting serverless function timeouts on large images/PDFs.
  const doc = await prisma.document.create({
    data: {
      imagePath: savedFilename,
      status: "pending",
      extractedData: { type: "general", title: "Processing...", summary: "" } as Prisma.InputJsonValue,
      searchText: null,
      tags: [],
      userId,
    },
  });

  return NextResponse.json({ id: doc.id, extracting: true });
}

// Suppress unused import warning — ACCEPTED_TYPES used for documentation only
void ACCEPTED_TYPES;
