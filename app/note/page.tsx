"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { marked } from "marked";

export default function AddNotePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const renderedHtml = useMemo(() => {
    if (!preview || !text.trim()) return "";
    return marked(text) as string;
  }, [preview, text]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/documents/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/documents/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
        <Link href="/" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold flex-1">Add note</h1>
        {text.trim() && (
          <div className="inline-flex rounded-lg border border-zinc-300 dark:border-zinc-600 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={`px-3 py-1.5 ${!preview ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={`px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-600 ${preview ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              Preview
            </button>
          </div>
        )}
      </header>
      <main className="max-w-2xl mx-auto px-4 py-4">
        {!preview && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Type or paste your note. Markdown is supported. It will be processed by AI for title, type, tags, and structured data.
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {preview ? (
            <div
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-3 min-h-[280px] prose prose-zinc dark:prose-invert max-w-none text-base"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type document text… Markdown supported."
              rows={14}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-3 text-base resize-y min-h-[280px] font-mono text-sm"
              disabled={saving}
              autoFocus
            />
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !text.trim()}
              className="rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 px-6 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving…
                </>
              ) : (
                "Save note"
              )}
            </button>
            <Link
              href="/"
              className="rounded-xl border border-zinc-300 dark:border-zinc-600 py-3 px-6 font-medium"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
