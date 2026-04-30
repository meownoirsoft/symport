import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function pickAmount(d: Record<string, unknown>): number | null {
  const candidates = ["amount", "amount_paid", "copay_amount", "patient_responsibility"];
  for (const k of candidates) {
    const v = d[k];
    if (v != null) {
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ""));
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

function pickDate(d: Record<string, unknown>): string | null {
  const candidates = ["date", "date_issued", "service_date"];
  for (const k of candidates) {
    const v = d[k];
    if (typeof v === "string" && /^\d{4}-\d{2}/.test(v)) return v.slice(0, 7); // YYYY-MM
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year")?.trim() || null;

  const docs = await prisma.document.findMany({
    select: { id: true, tags: true, extractedData: true, status: true, createdAt: true },
  });

  const filtered = year
    ? docs.filter((doc) => {
        const d = (doc.extractedData as Record<string, unknown>).date;
        return typeof d === "string" ? d.startsWith(year) : doc.createdAt.getFullYear().toString() === year;
      })
    : docs;

  let totalSpend = 0;
  let hsaEligibleTotal = 0;
  let pendingReimbursement = 0;
  const byCategory: Record<string, { total: number; count: number }> = {};
  const byMonth: Record<string, number> = {};

  for (const doc of filtered) {
    const d = doc.extractedData as Record<string, unknown>;
    const amount = pickAmount(d);
    const month = pickDate(d) ?? doc.createdAt.toISOString().slice(0, 7);
    const taxCat = typeof d.tax_category === "string" ? d.tax_category : "unknown";
    const hsaEligible = d.hsa_fsa_eligible === true;

    if (amount != null) {
      totalSpend += amount;
      if (!byCategory[taxCat]) byCategory[taxCat] = { total: 0, count: 0 };
      byCategory[taxCat].total += amount;
      byCategory[taxCat].count += 1;
      byMonth[month] = (byMonth[month] ?? 0) + amount;
      if (hsaEligible) {
        hsaEligibleTotal += amount;
        if (doc.status === "pending") pendingReimbursement += amount;
      }
    }
  }

  const spendByCategory = Object.entries(byCategory)
    .map(([category, { total, count }]) => ({ category, total: Math.round(total * 100) / 100, count }))
    .sort((a, b) => b.total - a.total);

  const spendByMonth = Object.entries(byMonth)
    .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-13); // last 13 months

  const statusCounts: Record<string, number> = {};
  for (const doc of filtered) {
    const s = doc.status ?? "pending";
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  return NextResponse.json({
    totalDocuments: filtered.length,
    totalSpend: Math.round(totalSpend * 100) / 100,
    hsaEligibleTotal: Math.round(hsaEligibleTotal * 100) / 100,
    pendingReimbursement: Math.round(pendingReimbursement * 100) / 100,
    spendByCategory,
    spendByMonth,
    statusCounts,
  });
}
