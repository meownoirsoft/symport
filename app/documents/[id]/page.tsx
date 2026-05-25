"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Cropper, { type ReactCropperElement } from "react-cropper";
import "react-cropper/node_modules/cropperjs/dist/cropper.css";
import { marked } from "marked";
import DOMPurify from "dompurify";

function PrettyJson({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null) {
    return <span className="text-zinc-500 dark:text-zinc-400">null</span>;
  }
  if (typeof data === "boolean") {
    return (
      <span className="text-amber-600 dark:text-amber-400">{data ? "true" : "false"}</span>
    );
  }
  if (typeof data === "number") {
    return <span className="text-emerald-600 dark:text-emerald-400">{data}</span>;
  }
  if (typeof data === "string") {
    return (
      <span className="text-zinc-700 dark:text-zinc-300">&quot;{data}&quot;</span>
    );
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-zinc-600 dark:text-zinc-400">[]</span>;
    return (
      <span>
        <span className="text-zinc-500 dark:text-zinc-400">[</span>
        <span className="block pl-4">
          {data.map((item, i) => (
            <span key={i} className="block">
              <PrettyJson data={item} depth={depth + 1} />
              {i < data.length - 1 && (
                <span className="text-zinc-500 dark:text-zinc-400">,</span>
              )}
            </span>
          ))}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">]</span>
      </span>
    );
  }
  if (typeof data === "object" && data !== null) {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-zinc-500 dark:text-zinc-400">{"{}"}</span>;
    return (
      <span>
        <span className="text-zinc-500 dark:text-zinc-400">{"{"}</span>
        <span className="block pl-4">
          {entries.map(([key, value], i) => (
            <span key={key} className="block">
              <span className="text-blue-600 dark:text-blue-400">&quot;{key}&quot;</span>
              <span className="text-zinc-500 dark:text-zinc-400">: </span>
              <PrettyJson data={value} depth={depth + 1} />
              {i < entries.length - 1 && (
                <span className="text-zinc-500 dark:text-zinc-400">,</span>
              )}
            </span>
          ))}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">{"}"}</span>
      </span>
    );
  }
  return null;
}

