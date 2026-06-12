"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Mapping = {
  categories: string[];
  tagsByCategory: Record<string, string[]>;
  overrides: Record<string, string | null>;
  categoryNotes: Record<string, string>;
};

type TagSuggestion = {
  tag: string;
  count: number;
  coTags: { tag: string; count: number }[];
};

export default function ManageCategoriesPage() {
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragTag, setDragTag] = useState<string | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [addTag, setAddTag] = useState({ tag: "", category: "" });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [renameState, setRenameState] = useState<{ category: string; value: string } | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function fetchMapping() {
    setLoading(true);
    Promise.all([
      fetch("/api/settings/category-mapping").then((r) => r.json()),
      fetch("/api/documents/categories").then((r) => r.json()),
      fetch("/api/settings/suggested-categories").then((r) => r.ok ? r.json() : { suggestions: [] }),
    ])
      .then(([mappingData, countsData, suggestionsData]: [Mapping, { categories: { name: string; count: number }[]; tagCounts: Record<string, number> }, { suggestions: TagSuggestion[] }]) => {
        setMapping(mappingData);
        setNotesDraft(mappingData.categoryNotes ?? {});
        if (mappingData.categories.length && !addTag.category) setAddTag((a) => ({ ...a, category: mappingData.categories[0] }));
        const cc: Record<string, number> = {};
        for (const c of countsData.categories ?? []) cc[c.name] = c.count;
        setCatCounts(cc);
        setTagCounts(countsData.tagCounts ?? {});
        setSuggestions(suggestionsData.suggestions ?? []);
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

  async function dropTagOnCategory(tag: string, targetCategory: string) {
    setDragTag(null);
    setDragOverCat(null);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/category-mapping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, category: targetCategory }),
      });
      if (!res.ok) throw new Error(await res.text());
      fetchMapping();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function saveCategoryNote(category: string, note: string) {
    try {
      await fetch("/api/settings/category-mapping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setCategoryNote: { category, note } }),
      });
    } catch {
      // non-blocking; user can retry by blurring again
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
        <Link href="/chat" className="ml-auto text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          Go to Chat →
        </Link>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Categories group tags on the documents page. Documents appear in a category when they have at least one tag that maps to it. Tags removed from a category go to Other.
        </p>
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Tip: drag any tag and drop it onto a different category to move it.
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

        {suggestions.length > 0 && (
          <section className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
              Suggested: uncategorized tags
            </h2>
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
              These tags appear on multiple documents but aren&apos;t mapped to any category. Assign them to a category or create a new one.
            </p>
            <ul className="flex flex-wrap gap-2">
              {suggestions.slice(0, 20).map((s) => (
                <li key={s.tag} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAddTag({ tag: s.tag, category: mapping.categories[0] ?? "" })}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-2 py-1 text-xs hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                    title={s.coTags.length > 0 ? `Often with: ${s.coTags.map((c) => c.tag).join(", ")}` : undefined}
                  >
                    {s.tag}
                    <span className="text-amber-500 dark:text-amber-400 text-[10px]">({s.count})</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-col gap-4">
          {mapping.categories.map((cat) => (
            <section
              key={cat}
              className={`rounded-xl border p-4 transition-colors ${
                dragOverCat === cat
                  ? "border-sky-400 bg-sky-50 dark:bg-sky-950/30"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCat(cat); }}
              onDragLeave={() => setDragOverCat(null)}
              onDrop={(e) => {
                e.preventDefault();
                const tag = e.dataTransfer.getData("text/plain");
                if (tag && tag !== "" && dragTag) dropTagOnCategory(tag, cat);
              }}
            >
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
                    <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {cat}
                      {catCounts[cat] != null && (
                        <span className="ml-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                          {catCounts[cat]} docs
                        </span>
                      )}
                    </h2>
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
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", tag); setDragTag(tag); }}
                    onDragEnd={() => { setDragTag(null); setDragOverCat(null); }}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs cursor-grab active:cursor-grabbing transition-opacity ${
                      dragTag === tag ? "opacity-40" : ""
                    } bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200`}
                  >
                    {tag}
                    {tagCounts[tag] != null && (
                      <span className="text-zinc-400 dark:text-zinc-500">({tagCounts[tag]})</span>
                    )}
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
                  <li className="text-xs text-zinc-500 italic">
                    {dragOverCat === cat ? "Drop here" : "No tags — drag one here"}
                  </li>
                )}
              </ul>
              <textarea
                rows={2}
                placeholder="Notes about this category (saved automatically when you click away)…"
                value={notesDraft[cat] ?? ""}
                onChange={(e) => setNotesDraft((d) => ({ ...d, [cat]: e.target.value }))}
                onBlur={() => saveCategoryNote(cat, notesDraft[cat] ?? "")}
                className="mt-3 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
