"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Mapping = {
  categories: string[];
  tagsByCategory: Record<string, string[]>;
  overrides: Record<string, string | null>;
};

export default function ManageCategoriesPage() {
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addTag, setAddTag] = useState({ tag: "", category: "" });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [renameState, setRenameState] = useState<{ category: string; value: string } | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function fetchMapping() {
    setLoading(true);
    fetch("/api/settings/category-mapping")
      .then((r) => r.json())
      .then((data: Mapping) => {
        setMapping(data);
        if (data.categories.length && !addTag.category) setAddTag((a) => ({ ...a, category: data.categories[0] }));
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchMapping();
  }, []);

  async function addTagToCategory() {
    const tag = addTag.tag.trim().toLowerCase().replace(/\s+/g, "_");
    if (!tag || !addTag.category) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/category-mapping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, category: addTag.category }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAddTag((a) => ({ ...a, tag: "" }));
      fetchMapping();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function removeTagFromCategory(tag: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/category-mapping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, category: null }),
      });
      if (!res.ok) throw new Error(await res.text());
      fetchMapping();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/category-mapping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createCategory: name }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNewCategoryName("");
      fetchMapping();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function renameCategory(from: string, to: string) {
    if (!to.trim()) return;
    setSaving(true);
    setError(null);
    setRenameState(null);
    try {
      const res = await fetch("/api/settings/category-mapping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renameCategory: { from, to: to.trim() } }),
      });
      if (!res.ok) throw new Error(await res.text());
      fetchMapping();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(name: string) {
    setSaving(true);
    setError(null);
    setRemoveConfirm(null);
    try {
      const res = await fetch("/api/settings/category-mapping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeCategory: name }),
      });
      if (!res.ok) throw new Error(await res.text());
      fetchMapping();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !mapping) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <header className="max-w-lg mx-auto px-4 py-4">
          <Link href="/documents" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Back to documents
          </Link>
        </header>
        <main className="max-w-lg mx-auto px-4 py-8 text-zinc-500">Loading…</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
        <Link href="/documents" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back to documents
        </Link>
        <h1 className="text-xl font-semibold">Manage categories</h1>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Categories group tags on the documents page. Documents appear in a category when they have at least one tag that maps to it. Tags removed from a category go to Other.
        </p>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">New category</span>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm w-40"
            />
          </label>
          <button
            type="button"
            onClick={createCategory}
            disabled={saving || !newCategoryName.trim()}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            Create category
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Tag</span>
            <input
              type="text"
              value={addTag.tag}
              onChange={(e) => setAddTag((a) => ({ ...a, tag: e.target.value }))}
              placeholder="e.g. therapy"
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm w-36"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Category</span>
            <select
              value={addTag.category}
              onChange={(e) => setAddTag((a) => ({ ...a, category: e.target.value }))}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            >
              {mapping.categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addTagToCategory}
            disabled={saving || !addTag.tag.trim()}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add mapping"}
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {mapping.categories.map((cat) => (
            <section key={cat} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {renameState?.category === cat ? (
                  <>
                    <input
                      type="text"
                      value={renameState.value}
                      onChange={(e) => setRenameState((s) => (s ? { ...s, value: e.target.value } : null))}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-sm font-semibold w-40"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => renameCategory(cat, renameState!.value)}
                      disabled={saving || !renameState.value.trim()}
                      className="text-sm text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenameState(null)}
                      className="text-sm text-zinc-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{cat}</h2>
                    {cat !== "Other" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setRenameState({ category: cat, value: cat })}
                          disabled={saving}
                          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        >
                          Rename
                        </button>
                        {removeConfirm === cat ? (
                          <>
                            <span className="text-xs text-zinc-500">Remove? Tags will move to Other.</span>
                            <button
                              type="button"
                              onClick={() => removeCategory(cat)}
                              disabled={saving}
                              className="text-xs text-red-600 dark:text-red-400 hover:underline"
                            >
                              Yes, remove
                            </button>
                            <button
                              type="button"
                              onClick={() => setRemoveConfirm(null)}
                              className="text-xs text-zinc-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRemoveConfirm(cat)}
                            disabled={saving}
                            className="text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                          >
                            Remove category
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
              <ul className="flex flex-wrap gap-2">
                {(mapping.tagsByCategory[cat] ?? []).map((tag) => (
                  <li
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-2 py-1 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTagFromCategory(tag)}
                      disabled={saving}
                      className="rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 p-0.5 leading-none disabled:opacity-50"
                      aria-label={`Remove ${tag} from ${cat}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
                {(mapping.tagsByCategory[cat] ?? []).length === 0 && (
                  <li className="text-xs text-zinc-500">No tags</li>
                )}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
