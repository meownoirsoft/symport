import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type DocRow = {
  id: string;
  documentType: string;
  status: string;
  tags: string[];
  extractedData: Record<string, unknown>;
  createdAt: Date;
};

function flattenForCsv(doc: DocRow): Record<string, string> {
  const d = doc.extractedData;
  const get = (key: string) => (d[key] != null && d[key] !== "" ? String(d[key]) : "");
  const title = get("title") || get("summary") || get("provider") || get("pharmacy") || get("insurer") || doc.documentType;
  const date =
    get("date") ||
    get("date_issued") ||
    get("service_date") ||
    (doc.createdAt ? new Date(doc.createdAt).toISOString().slice(0, 10) : "");
  const amount =
    get("amount_due") ||
    get("patient_responsibility") ||
    get("copay_amount") ||
    get("billed_amount") ||
    "";
  return {
    id: doc.id,
    title,
    document_type: doc.documentType,
    status: doc.status,
    created_at: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    date,
    provider: get("provider") || get("issuer"),
    pharmacy: get("pharmacy"),
    insurer: get("insurer"),
    amount_due: amount,
    due_date: get("due_date"),
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
  const type = searchParams.get("type")?.trim();
  const status = searchParams.get("status")?.trim();

  if (format !== "csv" && format !== "json") {
    return NextResponse.json({ error: "format must be csv or json" }, { status: 400 });
  }

  const where: {
    searchText?: { contains: string; mode: "insensitive" };
    documentType?: string;
    status?: string;
  } = {};
  if (q) where.searchText = { contains: q, mode: "insensitive" };
  if (type) where.documentType = type;
  if (status) where.status = status;

  const docs = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      documentType: true,
      status: true,
      tags: true,
      extractedData: true,
      createdAt: true,
    },
  });

  const payload = docs.map((doc) => ({
    id: doc.id,
    documentType: doc.documentType,
    status: doc.status,
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

  const csv = toCsv(docs as DocRow[]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="symport-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
