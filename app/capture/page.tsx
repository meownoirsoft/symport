"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Cropper, { type ReactCropperElement } from "react-cropper";
import "react-cropper/node_modules/cropperjs/dist/cropper.css";

export default function CapturePage() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<ReactCropperElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(URL.createObjectURL(file));
    setSelectedFile(file);
    e.target.value = "";
  }

  async function handlePdfSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError(null);
    await uploadFile(file);
  }

  function cancelCrop() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setSelectedFile(null);
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/documents/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
      const data = (await res.json()) as { id: string; extracting?: boolean };
      // Fire AI extraction in the background without blocking the redirect.
      // The document page will show "Processing..." until extraction completes.
      if (data.extracting) {
        fetch(`/api/documents/${data.id}/re-extract`, { method: "POST" }).catch(() => {});
      }
      router.push(`/documents/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadCropped() {
    const cropper = cropperRef.current?.cropper;
    if (!cropper || !selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const canvas = cropper.getCroppedCanvas();
      if (!canvas) throw new Error("Crop failed");
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.95);
      });
      if (!blob) throw new Error("Crop failed");
      const file = new File([blob], selectedFile.name ?? "document.jpg", { type: "image/jpeg" });
      cancelCrop();
      await uploadFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className={`mx-auto px-4 py-4 flex items-center gap-4 ${imageSrc ? "max-w-4xl" : "max-w-lg"}`}>
        <Link href="/" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold">Capture</h1>
      </header>

      <main className={`mx-auto py-6 flex flex-col gap-6 ${imageSrc ? "max-w-4xl px-2 sm:px-4" : "max-w-lg px-4"}`}>
        {/* Hidden file inputs */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} disabled={uploading} aria-label="Take photo" />
        <input ref={libraryInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} disabled={uploading} aria-label="Choose image from library" />
        <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfSelect} disabled={uploading} aria-label="Choose PDF" />

        {imageSrc ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Drag the crop box to move it; drag corners or edges to resize. Any ratio is fine.
            </p>
            <div className="relative h-[75vh] w-full rounded-xl overflow-hidden bg-zinc-900">
              <Cropper
                ref={cropperRef}
                src={imageSrc}
                style={{ height: "100%", width: "100%" }}
                aspectRatio={NaN}
                guides={true}
                viewMode={1}
                dragMode="move"
                autoCropArea={0.8}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={cancelCrop} className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadCropped}
                disabled={uploading}
                className="flex-1 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? <Spinner /> : "Upload cropped image"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
              Tip: Hold steady and use good lighting for clearer text.
            </p>
            {uploading ? (
              <div className="w-full rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 py-16 px-6 flex flex-col items-center justify-center gap-4 text-zinc-500 dark:text-zinc-400">
                <Spinner size={10} />
                <span>Processing…</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 rounded-2xl border-2 border-zinc-300 dark:border-zinc-600 py-12 px-6 text-zinc-700 dark:text-zinc-300 font-medium hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-3"
                >
                  <svg className="w-12 h-12 text-zinc-500 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Take photo
                </button>
                <button
                  type="button"
                  onClick={() => libraryInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 py-12 px-6 text-zinc-600 dark:text-zinc-400 font-medium hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-3"
                >
                  <svg className="w-12 h-12 text-zinc-500 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose image
                </button>
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 py-12 px-6 text-zinc-600 dark:text-zinc-400 font-medium hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-3"
                >
                  <svg className="w-12 h-12 text-zinc-500 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6M9 17h4" />
                  </svg>
                  Upload PDF
                </button>
              </div>
            )}
          </>
        )}
        {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
      </main>
    </div>
  );
}

function Spinner({ size = 5 }: { size?: number }) {
  return (
    <svg className={`animate-spin h-${size} w-${size}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
