"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Category = { name: string; count: number };

export default function ContextsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/documents/categories")
      .then((res) => res.ok ? res.json() : { categories: [] })
      .then((data) => {
        setCategories(data.categories ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-16">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-4">
        <h1 className="text-xl font-semibold">Contexts</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Tap a context to see documents. Use these in Chat so the AI knows your situation.
        </p>
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
                  className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-sm text-zinc-500">{cat.count} docs</span>
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
