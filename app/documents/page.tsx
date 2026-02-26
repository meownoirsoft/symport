"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Doc = {
  id: string;
  status: string;
  tags?: string[];
  extractedData: Record<string, unknown>;
  createdAt: string;
};

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function summary(data: Record<string, unknown>): string {
  if (typeof data.title === "string" && data.title.trim()) return data.title.trim();
  if (typeof data.summary === "string") return data.summary;
  if (typeof data.provider === "string") return data.provider;
  if (typeof data.pharmacy === "string") return data.pharmacy;
  if (typeof data.insurer === "string") return data.insurer;
  return (data.type as string) || "Document";
}

const STATUSES = ["pending", "paid", "unpaid", "submitted", "reimbursed", "not_eligible"];

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const queryString = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);
    if (tagFilter.trim()) params.set("tag", tagFilter.trim());
    return params.toString();
  };

  useEffect(() => {
    fetch(`/api/documents?${queryString()}`)
      .then((r) => r.json())
      .then(setDocs)
      .finally(() => setLoading(false));
  }, [q, statusFilter, tagFilter]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
        <Link href="/" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold">Documents</h1>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        <input
          type="search"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-3 text-base"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by tag (e.g. medical, receipt)"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm"
          aria-label="Filter by tag"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {docs.length > 0 && (
              <>
                <a
                  href={`/api/documents/export?format=csv&${queryString()}`}
                  download
                  className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Export CSV
                </a>
                <a
                  href={`/api/documents/export?format=json&${queryString()}`}
                  download
                  className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Export JSON
                </a>
              </>
            )}
          </div>
          <Link
            href="/capture"
            className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 ml-auto"
          >
            Import document
          </Link>
        </div>
        {loading ? (
          <p className="text-zinc-500 py-8">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-zinc-500 py-8">No documents yet. <Link href="/capture" className="underline">Capture one</Link>.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {docs.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/documents/${doc.id}`}
                  className="block rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <p className="font-medium truncate">{summary(doc.extractedData)}</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    {doc.status} · {formatDate(doc.createdAt)}
                  </p>
                  {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 text-xs font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
