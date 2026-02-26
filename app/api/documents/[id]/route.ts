import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteUploadFile } from "@/lib/uploads";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

function normalizeRotation(n: unknown): number | undefined {
  if (typeof n !== "number" || Number.isNaN(n)) return undefined;
  const r = Math.round(n) % 360;
  const normalized = r < 0 ? r + 360 : r;
  if ([0, 90, 180, 270].includes(normalized)) return normalized;
  return Math.round(normalized / 90) * 90 % 360;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const status = typeof body.status === "string" ? body.status.trim() : undefined;
  const rotation = normalizeRotation(body.rotation);
  const extractionNotes =
    body.extractionNotes === null || body.extractionNotes === undefined
      ? undefined
      : typeof body.extractionNotes === "string"
        ? body.extractionNotes.trim() || null
        : undefined;
  const title =
    body.title === null || body.title === undefined
      ? undefined
      : typeof body.title === "string"
        ? body.title.trim()
        : undefined;
  const tags =
    body.tags === null || body.tags === undefined
      ? undefined
      : Array.isArray(body.tags)
        ? body.tags.map((t: unknown) => String(t).trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean)
        : undefined;

  const data: {
    status?: string;
    rotation?: number;
    extractionNotes?: string | null;
    extractedData?: Record<string, unknown>;
    tags?: string[];
  } = {};
  if (status !== undefined) data.status = status;
  if (rotation !== undefined) data.rotation = rotation;
  if (extractionNotes !== undefined) data.extractionNotes = extractionNotes;
  if (tags !== undefined) data.tags = tags;

  if (title !== undefined) {
    const existing = await prisma.document.findUnique({ where: { id }, select: { extractedData: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const current = (existing.extractedData as Record<string, unknown>) ?? {};
    data.extractedData = { ...current, title: title || null };
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Provide status, rotation, extractionNotes, title, and/or tags" }, { status: 400 });
  }

  const doc = await prisma.document.update({
    where: { id },
    data,
  });
  return NextResponse.json(doc);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  deleteUploadFile(doc.imagePath);
  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
