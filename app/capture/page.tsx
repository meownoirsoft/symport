"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Cropper, { type ReactCropperElement } from "react-cropper";
import "react-cropper/node_modules/cropperjs/dist/cropper.css";

export default function CapturePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<ReactCropperElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(URL.createObjectURL(file));
    setSelectedFile(file);
    e.target.value = "";
  }

  function cancelCrop() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setSelectedFile(null);
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
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }
      const data = (await res.json()) as { id: string };
      cancelCrop();
      router.push(`/documents/${data.id}`);
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
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
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />

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
              <button
                type="button"
                onClick={cancelCrop}
                className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadCropped}
                disabled={uploading}
                className="flex-1 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
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
                    Processing…
                  </>
                ) : (
                  "Upload cropped image"
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
              Tip: Hold steady and use good lighting for clearer text.
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="w-full rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 py-16 px-6 text-zinc-600 dark:text-zinc-400 font-medium hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-4"
            >
              {uploading ? (
              <>
                <svg
                  className="animate-spin h-10 w-10 text-zinc-500 dark:text-zinc-400"
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
                <span>Processing…</span>
              </>
            ) : (
              "Take photo or choose image"
            )}
            </button>
          </>
        )}
        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        )}
      </main>
    </div>
  );
}
