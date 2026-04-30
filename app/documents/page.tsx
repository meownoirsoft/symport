"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

type Doc = {
  id: string;
  tags?: string[];
  extractedData: Record<string, unknown>;
  createdAt: string;
};

type CategoryWithCount = { name: string; count: number };

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

function DocumentsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [taxCategoryFilter, setTaxCategoryFilter] = useState("");
  const [hsaFsaFilter, setHsaFsaFilter] = useState("");
  const [taxYearFilter, setTaxYearFilter] = useState("");
  const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryWithCount[]>([]);

  // Sync tag and category from URL on load and when URL changes
  useEffect(() => {
    setTagFilter(searchParams.get("tag")?.trim() ?? "");
    setCategoryFilter(searchParams.get("category")?.trim() ?? "");
    setTaxCategoryFilter(searchParams.get("tax_category")?.trim() ?? "");
    setHsaFsaFilter(searchParams.get("hsa_fsa_eligible")?.trim() ?? "");
    setTaxYearFilter(searchParams.get("tax_year")?.trim() ?? "");
  }, [searchParams]);

  const queryString = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tagFilter.trim()) params.set("tag", tagFilter.trim());
    if (categoryFilter.trim()) params.set("category", categoryFilter.trim());
    if (taxCategoryFilter.trim()) params.set("tax_category", taxCategoryFilter.trim());
    if (hsaFsaFilter.trim()) params.set("hsa_fsa_eligible", hsaFsaFilter.trim());
    if (taxYearFilter.trim()) params.set("tax_year", taxYearFilter.trim());
    return params.toString();
  }, [q, tagFilter, categoryFilter, taxCategoryFilter, hsaFsaFilter, taxYearFilter]);

  const setTagAndUrl = useCallback(
    (tag: string) => {
      setTagFilter(tag);
      const params = new URLSearchParams(searchParams.toString());
      if (tag) params.set("tag", tag);
      else params.delete("tag");
      const next = params.toString();
      router.replace(next ? `/documents?${next}` : "/documents", { scroll: false });
    },
    [router, searchParams]
  );

  const setCategoryAndUrl = useCallback(
    (category: string) => {
      setCategoryFilter(category);
      const params = new URLSearchParams(searchParams.toString());
      if (category) params.set("category", category);
      else params.delete("category");
      const next = params.toString();
      router.replace(next ? `/documents?${next}` : "/documents", { scroll: false });
    },
    [router, searchParams]
  );

  const setTaxYearAndUrl = useCallback(
    (year: string) => {
      setTaxYearFilter(year);
      const params = new URLSearchParams(searchParams.toString());
      if (year) params.set("tax_year", year);
      else params.delete("tax_year");
      const next = params.toString();
      router.replace(next ? `/documents?${next}` : "/documents", { scroll: false });
    },
    [router, searchParams]
  );

  const setHsaFsaAndUrl = useCallback(
    (val: string) => {
      setHsaFsaFilter(val);
      const params = new URLSearchParams(searchParams.toString());
      if (val) params.set("hsa_fsa_eligible", val);
      else params.delete("hsa_fsa_eligible");
      const next = params.toString();
      router.replace(next ? `/documents?${next}` : "/documents", { scroll: false });
    },
    [router, searchParams]
  );

  const setTaxCategoryAndUrl = useCallback(
    (tc: string) => {
      setTaxCategoryFilter(tc);
      const params = new URLSearchParams(searchParams.toString());
      if (tc) params.set("tax_category", tc);
      else params.delete("tax_category");
      const next = params.toString();
      router.replace(next ? `/documents?${next}` : "/documents", { scroll: false });
    },
    [router, searchParams]
  );

  const clearTopicAndUrl = useCallback(() => {
    setTagFilter("");
    setCategoryFilter("");
    setTaxCategoryFilter("");
    setHsaFsaFilter("");
    setTaxYearFilter("");
    router.replace("/documents", { scroll: false });
  }, [router]);

  // Fetch documents when filters change
  useEffect(() => {
    setLoading(true);
    fetch(`/api/documents?${queryString()}`)
      .then((r) => r.json())
      .then(setDocs)
      .finally(() => setLoading(false));
  }, [queryString]);

  // Fetch category counts once on mount
  useEffect(() => {
    fetch("/api/documents/categories")
      .then((r) => r.json())
      .then((data: { categories: CategoryWithCount[] }) => setCategoriesWithCounts(data.categories ?? []))
      .catch(() => setCategoriesWithCounts([]));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold">Documents</h1>
        </div>
        <Link
          href="/settings/categories"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Manage categories
        </Link>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        {(tagFilter || categoryFilter) ? (
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium">
              {categoryFilter || tagFilter} documents{docs.length > 0 ? ` (${docs.length})` : ""}
            </h2>
            <button
              type="button"
              onClick={clearTopicAndUrl}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Show all
            </button>
          </div>
        ) : null}
        {categoriesWithCounts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <span className="sr-only">Filter by category</span>
            {categoriesWithCounts.map(({ name, count }) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategoryAndUrl(categoryFilter === name ? "" : name)}
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ${
                  categoryFilter === name
                    ? "bg-zinc-700 dark:bg-zinc-500 text-white"
                    : "border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {name} ({count})
              </button>
            ))}
          </div>
        ) : null}
        <input
          type="search"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-3 text-base"
        />
        <input
          type="text"
          placeholder="Filter by tag (optional)"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          onBlur={() => {
            const t = tagFilter.trim();
            const params = new URLSearchParams(searchParams.toString());
            if (t) params.set("tag", t);
            else params.delete("tag");
            const next = params.toString();
            router.replace(next ? `/documents?${next}` : "/documents", { scroll: false });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const t = tagFilter.trim();
              const params = new URLSearchParams(searchParams.toString());
              if (t) params.set("tag", t);
              else params.delete("tag");
              const next = params.toString();
              router.replace(next ? `/documents?${next}` : "/documents", { scroll: false });
            }
          }}
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm"
          aria-label="Filter by tag"
        />
        <div className="flex gap-2">
          <select
            value={taxCategoryFilter}
            onChange={(e) => setTaxCategoryAndUrl(e.target.value)}
            className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm"
            aria-label="Filter by tax category"
          >
            <option value="">All tax categories</option>
            <option value="medical">Medical</option>
            <option value="charity">Charity</option>
            <option value="tax_payment">Tax payment</option>
            <option value="mortgage_interest">Mortgage interest</option>
            <option value="business_expense">Business expense</option>
            <option value="personal">Personal</option>
            <option value="unknown">Unknown</option>
          </select>
          <select
            value={hsaFsaFilter}
            onChange={(e) => setHsaFsaAndUrl(e.target.value)}
            className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm"
            aria-label="Filter by HSA/FSA eligibility"
          >
            <option value="">HSA/FSA: any</option>
            <option value="true">HSA/FSA eligible</option>
            <option value="false">Not eligible</option>
          </select>
          <select
            value={taxYearFilter}
            onChange={(e) => setTaxYearAndUrl(e.target.value)}
            className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm"
            aria-label="Filter by tax year"
          >
            <option value="">All years</option>
            {Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => String(new Date().getFullYear() - i)).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
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
            className="rounded-xl border border-sky-400 dark:border-sky-500 bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200 px-4 py-2 text-sm font-medium hover:bg-sky-200 dark:hover:bg-sky-800/60 ml-auto"
          >
            Import document
          </Link>
        </div>
        {loading ? (
          <p className="text-zinc-500 py-8">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-zinc-500 py-8">
            {tagFilter ? (
              <>No documents with tag &quot;{tagFilter}&quot;. <button type="button" onClick={clearTopicAndUrl} className="underline">Show all</button></>
            ) : categoryFilter ? (
              <>No documents in category &quot;{categoryFilter}&quot;. <button type="button" onClick={clearTopicAndUrl} className="underline">Show all</button></>
            ) : (
              <>No documents yet. <Link href="/capture" className="underline">Capture one</Link>.</>
            )}
          </p>
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
                    {formatDate(doc.createdAt)}
                  </p>
                  {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2" onClick={(e) => e.preventDefault()}>
                      {doc.tags.map((tag) => (
                        <Link
                          key={tag}
                          href={`/documents?tag=${encodeURIComponent(tag)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 text-xs font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        >
                          {tag}
                        </Link>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const tc = doc.extractedData.tax_category as string | null | undefined;
                    const hsa = doc.extractedData.hsa_fsa_eligible;
                    if (!tc && hsa == null) return null;
                    const TAX_COLORS: Record<string, string> = {
                      medical: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                      charity: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
                      tax_payment: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
                      mortgage_interest: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
                      business_expense: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
                      personal: "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400",
                      unknown: "bg-zinc-100 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500",
                    };
                    const TAX_LABELS: Record<string, string> = {
                      medical: "Tax: Medical", charity: "Tax: Charity", tax_payment: "Tax: Tax payment",
                      mortgage_interest: "Tax: Mortgage interest", business_expense: "Tax: Business expense",
                      personal: "Tax: Personal", unknown: "Tax: Unknown",
                    };
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-1.5" onClick={(e) => e.preventDefault()}>
                        {tc && tc !== "unknown" && (
                          <Link
                            href={`/documents?tax_category=${encodeURIComponent(tc)}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium hover:opacity-80 ${TAX_COLORS[tc] ?? TAX_COLORS.unknown}`}
                          >
                            {TAX_LABELS[tc] ?? tc}
                          </Link>
                        )}
                        {hsa === true && (
                          <Link
                            href="/documents?hsa_fsa_eligible=true"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium hover:opacity-80 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          >
                            HSA/FSA ✓
                          </Link>
                        )}
                      </div>
                    );
                  })()}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <DocumentsContent />
    </Suspense>
  );
}
