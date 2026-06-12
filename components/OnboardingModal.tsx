"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const STORAGE_KEY = "symport_onboarded";

export default function OnboardingModal() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  if (!show) return null;
  if (pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password")) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="bg-sky-600 px-6 py-8 text-white text-center">
          <p className="text-4xl mb-3">📄</p>
          <h1 className="text-2xl font-bold tracking-tight">Welcome to Symport</h1>
          <p className="mt-2 text-sky-100 text-sm">
            Your personal AI for documents, receipts, and medical records.
          </p>
        </div>

        <div className="px-6 py-5 space-y-3">
          <Feature icon="📸" title="Capture documents" body="Upload photos of receipts, EOBs, tax forms, or medical bills. The AI extracts the key details automatically." />
          <Feature icon="💬" title="Chat about your records" body="Ask questions across all your documents — totals, dates, HSA eligibility, anything." />
          <Feature icon="🗂️" title="Track HSA & tax expenses" body="Documents are automatically categorised for tax deductions and HSA/FSA reimbursement." />
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2">
          <Link
            href="/capture"
            onClick={dismiss}
            className="w-full rounded-xl bg-sky-600 text-white text-center py-3 text-sm font-semibold hover:bg-sky-700 transition-colors"
          >
            Upload your first document
          </Link>
          <Link
            href="/note"
            onClick={dismiss}
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 text-center py-3 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Write a note instead
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 pt-1"
          >
            Skip for now — I&apos;ll explore on my own
          </button>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{body}</p>
      </div>
    </div>
  );
}
