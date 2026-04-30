"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Category = { name: string; count: number };

export default function ContextsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tagsByCategory, setTagsByCategory] = useState<Record<string, string[]>>({});
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/documents/categories").then((r) => r.ok ? r.json() : { categories: [], tagCounts: {} }),
      fetch("/api/settings/category-mapping").then((r) => r.ok ? r.json() : { tagsByCategory: {} }),
    ]).then(([countsData, mappingData]) => {
      setCategories(countsData.categories ?? []);
      setTagCounts(countsData.tagCounts ?? {});
      setTagsByCategory(mappingData.tagsByCategory ?? {});
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-16">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Contexts</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Tap a context to see documents. Use these in Chat so the AI knows your situation.
          </p>
        </div>
        <Link
          href="/settings/categories"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 shrink-0"
        >
          Manage
        </Link>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <p className="text-zinc-500">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li key={cat.name}>
                <Link
                  href={`/documents?category=${encodeURIComponent(cat.name)}`}
                  className="block rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-sm text-zinc-400">{cat.count} docs</span>
                  </div>
                  {(tagsByCategory[cat.name] ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(tagsByCategory[cat.name] ?? []).slice(0, 12).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 text-xs"
                        >
                          {tag}
                          {tagCounts[tag] != null && (
                            <span className="text-zinc-400 dark:text-zinc-500">({tagCounts[tag]})</span>
                          )}
                        </span>
                      ))}
                      {(tagsByCategory[cat.name] ?? []).length > 12 && (
                        <span className="text-xs text-zinc-400">+{(tagsByCategory[cat.name] ?? []).length - 12} more</span>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            ))}
            {categories.length === 0 && (
              <p className="text-zinc-500 py-6">No contexts yet. Tag documents to build categories.</p>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