type Doc = {
  id: string;
  imagePath: string | null;
  noteText: string | null;
  rotation?: number;
  tags?: string[];
  extractedData: Record<string, unknown>;
  extractionNotes?: string | null;
  status?: string | null;
  createdAt: string;
};

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [title, setTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  const [retagging, setRetagging] = useState(false);
  const [extractionNotes, setExtractionNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [reExtracting, setReExtracting] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [savingCrop, setSavingCrop] = useState(false);
  const [savingSharpen, setSavingSharpen] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  const [taxCategory, setTaxCategory] = useState<string>("");
  const [hsaFsaEligible, setHsaFsaEligible] = useState<string>("");
  const [savingTaxFields, setSavingTaxFields] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [notePreview, setNotePreview] = useState(false);
  const cropModalCropperRef = useRef<ReactCropperElement>(null);
  const panStart = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  function applyDoc(d: Doc) {
    setDoc(d);
    if (typeof d.rotation === "number") setRotation(d.rotation);
    setTitle(
      typeof (d.extractedData as Record<string, unknown>)?.title === "string"
        ? (d.extractedData as Record<string, unknown>).title as string
        : ""
    );
    setTags(Array.isArray(d.tags) ? [...d.tags] : []);
    setExtractionNotes(d.extractionNotes ?? "");
    setNoteText(d.noteText ?? "");
    setTaxCategory(typeof d.extractedData.tax_category === "string" ? d.extractedData.tax_category : "");
    const hsa = d.extractedData.hsa_fsa_eligible;
    setHsaFsaEligible(hsa === true ? "true" : hsa === false ? "false" : "");
  }

  useEffect(() => {
    if (!id) return;
    fetch(`/api/documents/${id}`)
      .then((r) => r.json())
      .then(applyDoc);
  }, [id]);

  // Poll every 3s while extraction is still pending.
  // A doc is truly pending only if status==="pending" AND the title is still
  // the placeholder (real data hasn't arrived yet). This guards against old
  // documents that have real data but were never marked "done".
  function isExtractionPending(d: Doc) {
    if (d.status !== "pending") return false;
    const t = d.extractedData?.title;
    return !t || t === "Processing...";
  }

  useEffect(() => {
    if (!id || !doc) return;
    if (!isExtractionPending(doc)) return;
    const timer = setInterval(() => {
      fetch(`/api/documents/${id}`)
        .then((r) => r.json())
        .then((d: Doc) => {
          applyDoc(d);
          if (!isExtractionPending(d)) clearInterval(timer);
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, doc?.status, doc?.extractedData?.title]);

  function displayTitle(data: Record<string, unknown>): string {
    if (typeof data.title === "string" && data.title.trim()) return data.title.trim();
    if (typeof data.summary === "string") return data.summary;
    if (typeof data.provider === "string") return data.provider;
    return "Document";
  }

  async function saveTitle() {
    if (!id || savingTitle) return;
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || null }),
      });
      if (res.ok && doc) {
        const nextData = { ...doc.extractedData, title: title.trim() || null } as Record<string, unknown>;
        setDoc({ ...doc, extractedData: nextData });
      }
    } finally {
      setSavingTitle(false);
    }
  }

  async function saveTaxFields(nextTaxCategory: string, nextHsaFsa: string) {
    if (!id || savingTaxFields) return;
    setSavingTaxFields(true);
    try {
      const body: Record<string, unknown> = {
        tax_category: nextTaxCategory || null,
        hsa_fsa_eligible: nextHsaFsa === "true" ? true : nextHsaFsa === "false" ? false : null,
      };
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok && doc) {
        setDoc({
          ...doc,
          extractedData: {
            ...doc.extractedData,
            tax_category: body.tax_category,
            hsa_fsa_eligible: body.hsa_fsa_eligible,
          },
        });
      }
    } finally {
      setSavingTaxFields(false);
    }
  }

  async function saveTags(nextTags: string[]) {
    if (!id || savingTags) return;
    setSavingTags(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      });
      if (res.ok && doc) setDoc({ ...doc, tags: nextTags });
    } finally {
      setSavingTags(false);
    }
  }

  function addTag() {
    const t = tagInput.trim().replace(/\s+/g, "_");
    if (!t || tags.includes(t)) {
      setTagInput("");
      return;
    }
    const next = [...tags, t];
    setTags(next);
    setTagInput("");
    saveTags(next);
  }

  function removeTag(tag: string) {
    const next = tags.filter((x) => x !== tag);
    setTags(next);
    saveTags(next);
  }

  async function handleRetag() {
    if (!id || retagging) return;
    setRetagging(true);
    try {
      const res = await fetch(`/api/documents/${id}/retag`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      const updated = (await res.json()) as Doc;
      setDoc(updated);
      setTags(Array.isArray(updated.tags) ? [...updated.tags] : []);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Retag failed");
    } finally {
      setRetagging(false);
    }
  }

  async function handleDelete() {
    if (!id || deleting) return;
    if (!confirm("Delete this document? The image and extracted data will be removed.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/documents");
      else throw new Error(await res.text());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const openLightbox = useCallback(() => {
    setLightboxOpen(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const saveRotation = useCallback(
    (newRotation: number) => {
      if (!id) return;
      fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotation: newRotation }),
      }).then(() => {
        if (doc) setDoc({ ...doc, rotation: newRotation });
      });
    },
    [id, doc]
  );

  const rotateLeft = useCallback(() => {
    setRotation((r) => {
      const next = (r - 90 + 360) % 360;
      saveRotation(next);
      return next;
    });
  }, [saveRotation]);

  const rotateRight = useCallback(() => {
    setRotation((r) => {
      const next = (r + 90) % 360;
      saveRotation(next);
      return next;
    });
  }, [saveRotation]);

  const handleLightboxPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("[data-zoom-slider]")) return;
    isDragging.current = true;
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pan.x, pan.y]);

  const handleLightboxPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    },
    []
  );

  const handleLightboxPointerUp = useCallback((e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  async function saveNoteText() {
    if (!id || savingNote) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteText: noteText || null }),
      });
      if (res.ok && doc) setDoc({ ...doc, noteText: noteText || null });
    } finally {
      setSavingNote(false);
    }
  }

  const renderedNote = useMemo(() => {
    if (!notePreview || !noteText.trim()) return "";
    return DOMPurify.sanitize(marked(noteText) as string);
  }, [notePreview, noteText]);

  async function saveExtractionNotes() {
    if (!id || savingNotes) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractionNotes: extractionNotes || null }),
      });
      if (res.ok && doc) setDoc({ ...doc, extractionNotes: extractionNotes || null });
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleReExtract() {
    if (!id || reExtracting) return;
    setReExtracting(true);
    try {
      const res = await fetch(`/api/documents/${id}/re-extract`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as Doc;
      setDoc(updated);
      setTitle(
        typeof (updated.extractedData as Record<string, unknown>)?.title === "string"
          ? (updated.extractedData as Record<string, unknown>).title as string
          : ""
      );
      setTags(Array.isArray(updated.tags) ? [...updated.tags] : []);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Re-extraction failed");
    } finally {
      setReExtracting(false);
    }
  }

  function openCropModal() {
    if (!id) return;
    setCropImageUrl(`/api/documents/${id}/image?t=${Date.now()}`);
    setCropModalOpen(true);
  }

  async function handleSharpen() {
    if (!id || savingSharpen) return;
    setSavingSharpen(true);
    try {
      const res = await fetch(`/api/documents/${id}/image/sharpen`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      setImageKey((k) => k + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Sharpen failed");
    } finally {
      setSavingSharpen(false);
    }
  }

  async function saveCropAndClose() {
    const cropper = cropModalCropperRef.current?.cropper;
    if (!id || !cropper) return;
    setSavingCrop(true);
    try {
      const canvas = cropper.getCroppedCanvas();
      if (!canvas) throw new Error("Crop failed");
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.95);
      });
      if (!blob) throw new Error("Crop failed");
      const file = new File([blob], "document.jpg", { type: "image/jpeg" });
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/documents/${id}/image`, {
        method: "PUT",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      setImageKey((k) => k + 1);
      setCropModalOpen(false);
      setCropImageUrl(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save cropped image");
    } finally {
      setSavingCrop(false);
    }
  }

  function downloadJson() {
    if (!doc) return;
    const blob = new Blob([JSON.stringify(doc.extractedData, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `symport-${doc.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!id || !doc) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
        <Link href="/documents" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 shrink-0">
          ← Documents
        </Link>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            placeholder={doc ? displayTitle(doc.extractedData) : "Document"}
            className="flex-1 min-w-0 text-xl font-semibold bg-transparent border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
            aria-label="Document title"
          />
          {savingTitle && (
            <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">Saving…</span>
          )}
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-4 flex flex-col gap-6">
        {isExtractionPending(doc) && (
          <div className="flex items-center gap-3 rounded-xl bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 px-4 py-3 text-sm text-sky-700 dark:text-sky-300">
            <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Extracting document data — this page will update automatically…
          </div>
        )}
        {doc.imagePath ? (
          <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
            <div className="relative flex items-center justify-center min-h-[40vh]" style={{ transform: `rotate(${rotation}deg)` }}>
              <img
                src={`/api/documents/${doc.id}/image?t=${imageKey}`}
                alt="Document"
                className="w-full object-contain max-h-[60vh] cursor-zoom-in"
                onClick={openLightbox}
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 py-2 px-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80">
              <button
                type="button"
                onClick={rotateLeft}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Rotate left"
              >
                ↶ Rotate left
              </button>
              <button
                type="button"
                onClick={rotateRight}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Rotate right"
              >
                Rotate right ↷
              </button>
              <button
                type="button"
                onClick={openCropModal}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Crop image"
              >
                Crop image
              </button>
              <button
                type="button"
                onClick={handleSharpen}
                disabled={savingSharpen}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                aria-label="Sharpen image"
              >
                {savingSharpen ? "…" : "Sharpen"}
              </button>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Click image to zoom</span>
            </div>
          </div>
        ) : doc.noteText !== undefined ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Note</span>
              <div className="inline-flex rounded-lg border border-zinc-300 dark:border-zinc-600 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setNotePreview(false)}
                  className={`px-3 py-1.5 ${!notePreview ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setNotePreview(true)}
                  className={`px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-600 ${notePreview ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
                >
                  Preview
                </button>
              </div>
            </div>
            {notePreview ? (
              <div
                className="px-5 py-4 min-h-[200px] prose prose-zinc dark:prose-invert max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: renderedNote }}
              />
            ) : (
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onBlur={saveNoteText}
                rows={12}
                className="w-full px-4 py-3 text-sm font-mono resize-y bg-transparent focus:outline-none min-h-[200px]"
              />
            )}
            {!notePreview && (
              <div className="px-4 py-1.5 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60">
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{savingNote ? "Saving…" : "Autosaved when you leave the field"}</p>
              </div>
            )}
          </div>
        ) : null}

        {cropModalOpen && cropImageUrl && (
          <div
            className="fixed inset-0 z-50 flex flex-col bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-label="Crop image"
          >
            <p className="text-sm text-zinc-400 px-4 pt-4 shrink-0">
              Drag the crop box to move; drag corners or edges to resize. Any ratio is fine.
            </p>
            <div className="relative w-full h-[70vh] min-h-[300px]">
              <Cropper
                key={cropImageUrl}
                ref={cropModalCropperRef}
                src={cropImageUrl}
                style={{ height: "100%", width: "100%" }}
                aspectRatio={NaN}
                guides={true}
                viewMode={1}
                dragMode="move"
                autoCropArea={0.8}
              />
            </div>
            <p className="text-xs text-zinc-500 px-4 py-1 shrink-0">
              If the crop area doesn’t appear, try re-importing (capture again and replace image).
            </p>
            <div className="p-4 border-t border-zinc-700 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCropModalOpen(false);
                  setCropImageUrl(null);
                }}
                className="rounded-xl border border-zinc-600 bg-zinc-800 text-white px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCropAndClose}
                disabled={savingCrop}
                className="flex-1 rounded-xl bg-white text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                  {savingCrop ? (
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
                    "Save cropped image"
                  )}
              </button>
            </div>
          </div>
        )}

        {lightboxOpen && (
          <div
            className="fixed inset-0 z-50 flex flex-col bg-black/90"
            role="dialog"
            aria-modal="true"
            aria-label="Image zoom"
          >
            <div className="flex items-center justify-between gap-4 p-3 border-b border-zinc-700">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Math.min(3, z - 0.25)))}
                  className="rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 text-sm font-medium"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-32 accent-white"
                  data-zoom-slider
                />
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Math.min(3, z + 0.25)))}
                  className="rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 text-sm font-medium"
                  aria-label="Zoom in"
                >
                  +
                </button>
                <span className="text-white text-sm tabular-nums w-12">{Math.round(zoom * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={rotateLeft}
                  className="rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 text-sm"
                  aria-label="Rotate left"
                >
                  ↶
                </button>
                <button
                  type="button"
                  onClick={rotateRight}
                  className="rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 text-sm"
                  aria-label="Rotate right"
                >
                  ↷
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
            <div
              className="flex-1 overflow-hidden flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={handleLightboxPointerDown}
              onPointerMove={handleLightboxPointerMove}
              onPointerUp={handleLightboxPointerUp}
              onPointerLeave={handleLightboxPointerUp}
            >
              <img
                src={`/api/documents/${doc.id}/image?t=${imageKey}`}
                alt="Document"
                className="max-w-full max-h-full object-contain select-none pointer-events-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                }}
                draggable={false}
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-500 mb-2">Tags</label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            AI-suggested; add or remove and they are saved automatically.
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-2.5 py-1 text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 p-0.5"
                  aria-label={`Remove tag ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              placeholder="Add tag…"
              className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm"
              aria-label="Add tag"
            />
            <button
              type="button"
              onClick={addTag}
              disabled={savingTags}
              className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={handleRetag}
              disabled={retagging}
              className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              title="Re-run AI to suggest tags again"
            >
              {retagging ? "Retagging…" : "Retag"}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-500 mb-1">Tax fields</label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Saved automatically when you change a value.</p>
          <div className="flex gap-2">
            <select
              value={taxCategory}
              onChange={(e) => {
                setTaxCategory(e.target.value);
                saveTaxFields(e.target.value, hsaFsaEligible);
              }}
              disabled={savingTaxFields}
              className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm disabled:opacity-50"
              aria-label="Tax category"
            >
              <option value="">Tax category…</option>
              <option value="medical">Tax: Medical</option>
              <option value="charity">Tax: Charity</option>
              <option value="tax_payment">Tax: Tax payment</option>
              <option value="mortgage_interest">Tax: Mortgage interest</option>
              <option value="business_expense">Tax: Business expense</option>
              <option value="personal">Tax: Personal</option>
              <option value="unknown">Tax: Unknown</option>
            </select>
            <select
              value={hsaFsaEligible}
              onChange={(e) => {
                setHsaFsaEligible(e.target.value);
                saveTaxFields(taxCategory, e.target.value);
              }}
              disabled={savingTaxFields}
              className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm disabled:opacity-50"
              aria-label="HSA/FSA eligible"
            >
              <option value="">HSA/FSA eligibility…</option>
              <option value="true">HSA/FSA eligible</option>
              <option value="false">Not eligible</option>
            </select>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-zinc-500">Extracted data</span>
            <button
              type="button"
              onClick={downloadJson}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
            >
              Download JSON
            </button>
          </div>
          <pre className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/80 p-5 text-sm overflow-auto max-h-[28rem] min-h-[12rem] font-mono leading-relaxed">
            <PrettyJson data={doc.extractedData} />
          </pre>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-500 mb-2">
            Extraction feedback
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            Describe what was wrong or how to identify similar docs. Saved notes are used when you Re-extract.
          </p>
          <textarea
            value={extractionNotes}
            onChange={(e) => setExtractionNotes(e.target.value)}
            onBlur={saveExtractionNotes}
            placeholder="e.g. This is a W-2; use tax year 2025. Title should be &quot;Tax form (W-2)&quot; for similar docs."
            rows={3}
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-3 text-sm resize-y"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={saveExtractionNotes}
              disabled={savingNotes}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              {savingNotes ? "Saving…" : "Save feedback"}
            </button>
            <button
              type="button"
              onClick={handleReExtract}
              disabled={reExtracting}
              className="rounded-lg bg-zinc-800 dark:bg-zinc-700 text-white px-3 py-2 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-600 disabled:opacity-50"
            >
              {reExtracting ? "Re-extracting…" : "Re-extract with feedback"}
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="w-full rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 py-3 font-medium hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete document"}
          </button>
        </div>
      </main>
    </div>
  );
}
