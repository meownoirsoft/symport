"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Doc = {
  id: string;
  extractedData: Record<string, unknown>;
  createdAt: string;
};

type DocWithDerived = Doc & {
  displayTitle: string;
  date: string;
  year: string;
  taxCategory: string;
  taxStatus: TaxStatusKey;
  amount: number | null;
};

type TaxStatusKey = "pending" | "claimed" | "excluded";

const TAX_STATUS_CONFIG: Record<TaxStatusKey, {
  label: string;
  badgeColor: string;
  activeBtn: string;
  idleBtn: string;
  icon: React.ReactNode;
}> = {
  pending: {
    label: "Not reviewed",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    activeBtn: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700",
    idleBtn:   "bg-white text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-zinc-900 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/20",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  claimed: {
    label: "Claimed",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    activeBtn: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700",
    idleBtn:   "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/20",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  excluded: {
    label: "Excluded",
    badgeColor: "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400",
    activeBtn: "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-500",
    idleBtn:   "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-800",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
};

const TAX_STATUS_KEYS: TaxStatusKey[] = ["pending", "claimed", "excluded"];

const CATEGORY_LABELS: Record<string, string> = {
  medical:           "Medical (Schedule A)",
  charity:           "Charity (Schedule A)",
  tax_payment:       "Tax payments (Schedule A / SALT)",
  mortgage_interest: "Mortgage interest (Schedule A)",
  business_expense:  "Business expenses (Schedule C)",
  personal:          "Personal (non-deductible)",
  unknown:           "Unknown",
};

const CATEGORY_ORDER = [
  "medical", "charity", "tax_payment", "mortgage_interest",
  "business_expense", "personal", "unknown",
];

function derive(doc: Doc): DocWithDerived {
  const d = doc.extractedData;
  const displayTitle =
    (typeof d.title === "string" && d.title.trim()) ||
    (typeof d.summary === "string" && d.summary) ||
    (typeof d.provider === "string" && d.provider) ||
    (typeof d.vendor === "string" && d.vendor) ||
    (typeof d.pharmacy === "string" && d.pharmacy) ||
    "Document";

  const date =
    (typeof d.date === "string" && d.date) ||
    (typeof d.service_date === "string" && d.service_date) ||
    doc.createdAt.slice(0, 10);

  const year = date.slice(0, 4);
  const taxCategory = typeof d.tax_category === "string" ? d.tax_category : "unknown";

  const rawTaxStatus = d.tax_status;
  const taxStatus: TaxStatusKey =
    rawTaxStatus === "claimed" || rawTaxStatus === "excluded" ? rawTaxStatus : "pending";

  const rawAmount =
    d.amount ?? d.copay_amount ?? d.patient_responsibility ?? d.amount_paid;
  const amount =
    rawAmount != null && !Number.isNaN(parseFloat(String(rawAmount)))
      ? parseFloat(String(rawAmount))
      : null;

  return { ...doc, displayTitle, date, year, taxCategory, taxStatus, amount };
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function TaxTrackerPage() {
  const [docs, setDocs] = useState<DocWithDerived[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [selectedYear, setSelectedYear] = useState<string>("");

  const load = useCallback(() => {
    setLoading(true);
    // Fetch all docs that have a tax_category set (excluding personal and unknown optionally)
    fetch("/api/documents")
      .then((r) => r.json())
      .then((raw: Doc[]) => {
        const derived = raw
          .map(derive)
          .filter((d) => d.taxCategory && d.taxCategory !== "unknown" && d.taxCategory !== "personal");
        setDocs(derived);
        // Default to most recent year
        if (derived.length > 0) {
          const years = [...new Set(derived.map((d) => d.year))].sort((a, b) => Number(b) - Number(a));
          setSelectedYear(years[0] ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setTaxStatus(docId: string, status: TaxStatusKey) {
    setSaving((s) => ({ ...s, [docId]: true }));
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tax_status: status }),
      });
      if (res.ok) {
        setDocs((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, taxStatus: status } : d))
        );
      }
    } finally {
      setSaving((s) => ({ ...s, [docId]: false }));
    }
  }

  const years = [...new Set(docs.map((d) => d.year))].sort((a, b) => Number(b) - Number(a));
  const yearDocs = docs.filter((d) => d.year === selectedYear);

  // Group by tax category in defined order
  const byCategory = CATEGORY_ORDER.reduce<Record<string, DocWithDerived[]>>((acc, cat) => {
    const catDocs = yearDocs.filter((d) => d.taxCategory === cat);
    if (catDocs.length > 0) acc[cat] = catDocs;
    return acc;
  }, {});

  const yearTotal = yearDocs.reduce((s, d) => s + (d.amount ?? 0), 0);
  const yearClaimed = yearDocs
    .filter((d) => d.taxStatus === "claimed")
    .reduce((s, d) => s + (d.amount ?? 0), 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
        <Link href="/documents" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold">Tax Tracker</h1>
        {years.length > 1 && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="ml-auto rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 pb-8 flex flex-col gap-6">
        {loading ? (
          <p className="text-zinc-500 py-8">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-zinc-500 py-8">
            No documents with a tax category yet. Capture some and the AI will classify them, or set the category manually on a document.
          </p>
        ) : (
          <>
            {/* Year summary bar */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 flex gap-6 text-sm">
              <div>
                <p className="text-zinc-500">Total deductions</p>
                <p className="font-semibold text-lg">{fmt(yearTotal)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Claimed</p>
                <p className="font-semibold text-lg text-emerald-600 dark:text-emerald-400">{fmt(yearClaimed)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Unclaimed</p>
                <p className="font-semibold text-lg text-amber-600 dark:text-amber-400">{fmt(yearTotal - yearClaimed)}</p>
              </div>
            </div>

            {Object.entries(byCategory).map(([cat, catDocs]) => {
              const catTotal = catDocs.reduce((s, d) => s + (d.amount ?? 0), 0);
              const catClaimed = catDocs
                .filter((d) => d.taxStatus === "claimed")
                .reduce((s, d) => s + (d.amount ?? 0), 0);

              return (
                <section key={cat}>
                  <div className="flex items-baseline justify-between mb-2">
                    <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </h2>
                    <div className="flex gap-3 text-sm text-zinc-500">
                      <span>{fmt(catTotal)}</span>
                      {catClaimed > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">{fmt(catClaimed)} claimed</span>
                      )}
                    </div>
                  </div>

                  <ul className="flex flex-col gap-2">
                    {catDocs
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((doc) => {
                        const statusInfo = TAX_STATUS_CONFIG[doc.taxStatus];
                        return (
                          <li
                            key={doc.id}
                            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <Link
                                  href={`/documents/${doc.id}`}
                                  className="font-medium truncate block hover:underline"
                                >
                                  {doc.displayTitle}
                                </Link>
                                <p className="text-sm text-zinc-500 mt-0.5">
                                  {doc.date}
                                  {doc.amount != null && (
                                    <span className="ml-2 font-medium text-zinc-700 dark:text-zinc-200">
                                      {fmt(doc.amount)}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.badgeColor}`}>
                                {statusInfo.icon}
                                {statusInfo.label}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-3">
                              {TAX_STATUS_KEYS.map((s) => {
                                const cfg = TAX_STATUS_CONFIG[s];
                                const isActive = doc.taxStatus === s;
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    disabled={saving[doc.id] || isActive}
                                    onClick={() => setTaxStatus(doc.id, s)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors disabled:cursor-default ${
                                      isActive ? cfg.activeBtn : cfg.idleBtn
                                    }`}
                                  >
                                    {cfg.icon}
                                    {cfg.label}
                                  </button>
                                );
                              })}
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
