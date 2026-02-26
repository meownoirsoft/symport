"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryWithCount[]>([]);

  // Sync tag and category from URL on load and when URL changes
  useEffect(() => {
    setTagFilter(searchParams.get("tag")?.trim() ?? "");
    setCategoryFilter(searchParams.get("category")?.trim() ?? "");
  }, [searchParams]);

  const queryString = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tagFilter.trim()) params.set("tag", tagFilter.trim());
    if (categoryFilter.trim()) params.set("category", categoryFilter.trim());
    return params.toString();
  }, [q, tagFilter, categoryFilter]);

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

  const clearTopicAndUrl = useCallback(() => {
    setTagFilter("");
    setCategoryFilter("");
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
