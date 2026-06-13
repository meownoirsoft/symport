"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Provider = "openrouter" | "openai" | "anthropic";

const PROVIDERS: { id: Provider; label: string; hint: string; placeholder: string }[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    hint: "One key for every model (Claude, GPT-4, Gemini, and more). Get a key at openrouter.ai.",
    placeholder: "sk-or-v1-...",
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "Used directly for GPT-4o and GPT-4 Turbo personas. Get a key at platform.openai.com.",
    placeholder: "sk-...",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    hint: "Used directly for Claude personas. Get a key at console.anthropic.com.",
    placeholder: "sk-ant-...",
  },
];

export default function ApiKeysPage() {
  const [connected, setConnected] = useState<Record<Provider, boolean>>({
    openrouter: false,
    openai: false,
    anthropic: false,
  });
  const [inputs, setInputs] = useState<Record<Provider, string>>({
    openrouter: "",
    openai: "",
    anthropic: "",
  });
  const [saving, setSaving] = useState<Provider | null>(null);
  const [removing, setRemoving] = useState<Provider | null>(null);
  const [message, setMessage] = useState<{ provider: Provider; text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/settings/api-keys")
      .then((r) => r.json())
      .then((data) => setConnected(data))
      .catch(() => {});
  }, []);

  async function save(provider: Provider) {
    const key = inputs[provider].trim();
    if (!key) return;
    setSaving(provider);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key }),
      });
      if (res.ok) {
        setConnected((prev) => ({ ...prev, [provider]: true }));
        setInputs((prev) => ({ ...prev, [provider]: "" }));
        setMessage({ provider, text: "Key saved.", ok: true });
      } else {
        setMessage({ provider, text: "Failed to save key.", ok: false });
      }
    } finally {
      setSaving(null);
    }
  }

  async function remove(provider: Provider) {
    setRemoving(provider);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) {
        setConnected((prev) => ({ ...prev, [provider]: false }));
        setMessage({ provider, text: "Key removed.", ok: true });
      } else {
        setMessage({ provider, text: "Failed to remove key.", ok: false });
      }
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-16">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/settings" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm">
            Settings
          </Link>
          <span className="text-zinc-400">/</span>
          <span className="text-sm font-medium">API Keys</span>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Your keys are encrypted and used to power AI conversations at your own cost.
        </p>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {PROVIDERS.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{p.label}</span>
              {connected[p.id] ? (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                  Connected
                </span>
              ) : (
                <span className="text-xs text-zinc-400">Not set</span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{p.hint}</p>
            <div className="flex gap-2">
              <input
                type="password"
                value={inputs[p.id]}
                onChange={(e) => setInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                placeholder={p.placeholder}
                className="flex-1 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === "Enter" && save(p.id)}
              />
              <button
                onClick={() => save(p.id)}
                disabled={!inputs[p.id].trim() || saving === p.id}
                className="text-sm px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving === p.id ? "Saving..." : "Save"}
              </button>
              {connected[p.id] && (
                <button
                  onClick={() => remove(p.id)}
                  disabled={removing === p.id}
                  className="text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-600 hover:border-red-300 disabled:opacity-40"
                >
                  {removing === p.id ? "..." : "Remove"}
                </button>
              )}
            </div>
            {message?.provider === p.id && (
              <p className={`text-xs ${message.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                {message.text}
              </p>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
