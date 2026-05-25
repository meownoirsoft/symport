import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toSchemaOrgJsonLd } from "@/lib/document-schemas";
import type { DocumentKind } from "@/lib/document-schemas";

const TAX_CATEGORY_VALUES = new Set([
  "medical",
  "charity",
  "tax_payment",
  "mortgage_interest",
  "business_expense",
  "personal",
  "unknown",
]);

type DocRow = {
  id: string;
  tags: string[];
  extractedData: Record<string, unknown>;
  createdAt: Date;
};

function flattenForCsv(doc: DocRow): Record<string, string> {
  const d = doc.extractedData;
  const get = (key: string) => (d[key] != null && d[key] !== "" ? String(d[key]) : "");
  const title = get("title") || get("summary") || get("provider") || get("pharmacy") || get("insurer") || get("type") || "Document";
  const date =
    get("date") ||
    get("date_issued") ||
    get("service_date") ||
    (doc.createdAt ? new Date(doc.createdAt).toISOString().slice(0, 10) : "");
  // amount = out-of-pocket / purchase amount (what to claim for HSA/FSA or deduct).
  const amount =
    get("amount") ||
    get("amount_paid") ||
    get("copay_amount") ||
    get("patient_responsibility") ||
    "";
  // amount_due = what is owed on a bill/EOB.
  const amountDue =
    get("amount_due") ||
    get("patient_responsibility") ||
    get("billed_amount") ||
    "";
  return {
    id: doc.id,
    title,
    tags: Array.isArray(doc.tags) ? doc.tags.join("; ") : "",
    created_at: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    date,
    vendor: get("vendor"),
    provider: get("provider") || get("issuer"),
    pharmacy: get("pharmacy"),
    insurer: get("insurer"),
    amount,
    amount_due: amountDue,
    due_date: get("due_date"),
    tax_category: get("tax_category"),
    hsa_fsa_eligible: get("hsa_fsa_eligible"),
    summary: (get("summary") || "").slice(0, 200),
  };
}

function toCsv(docs: DocRow[]): string {
  if (docs.length === 0) return "";
  const rows = docs.map(flattenForCsv);
  const headers = Object.keys(rows[0]!);
  const escape = (v: string) => {
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(","))].join("\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format")?.toLowerCase();
  const q = searchParams.get("q")?.trim();
  const tag = searchParams.get("tag")?.trim();
  const category = searchParams.get("category")?.trim();
  const taxCategoryParam = searchParams.get("tax_category")?.trim();
  const hsaFsaParam = searchParams.get("hsa_fsa_eligible")?.trim();

  const taxCategory = taxCategoryParam && TAX_CATEGORY_VALUES.has(taxCategoryParam) ? taxCategoryParam : null;
  const hsaFsaFilter =
    hsaFsaParam === "true" ? true : hsaFsaParam === "false" ? false : null;
  const taxYear = searchParams.get("tax_year")?.trim() || null;

  if (format !== "csv" && format !== "json" && format !== "schema.org") {
    return NextResponse.json({ error: "format must be csv, json, or schema.org" }, { status: 400 });
  }

  const where: {
    searchText?: { contains: string; mode: "insensitive" };
    tags?: { has: string };
  } = {};
  if (q) where.searchText = { contains: q, mode: "insensitive" };
  if (tag) where.tags = { has: tag };

  let docs = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tags: true,
      extractedData: true,
      createdAt: true,
    },
  });

  if (category) {
    const { getCategoryForTag, documentBelongsToOnlyOther } = await import("@/lib/document-categories");
    const { readCategoryOverrides } = await import("@/lib/category-overrides");
    const overrides = await readCategoryOverrides();
    docs = docs.filter((doc) => {
      const tags = (doc.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
      if (category === "Other") return documentBelongsToOnlyOther(tags, overrides);
      return tags.some((t) => getCategoryForTag(t, overrides) === category);
    });
  }

  if (taxCategory) {
    docs = docs.filter((doc) => {
      const data = doc.extractedData as Record<string, unknown>;
      return data.tax_category === taxCategory;
    });
  }

  if (hsaFsaFilter !== null) {
    docs = docs.filter((doc) => {
      const data = doc.extractedData as Record<string, unknown>;
      return data.hsa_fsa_eligible === hsaFsaFilter;
    });
  }

  if (taxYear) {
    docs = docs.filter((doc) => {
      const data = doc.extractedData as Record<string, unknown>;
      const d = data.date;
      return typeof d === "string" && d.startsWith(taxYear);
    });
  }

  const payload = docs.map((doc) => ({
    id: doc.id,
    tags: doc.tags ?? [],
    extractedData: doc.extractedData as Record<string, unknown>,
    createdAt: doc.createdAt.toISOString(),
  }));

  if (format === "json") {
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="symport-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  }

  if (format === "schema.org") {
    const jsonLdArray = payload.map((doc) => {
      const data = doc.extractedData ?? {};
      const kind = (data.doc_category as DocumentKind) ?? "general";
      return toSchemaOrgJsonLd(data as Record<string, unknown>, kind);
    });
    return new NextResponse(JSON.stringify(jsonLdArray, null, 2), {
      headers: {
        "Content-Type": "application/ld+json",
        "Content-Disposition": `attachment; filename="symport-export-schema-org-${new Date().toISOString().slice(0, 10)}.jsonld"`,
      },
    });
  }

  const csv = toCsv(docs as DocRow[]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="symport-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
