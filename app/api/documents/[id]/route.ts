import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deleteUploadFile } from "@/lib/uploads";
import { buildSearchText, type ExtractedDoc } from "@/lib/extract";
import { updateDocumentEmbedding } from "@/lib/embeddings";
import { toSchemaOrgJsonLd } from "@/lib/document-schemas";
import type { DocumentKind } from "@/lib/document-schemas";

const TAX_CATEGORY_VALUES = new Set([
  "medical", "charity", "tax_payment", "mortgage_interest",
  "business_expense", "personal", "unknown",
]);

const DOCUMENT_STATUS_VALUES = new Set([
  "pending", "paid", "unpaid", "submitted", "reimbursed", "not_eligible",
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format")?.toLowerCase();

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (format === "schema.org") {
    const data = (doc.extractedData ?? {}) as Record<string, unknown>;
    const kind = (data.doc_category as DocumentKind) ?? "general";
    const jsonLd = toSchemaOrgJsonLd(data, kind);
    return new NextResponse(JSON.stringify(jsonLd, null, 2), {
      headers: {
        "Content-Type": "application/ld+json",
      },
    });
  }

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
        ? body.tags.map((t: unknown) => String(t).trim().replace(/\s+/g, "_")).filter(Boolean)
        : undefined;

  const taxCategory =
    body.tax_category === null
      ? null
      : typeof body.tax_category === "string" && TAX_CATEGORY_VALUES.has(body.tax_category)
        ? body.tax_category
        : undefined;

  const hsaFsaEligible =
    body.hsa_fsa_eligible === null
      ? null
      : typeof body.hsa_fsa_eligible === "boolean"
        ? body.hsa_fsa_eligible
        : undefined;

  const docStatus =
    typeof body.status === "string" && DOCUMENT_STATUS_VALUES.has(body.status)
      ? body.status
      : undefined;

  const taxStatus =
    body.tax_status === null
      ? null
      : typeof body.tax_status === "string" && ["pending", "claimed", "excluded"].includes(body.tax_status)
        ? body.tax_status
        : undefined;

  const data: {
    rotation?: number;
    extractionNotes?: string | null;
    extractedData?: Record<string, unknown>;
    searchText?: string | null;
    tags?: string[];
    status?: string;
  } = {};
  if (rotation !== undefined) data.rotation = rotation;
  if (extractionNotes !== undefined) data.extractionNotes = extractionNotes;
  if (tags !== undefined) data.tags = tags;
  if (docStatus !== undefined) data.status = docStatus;

  if (title !== undefined || tags !== undefined || taxCategory !== undefined || hsaFsaEligible !== undefined || taxStatus !== undefined) {
    const existing = await prisma.document.findUnique({ where: { id }, select: { extractedData: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const current = (existing.extractedData as Record<string, unknown>) ?? {};
    const merged = { ...current };
    if (title !== undefined) merged.title = title || null;
    if (tags !== undefined) merged.tags = tags;
    if (taxCategory !== undefined) merged.tax_category = taxCategory;
    if (hsaFsaEligible !== undefined) merged.hsa_fsa_eligible = hsaFsaEligible;
    if (taxStatus !== undefined) merged.tax_status = taxStatus;
    data.extractedData = merged;
    data.searchText = buildSearchText(merged as ExtractedDoc) || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Provide rotation, extractionNotes, title, tags, tax_category, and/or hsa_fsa_eligible" }, { status: 400 });
  }

  const doc = await prisma.document.update({
    where: { id },
    data: {
      ...data,
      extractedData: data.extractedData as Prisma.InputJsonValue | undefined,
    },
  });
  if (data.searchText !== undefined) {
    await updateDocumentEmbedding(prisma, id, data.searchText ?? undefined);
  }
  return NextResponse.json(doc);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (doc.imagePath) deleteUploadFile(doc.imagePath);
  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
