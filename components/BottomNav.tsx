"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function ChatIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TaxIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}

function HsaIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M12 15v-2M10 14h4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}


export default function BottomNav() {
  const pathname = usePathname();
  const [hsaPending, setHsaPending] = useState(0);
  const [taxUnclaimed, setTaxUnclaimed] = useState(0);

  useEffect(() => {
    fetch("/api/documents/action-counts")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setHsaPending(data.hsaPending ?? 0);
          setTaxUnclaimed(data.taxUnclaimed ?? 0);
        }
      })
      .catch(() => {});
  }, [pathname]);

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return null;
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const tabs = [
    { href: "/chat", label: "Chat", icon: ChatIcon, count: 0 },
    { href: "/hsa", label: "HSA/FSA", icon: HsaIcon, count: hsaPending },
    { href: "/tax", label: "Tax", icon: TaxIcon, count: taxUnclaimed },
    { href: "/settings", label: "Settings", icon: SettingsIcon, count: 0 },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur safe-area-pb">
      <div className="max-w-2xl mx-auto flex items-center justify-around h-14">
        {tabs.map(({ href, label, icon: Icon, count }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-sm font-medium transition-colors ${
              isActive(href)
                ? "text-sky-600 dark:text-sky-400"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Icon />
            <span className="flex items-baseline gap-0.5">
              {label}
              {count > 0 && (
                <span className="text-[11px] font-normal">({count})</span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
