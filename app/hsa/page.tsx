"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Doc = {
  id: string;
  tags?: string[];
  status: string;
  extractedData: Record<string, unknown>;
  createdAt: string;
};

type DocWithDerived = Doc & {
  displayTitle: string;
  date: string;
  year: string;
  amount: number | null;
};

type StatusKey = "pending" | "submitted" | "reimbursed" | "not_eligible";

const STATUS_CONFIG: Record<StatusKey, {
  label: string;
  badgeColor: string;
  activeBtn: string;
  idleBtn: string;
  icon: React.ReactNode;
}> = {
  pending: {
    label: "Pending",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    activeBtn: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700",
    idleBtn:   "bg-white text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-zinc-900 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/20",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  submitted: {
    label: "Submitted",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    activeBtn: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700",
    idleBtn:   "bg-white text-blue-700 border-blue-200 hover:bg-blue-50 dark:bg-zinc-900 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/20",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
      </svg>
    ),
  },
  reimbursed: {
    label: "Reimbursed",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    activeBtn: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700",
    idleBtn:   "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/20",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  not_eligible: {
    label: "Not eligible",
    badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    activeBtn: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700",
    idleBtn:   "bg-white text-red-600 border-red-200 hover:bg-red-50 dark:bg-zinc-900 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
};

const STATUS_KEYS: StatusKey[] = ["pending", "submitted", "reimbursed", "not_eligible"];

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

  const rawAmount =
    d.amount ?? d.copay_amount ?? d.patient_responsibility ?? d.amount_paid;
  const amount =
    rawAmount != null && !Number.isNaN(parseFloat(String(rawAmount)))
      ? parseFloat(String(rawAmount))
      : null;

  return { ...doc, displayTitle, date, year, amount };
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function HsaTrackerPage() {
  const [docs, setDocs] = useState<DocWithDerived[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/documents?hsa_fsa_eligible=true")
      .then((r) => r.json())
      .then((raw: Doc[]) => setDocs(raw.map(derive)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setStatus(docId: string, status: string) {
    setSaving((s) => ({ ...s, [docId]: true }));
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setDocs((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status } : d))
        );
      }
    } finally {
      setSaving((s) => ({ ...s, [docId]: false }));
    }
  }

  // Group by year descending
  const byYear = docs.reduce<Record<string, DocWithDerived[]>>((acc, doc) => {
    (acc[doc.year] ??= []).push(doc);
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
        <Link href="/documents" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold">HSA / FSA Tracker</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-8 flex flex-col gap-8">
        {loading ? (
          <p className="text-zinc-500 py-8">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-zinc-500 py-8">
            No HSA/FSA-eligible documents yet.{" "}
            <Link href="/capture" className="underline">Capture one</Link>.
          </p>
        ) : (
          years.map((year) => {
            const yearDocs = byYear[year]!;
            const total = yearDocs.reduce((s, d) => s + (d.amount ?? 0), 0);
            const reimbursed = yearDocs
              .filter((d) => d.status === "reimbursed")
              .reduce((s, d) => s + (d.amount ?? 0), 0);
            const pending = yearDocs
              .filter((d) => d.status !== "reimbursed" && d.status !== "not_eligible")
              .reduce((s, d) => s + (d.amount ?? 0), 0);

            return (
              <section key={year}>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-lg font-semibold">{year}</h2>
                  <div className="flex gap-4 text-sm text-zinc-500">
                    <span>Total <span className="font-medium text-zinc-700 dark:text-zinc-200">{fmt(total)}</span></span>
                    <span>Reimbursed <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmt(reimbursed)}</span></span>
                    <span>Pending <span className="font-medium text-blue-600 dark:text-blue-400">{fmt(pending)}</span></span>
                  </div>
                </div>

                <ul className="flex flex-col gap-2">
                  {yearDocs
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((doc) => {
                      const statusKey = (STATUS_KEYS.includes(doc.status as StatusKey) ? doc.status : "pending") as StatusKey;
                      const statusInfo = STATUS_CONFIG[statusKey];
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
                            {STATUS_KEYS.map((s) => {
                              const cfg = STATUS_CONFIG[s];
                              const isActive = doc.status === s;
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  disabled={saving[doc.id] || isActive}
                                  onClick={() => setStatus(doc.id, s)}
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
          })
        )}
      </main>
    </div>
  );
}
