import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <main className="max-w-lg mx-auto px-4 py-12 flex flex-col gap-8">
        <h1 className="text-2xl font-semibold tracking-tight">Symport</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Capture paper. Extract data. Search and export.
        </p>
        <nav className="flex flex-col gap-3">
          <Link
            href="/capture"
            className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-4 px-6 font-medium"
          >
            Capture document
          </Link>
          <Link
            href="/documents"
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 py-4 px-6 font-medium"
          >
            View documents
          </Link>
        </nav>
      </main>
    </div>
  );
}
