"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type NoteFile = {
  name: string;
  path: string;
  rawText: string;
  frontmatterTags: string[];
  frontmatterTitle: string;
  bodyPreview: string;
  selected: boolean;
};

type ImportResult = { name: string; id?: string; error?: string };

function parseFrontmatter(text: string): {
  tags: string[];
  title: string;
  body: string;
} {
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) return { tags: [], title: "", body: text };

  const fm = fmMatch[1];
  const body = fmMatch[2].trim();

  const titleMatch = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const title = titleMatch ? titleMatch[1].trim() : "";

  const tags: string[] = [];
  const inlineTagsMatch = fm.match(/^tags:\s*\[(.+?)\]/m);
  if (inlineTagsMatch) {
    inlineTagsMatch[1].split(",").forEach((t) => {
      const cleaned = t.trim().replace(/["']/g, "");
      if (cleaned) tags.push(cleaned);
    });
  } else {
    const blockTagsMatch = fm.match(/^tags:\s*\n((?:\s+-\s*.+\n?)+)/m);
    if (blockTagsMatch) {
      blockTagsMatch[1].split("\n").forEach((line) => {
        const m = line.match(/^\s+-\s*["']?(.+?)["']?\s*$/);
        if (m) tags.push(m[1].trim());
      });
    }
  }

  return { tags, title, body };
}

function cleanObsidian(text: string): string {
  return (
    text
      // Remove image embeds ![[...]]
      .replace(/!\[\[.*?\]\]/g, "")
      // Convert [[link|alias]] to alias
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      // Convert [[link]] to link text
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      // Remove block IDs ^abcde
      .replace(/\s*\^[a-z0-9-]+$/gm, "")
      // Remove Obsidian comments %%...%%
      .replace(/%%[\s\S]*?%%/g, "")
      .trim()
  );
}

function buildNoteText(file: NoteFile): string {
  const { tags, title, body } = parseFrontmatter(file.rawText);
  const cleanedBody = cleanObsidian(body);

  const parts: string[] = [];
  const displayTitle = title || file.name.replace(/\.md$/i, "");
  parts.push(`# ${displayTitle}`);
  if (tags.length > 0) parts.push(`Tags: ${tags.join(", ")}`);
  parts.push(cleanedBody);
  return parts.join("\n\n");
}

async function processFiles(fileList: FileList): Promise<NoteFile[]> {
  const results: NoteFile[] = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (!file.name.match(/\.(md|markdown)$/i)) continue;
    const rawText = await file.text();
    const { tags, title, body } = parseFrontmatter(rawText);
    const cleanedBody = cleanObsidian(body);
    const bodyPreview = cleanedBody.slice(0, 120).replace(/\n+/g, " ").trim();
    results.push({
      name: file.name,
      path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      rawText,
      frontmatterTags: tags,
      frontmatterTitle: title,
      bodyPreview,
      selected: true,
    });
  }
  return results;
}

export default function ObsidianImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  const [notes, setNotes] = useState<NoteFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);
  const [done, setDone] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const parsed = await processFiles(fileList);
    setNotes(parsed);
    setResults([]);
    setDone(false);
    setProgress({ done: 0, total: 0 });
  }

  function toggleNote(idx: number) {
    setNotes((prev) =>
      prev.map((n, i) => (i === idx ? { ...n, selected: !n.selected } : n))
    );
  }

  function toggleAll(val: boolean) {
    setNotes((prev) => prev.map((n) => ({ ...n, selected: val })));
  }

  async function runImport() {
    const toImport = notes.filter((n) => n.selected);
    if (toImport.length === 0) return;
    setImporting(true);
    setResults([]);
    setProgress({ done: 0, total: toImport.length });

    const importResults: ImportResult[] = [];
    for (let i = 0; i < toImport.length; i++) {
      const note = toImport[i];
      const text = buildNoteText(note);
      try {
        const res = await fetch("/api/documents/note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        importResults.push({ name: note.name, id: data.id });
      } catch (err) {
        importResults.push({
          name: note.name,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
      setProgress({ done: i + 1, total: toImport.length });
    }

    setResults(importResults);
    setImporting(false);
    setDone(true);
  }

  const selectedCount = notes.filter((n) => n.selected).length;
  const successCount = results.filter((r) => !r.error).length;
  const errorCount = results.filter((r) => r.error).length;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Import from Obsidian</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Import Markdown notes as documents</p>
        </div>
        <Link
          href="/documents"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Cancel
        </Link>
      </header>

      {notes.length === 0 && !done && (
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center space-y-4">
            <div className="text-4xl">📓</div>
            <div>
              <p className="font-medium text-zinc-800 dark:text-zinc-200">Choose your Obsidian notes</p>
              <p className="text-sm text-zinc-500 mt-1">Select individual files or an entire vault folder</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors"
              >
                Select .md files
              </button>
              <button
                onClick={() => dirInputRef.current?.click()}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Select vault folder
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-400 text-center">
            Wikilinks, embeds, and Obsidian-specific syntax are cleaned automatically.
            Frontmatter tags and titles are preserved.
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={dirInputRef}
        type="file"
        accept=".md,.markdown"
        multiple
        // @ts-expect-error webkitdirectory not in standard types
        webkitdirectory=""
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {notes.length > 0 && !done && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {notes.length} note{notes.length !== 1 ? "s" : ""} found
            </p>
            <div className="flex gap-3 text-sm">
              <button
                onClick={() => toggleAll(true)}
                className="text-sky-600 hover:underline"
              >
                All
              </button>
              <button
                onClick={() => toggleAll(false)}
                className="text-zinc-500 hover:underline"
              >
                None
              </button>
            </div>
          </div>

          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            {notes.map((note, idx) => (
              <li
                key={note.path}
                className="flex items-start gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                onClick={() => toggleNote(idx)}
              >
                <input
                  type="checkbox"
                  checked={note.selected}
                  onChange={() => toggleNote(idx)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 shrink-0 accent-sky-600"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {note.frontmatterTitle || note.name.replace(/\.md$/i, "")}
                  </p>
                  {note.frontmatterTags.length > 0 && (
                    <p className="text-xs text-sky-600 dark:text-sky-400 mt-0.5">
                      {note.frontmatterTags.join(", ")}
                    </p>
                  )}
                  {note.bodyPreview && (
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{note.bodyPreview}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {importing ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span>Importing...</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={runImport}
                disabled={selectedCount === 0}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 text-white font-medium text-sm hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Import {selectedCount > 0 ? `${selectedCount} note${selectedCount !== 1 ? "s" : ""}` : ""}
              </button>
              <button
                onClick={() => {
                  setNotes([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  if (dirInputRef.current) dirInputRef.current.value = "";
                }}
                className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      {done && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 space-y-2">
            <p className="font-medium">Import complete</p>
            {successCount > 0 && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {successCount} note{successCount !== 1 ? "s" : ""} imported successfully
              </p>
            )}
            {errorCount > 0 && (
              <p className="text-sm text-red-500">
                {errorCount} note{errorCount !== 1 ? "s" : ""} failed
              </p>
            )}
            {errorCount > 0 && (
              <ul className="mt-2 space-y-1">
                {results.filter((r) => r.error).map((r) => (
                  <li key={r.name} className="text-xs text-red-400">
                    {r.name}: {r.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-3">
            <Link
              href="/documents"
              className="flex-1 py-2.5 rounded-xl bg-sky-600 text-white font-medium text-sm text-center hover:bg-sky-700 transition-colors"
            >
              View documents
            </Link>
            <button
              onClick={() => {
                setNotes([]);
                setDone(false);
                setResults([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
                if (dirInputRef.current) dirInputRef.current.value = "";
              }}
              className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Import more
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
