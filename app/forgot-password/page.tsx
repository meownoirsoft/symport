"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-8 shadow-sm">
        <h1 className="text-xl font-semibold mb-1 text-zinc-900 dark:text-zinc-50">
          Forgot password
        </h1>

        {done ? (
          <div className="mt-2 space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              If that email is registered, you'll receive a reset link shortly.
              Check your inbox (and spam folder).
            </p>
            <Link
              href="/login"
              className="block text-center w-full rounded-lg bg-sky-600 text-white py-2.5 text-sm font-medium"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-sky-600 text-white py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                <Link href="/login" className="underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
