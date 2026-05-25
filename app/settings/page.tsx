import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-16">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-4">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Manage categories, personas, and preferences.
        </p>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">
        <ul className="space-y-2">
          <li>
            <Link
              href="/settings/categories"
              className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <span className="font-medium">Categories</span>
              <span className="text-zinc-400">→</span>
            </Link>
          </li>
        </ul>
      </main>
    </div>
  );
}
