"use client";

import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { timeAgo } from "@/lib/time-ago";

type Persona = {
  id: string;
  name: string;
  displayName: string;
  costTier: string;
  provider?: string | null;
  modelString?: string | null;
  avatarUrl?: string | null;
  description?: string | null;
};
type Conversation = {
  id: string;
  title: string | null;
  updatedAt: string;
  _count: { messages: number };
  contexts: { contextId: string }[];
  parentConversation?: { id: string; title: string | null } | null;
};
type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  persona?: { name: string; displayName: string } | null;
};
type Category = { name: string; count: number };
type BranchCard = {
  id: string;
  sourceConversationId: string;
  sourceMessageId: string | null;
  triggerText: string | null;
  conversationId: string | null;
  status: string;
  createdAt: string;
  sourceMessage?: { id: string; content: string; role: string } | null;
};

const CONTEXT_COLORS: Record<string, { chip: string; rgb: string }> = {
  Medical:   { chip: "bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-900/60 dark:text-sky-200 dark:hover:bg-sky-800",         rgb: "14,165,233" },
  Tax:       { chip: "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200 dark:hover:bg-amber-800", rgb: "245,158,11" },
  "HSA/FSA": { chip: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-200 dark:hover:bg-emerald-800", rgb: "16,185,129" },
  Insurance: { chip: "bg-violet-100 text-violet-800 hover:bg-violet-200 dark:bg-violet-900/60 dark:text-violet-200 dark:hover:bg-violet-800", rgb: "139,92,246" },
};
const DEFAULT_CHIP_CLASS = "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600";

function contextBarStyle(contextIds: string[]): React.CSSProperties {
  if (contextIds.length === 0) return {};
  const rgbs = contextIds.map((id) => CONTEXT_COLORS[id]?.rgb ?? "161,161,170");
  if (rgbs.length === 1) return { backgroundColor: `rgba(${rgbs[0]},0.09)` };
  return { background: `linear-gradient(to right, rgba(${rgbs[0]},0.13), rgba(${rgbs[rgbs.length - 1]},0.13))` };
}

const CONTEXT_PROMPTS: Record<string, string[]> = {
  Medical: [
    "What were my total medical expenses this year?",
    "Which of my expenses are HSA or FSA eligible?",
    "Summarize my recent doctor and pharmacy visits.",
    "Do I have any unpaid medical bills?",
  ],
  Tax: [
    "What deductions do I have available this tax year?",
    "Summarize my charitable donations.",
    "What business expenses can I claim?",
    "Am I missing any common deductions?",
  ],
  "HSA/FSA": [
    "What's my total HSA-eligible spending so far?",
    "Which expenses are still pending reimbursement?",
    "Show me my HSA spending by category.",
    "What can I still submit for reimbursement?",
  ],
  Insurance: [
    "What claims have I filed recently?",
    "What's my out-of-pocket spending after insurance?",
    "Which providers have I visited this year?",
    "Are there any claims I should follow up on?",
  ],
  Other: [
    "Summarize the documents in this context.",
    "What patterns do you notice in my documents?",
    "Are there any important dates or deadlines I should know about?",
  ],
};

const GENERIC_PROMPTS = [
  "What's in my documents?",
  "Summarize what you know about my situation.",
  "Are there any important items I should follow up on?",
  "What patterns do you notice across my documents?",
];

function getSuggestedPrompts(contextLabels: string[]): string[] {
  const seen = new Set<string>();
  const prompts: string[] = [];
  for (const label of contextLabels) {
    const candidates = CONTEXT_PROMPTS[label] ?? GENERIC_PROMPTS;
    for (const p of candidates) {
      if (!seen.has(p)) { seen.add(p); prompts.push(p); }
      if (prompts.length >= 4) return prompts;
    }
  }
  for (const p of GENERIC_PROMPTS) {
    if (!seen.has(p)) { seen.add(p); prompts.push(p); }
    if (prompts.length >= 4) return prompts;
  }
  return prompts;
}

const PERSONA_AVATAR: Record<string, string> = {
  Quest: "🧭",
  Tina: "📝",
  Spark: "⚡",
  Prism: "💎",
  Sage: "🧠",
  Titan: "🗻",
  Ember: "🔥",
  Gem: "🔍",
  Gale: "🌬️",
  Verse: "✒️",
  Nova: "✨",
  Aurora: "🌈",
  Dash: "🚀",
  Opal: "🕊️",
};

function friendlyCostTier(tier: string): string {
  switch (tier) {
    case "cheap":
      return "Budget";
    case "mid":
      return "Standard";
    case "expensive":
      return "Premium";
    default:
      return tier;
  }
}

function simpleModelName(modelString: string): string {
  const last = modelString.split("/").pop() ?? modelString;
  return last.replace(/[-_]/g, " ");
}

function personaAvatarSrc(p: Persona): string {
  // Use a local 100x100 asset with lowercased name, e.g. prism100.png
  return `/avatars/${p.name.toLowerCase()}100.png`;
}

function sortPersonasForDisplay(list: Persona[]): Persona[] {
  const weight = (tier: string): number => {
    switch (tier) {
      case "cheap":
        return 0; // Budget
      case "mid":
        return 1; // Standard
      case "expensive":
        return 2; // Premium
      default:
        return 3;
    }
  };
  return [...list].sort((a, b) => {
    const wa = weight(a.costTier);
    const wb = weight(b.costTier);
    if (wa !== wb) return wa - wb;
    const an = a.displayName || a.name;
    const bn = b.displayName || b.name;
    return an.localeCompare(bn);
  });
}

export default function ChatPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<{
    id: string;
    title: string | null;
    messages: Message[];
    contexts: { contextId: string }[];
  } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [input, setInput] = useState("");
  const [personaId, setPersonaId] = useState<string>("");
  const [chatYear, setChatYear] = useState<string>("all");
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContextIds, setNewContextIds] = useState<Set<string>>(new Set());
  const [pickerContextIds, setPickerContextIds] = useState<Set<string>>(new Set());
  const [patchingContexts, setPatchingContexts] = useState(false);
  const [branchCards, setBranchCards] = useState<BranchCard[]>([]);
  const [branchDrawerOpen, setBranchDrawerOpen] = useState(false);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ bottom: number; right: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const personaSelectRef = useRef<HTMLSelectElement | null>(null);

  const [selectionMenu, setSelectionMenu] = useState<{
    messageId: string;
    role: string;
    text: string;
    bottom: number;
    right: number;
  } | null>(null);
  const [openingCardId, setOpeningCardId] = useState<string | null>(null);
  const [dismissingCardId, setDismissingCardId] = useState<string | null>(null);
  const [wiskrCaptureMessage, setWiskrCaptureMessage] = useState<{ id: string; content: string } | null>(null);
  const [wiskrCaptureContextId, setWiskrCaptureContextId] = useState<string>("");
  const [capturing, setCapturing] = useState(false);
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [showConversationsPanel, setShowConversationsPanel] = useState(false);
  const [showSymportPanel, setShowSymportPanel] = useState(false);
  const [symportCategory, setSymportCategory] = useState<string>("");
  const [symportDocs, setSymportDocs] = useState<
    { id: string; extractedData: Record<string, unknown>; createdAt: string }[]
  >([]);
  const [symportLoading, setSymportLoading] = useState(false);
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [contextPreviewText, setContextPreviewText] = useState<string>("");
  const [contextPreviewLoading, setContextPreviewLoading] = useState(false);
  const [contextPreviewError, setContextPreviewError] = useState<string | null>(null);
  const [branchDrawerMode, setBranchDrawerMode] = useState<"chats" | "branches" | "queue">("chats");
  const [panelSearch, setPanelSearch] = useState("");
  const [savedPrompts, setSavedPrompts] = useState<{ id: string; content: string; sourceConversation: { id: string; title: string | null } | null; createdAt: string }[]>([]);
  const [contextChangedSuggestNewConversation, setContextChangedSuggestNewConversation] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  /** True when at least one previously selected context was removed (not when only adding). */
  const contextSetHadRemoval = useCallback(
    (prev: { contextId: string }[], next: { contextId: string }[]) => {
      const nextSet = new Set(next.map((c) => c.contextId));
      return prev.some((c) => !nextSet.has(c.contextId));
    },
    []
  );

  const loadPersonas = useCallback(async () => {
    const res = await fetch("/api/wiskr/personas");
    if (res.ok) {
      const raw = (await res.json()) as Persona[];
      const data = sortPersonasForDisplay(raw);
      setPersonas(data);
      if (data.length && !personaId) {
        setPersonaId(data.find((p) => p.name === "Prism")?.id ?? data[0].id);
      }
    }
  }, [personaId]);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/wiskr/conversations");
    if (!res.ok) return;
    const data = (await res.json()) as Conversation[];
    setConversations(data);

    if (typeof window !== "undefined") {
      const storedId = window.localStorage.getItem("wiskr:selectedConversation");
      if (storedId && data.some((c) => c.id === storedId)) {
        setSelectedId((prev) => prev ?? storedId);
        return;
      }
    }
    setSelectedId((prev) => (prev ?? (data[0]?.id ?? null)));
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
      setDeletingConversationId(id);
      try {
        const res = await fetch(`/api/wiskr/conversations/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          await loadConversations();
          setConversation((prev) => (prev && prev.id === id ? null : prev));
          if (selectedId === id) {
            setSelectedId(null);
          }
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err?.error ?? "Failed to delete conversation");
        }
      } finally {
        setDeletingConversationId(null);
      }
    },
    [loadConversations, selectedId]
  );
  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/documents/categories");
    if (res.ok) setCategories((await res.json()).categories ?? []);
  }, []);

  const loadBranchCards = useCallback(async () => {
    if (!selectedId) {
      setBranchCards([]);
      return;
    }
    const res = await fetch(`/api/wiskr/branch-cards?conversationId=${selectedId}&status=pending`);
    if (res.ok) setBranchCards(await res.json());
  }, [selectedId]);

  const loadSavedPrompts = useCallback(async () => {
    const res = await fetch("/api/saved-prompts");
    if (res.ok) setSavedPrompts(await res.json());
  }, []);

  const savePromptToQueue = async (content: string) => {
    try {
      const res = await fetch("/api/saved-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, sourceConversationId: selectedId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setToast("Failed to save prompt: " + (err.error ?? res.status));
        setTimeout(() => setToast(null), 4000);
        return;
      }
      await loadSavedPrompts();
      setPanelSearch("");
      setBranchDrawerMode("queue");
      setBranchDrawerOpen(true);
      setToast("Saved to prompt queue.");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setToast("Failed to save prompt: " + (e instanceof Error ? e.message : "network error"));
      setTimeout(() => setToast(null), 4000);
    }
  };

  const deleteSavedPrompt = async (id: string) => {
    setSavedPrompts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/saved-prompts/${id}`, { method: "DELETE" });
  };

  useEffect(() => {
    loadPersonas();
    loadConversations();
    loadCategories();
    loadSavedPrompts();
  }, [loadPersonas, loadConversations, loadCategories, loadSavedPrompts]);

  // Persist selected conversation so it survives navigation away and back.
  useEffect(() => {
    if (!selectedId) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("wiskr:selectedConversation", selectedId);
    } catch {
      // ignore storage errors
    }
  }, [selectedId]);

  useEffect(() => {
    loadBranchCards();
  }, [loadBranchCards]);

  useLayoutEffect(() => {
    if (!messageMenuId || !menuTriggerRef.current) {
      setMenuPosition(null);
      return;
    }
    const rect = menuTriggerRef.current.getBoundingClientRect();
    setMenuPosition({
      bottom: window.innerHeight - rect.top + 4,
      right: window.innerWidth - rect.right,
    });
  }, [messageMenuId]);

  useEffect(() => {
    if (conversation?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages?.length]);

  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text || !selectedId) {
        setSelectionMenu(null);
        return;
      }
      const node = sel?.anchorNode;
      const el = node instanceof Element ? node : node?.parentElement;
      const messageEl = el?.closest?.("[data-message-id]");
      if (!messageEl || !(messageEl instanceof HTMLElement)) {
        setSelectionMenu(null);
        return;
      }
      const messageId = messageEl.getAttribute("data-message-id");
      const role = messageEl.getAttribute("data-message-role") || "user";
      if (!messageId) {
        setSelectionMenu(null);
        return;
      }
      const range = sel?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if (!rect) {
        setSelectionMenu(null);
        return;
      }
      setMessageMenuId(null);
      setSelectionMenu({
        messageId,
        role,
        text,
        bottom: window.innerHeight - rect.top + 4,
        right: window.innerWidth - rect.right,
      });
    };
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [selectedId]);

  // Load Symport documents for the selected category when the Symport panel is open.
  useEffect(() => {
    if (!showSymportPanel) return;
    const category = symportCategory || conversation?.contexts?.[0]?.contextId || categories[0]?.name || "";
    if (!category) {
      setSymportDocs([]);
      return;
    }
    setSymportCategory(category);
    setSymportLoading(true);
    (async () => {
      const res = await fetch(`/api/documents?category=${encodeURIComponent(category)}`);
      if (!res.ok) {
        setSymportDocs([]);
      } else {
        const data = (await res.json()) as {
          id: string;
          extractedData: Record<string, unknown>;
          createdAt: string;
        }[];
        setSymportDocs(data);
      }
      setSymportLoading(false);
    })();
  }, [showSymportPanel, symportCategory, conversation?.contexts, categories]);

  useEffect(() => {
    if (!selectedId) {
      setConversation(null);
      setContextChangedSuggestNewConversation(false);
      return;
    }
    setContextChangedSuggestNewConversation(false);
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/wiskr/conversations/${selectedId}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setConversation(data);
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  const createConversation = () => {
    setNewTitle("");
    setNewContextIds(new Set());
    setShowNewModal(true);
  };

  const submitNewConversation = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/wiskr/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim() || "New conversation",
          contextIds: Array.from(newContextIds),
        }),
      });
      if (res.ok) {
        const conv = await res.json();
        await loadConversations();
        setSelectedId(conv.id);
        setShowNewModal(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const openContextPicker = () => {
    setPickerContextIds(new Set(conversation?.contexts.map((c) => c.contextId) ?? []));
    setShowContextPicker(true);
  };

  const saveContextPicker = async () => {
    if (!selectedId) return;
    setPatchingContexts(true);
    try {
      const res = await fetch(`/api/wiskr/conversations/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextIds: Array.from(pickerContextIds) }),
      });
      if (res.ok) {
        const updated = await res.json();
        const prevContexts = conversation?.contexts ?? [];
        setConversation((prev) => (prev ? { ...prev, contexts: updated.contexts } : null));
        setShowContextPicker(false);
        if (
          conversation &&
          conversation.messages.length > 0 &&
          contextSetHadRemoval(prevContexts, updated.contexts)
        ) {
          setContextChangedSuggestNewConversation(true);
        }
      }
    } finally {
      setPatchingContexts(false);
    }
  };

  const removeContext = async (contextId: string) => {
    if (!conversation) return;
    const next = conversation.contexts.filter((c) => c.contextId !== contextId).map((c) => c.contextId);
    setPatchingContexts(true);
    try {
      const res = await fetch(`/api/wiskr/conversations/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextIds: next }),
      });
      if (res.ok) {
        const updated = await res.json();
        const prevContexts = conversation?.contexts ?? [];
        setConversation((prev) => (prev ? { ...prev, contexts: updated.contexts } : null));
        if (
          conversation &&
          conversation.messages.length > 0 &&
          contextSetHadRemoval(prevContexts, updated.contexts)
        ) {
          setContextChangedSuggestNewConversation(true);
        }
      }
    } finally {
      setPatchingContexts(false);
    }
  };

  const startNewConversationFromContextChange = async () => {
    if (!conversation) return;
    setCreating(true);
    try {
      const res = await fetch("/api/wiskr/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New conversation",
          contextIds: conversation.contexts.map((c) => c.contextId),
        }),
      });
      if (res.ok) {
        const conv = await res.json();
        await loadConversations();
        setSelectedId(conv.id);
        setContextChangedSuggestNewConversation(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const toggleContext = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const followUpLater = async (messageId: string, content: string) => {
    setMessageMenuId(null);
    if (!selectedId) return;
    try {
      const res = await fetch("/api/wiskr/branch-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedId,
          messageId,
          triggerText: content.slice(0, 200) || null,
        }),
      });
      if (res.ok) {
        await loadBranchCards();
      }
    } catch {
      // ignore
    }
  };

  const openBranchAsConversation = async (card: BranchCard) => {
    setOpeningCardId(card.id);
    try {
      const title = (card.triggerText || card.sourceMessage?.content || "Follow-up").slice(0, 80);
      const res = await fetch("/api/wiskr/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Follow-up",
          parentConversationId: card.sourceConversationId,
        }),
      });
      if (!res.ok) return;
      const conv = await res.json();
      await fetch(`/api/wiskr/branch-cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conv.id, status: "active" }),
      });
      await loadConversations();
      await loadBranchCards();
      setSelectedId(conv.id);
      setBranchDrawerOpen(false);
    } finally {
      setOpeningCardId(null);
    }
  };

  const dismissBranchCard = async (cardId: string) => {
    setDismissingCardId(cardId);
    try {
      await fetch(`/api/wiskr/branch-cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
      await loadBranchCards();
    } finally {
      setDismissingCardId(null);
    }
  };

  const openWiskrCapture = (messageId: string, content: string) => {
    setMessageMenuId(null);
    setWiskrCaptureMessage({ id: messageId, content });
    const defaultContext =
      conversation?.contexts?.[0]?.contextId ?? categories[0]?.name ?? "";
    setWiskrCaptureContextId(defaultContext);
  };

  const submitWiskrCapture = async () => {
    if (!wiskrCaptureMessage) return;
    setCapturing(true);
    try {
      const res = await fetch("/api/wiskr/captured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: wiskrCaptureMessage.id,
          content: wiskrCaptureMessage.content,
          addedToContextId: wiskrCaptureContextId || null,
        }),
      });
      if (res.ok) {
        setWiskrCaptureMessage(null);
        setToast("Saved to Symport — it's now searchable in your documents.");
        setTimeout(() => setToast(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err?.error ?? "Failed to capture");
      }
    } finally {
      setCapturing(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    let convId = selectedId;
    if (!convId) {
      try {
        const res = await fetch("/api/wiskr/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New conversation", contextIds: [] }),
        });
        if (!res.ok) {
          setInput(text);
          setSending(false);
          return;
        }
        const conv = await res.json();
        convId = conv.id;
        setSelectedId(conv.id);
        loadConversations();
      } catch {
        setInput(text);
        setSending(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/wiskr/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          personaId: personaId || undefined,
          taxYear: chatYear !== "all" ? chatYear : undefined,
        }),
      });
      if (res.ok) {
        const { assistantMessage, generatedTitle } = await res.json();
        const userMsg = { id: `user-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() };
        setConversation((prev) =>
          prev
            ? {
                ...prev,
                title: generatedTitle ?? prev.title,
                messages: [...prev.messages, userMsg, assistantMessage],
              }
            : { id: convId!, title: generatedTitle ?? "New conversation", messages: [userMsg, assistantMessage], contexts: [] }
        );
        if (generatedTitle) {
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, title: generatedTitle } : c))
          );
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setInput(text);
        if (res.status === 402 || err?.error === "NO_API_KEY") {
          alert("To start chatting, add an API key in Settings → API Keys.");
          window.location.href = "/settings/api-keys";
        } else {
          alert(err?.error ?? "Failed to send");
        }
      }
    } finally {
      setSending(false);
    }
  };

  const openContextPreview = async () => {
    if (!selectedId) return;
    setContextPreviewLoading(true);
    setContextPreviewError(null);
    setShowContextPreview(true);
    try {
      const res = await fetch(`/api/wiskr/conversations/${selectedId}/context-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: input,
          personaId: personaId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setContextPreviewError(err?.error ?? "Failed to load context preview.");
        setContextPreviewText("");
        return;
      }
      const data = await res.json();
      setContextPreviewText(typeof data.contextPackage === "string" ? data.contextPackage : "");
    } catch {
      setContextPreviewError("Failed to load context preview.");
      setContextPreviewText("");
    } finally {
      setContextPreviewLoading(false);
    }
  };

  const currentPersona =
    personas.find((p) => p.id === personaId) ?? (personas.length ? personas[0] : null);

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex flex-col max-w-2xl mx-auto">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
        {/* Left: chevron + Symport label */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSymportPanel(true)}
            className="text-3xl px-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            title="Open Symport context"
          >
            «
          </button>
          <button
            type="button"
            onClick={() => setShowSymportPanel(true)}
            className="text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Symport
          </button>
        </div>

        {/* Center: conversation title + rename */}
        <div className="flex items-center justify-center min-w-0">
          {conversation ? (
            <div className="flex items-center gap-2 max-w-xs">
              {renamingTitle ? (
                <>
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-sm w-44 sm:w-64"
                  />
                  <div className="flex items-center gap-0">
                    <button
                      type="button"
                      className="text-xl px-1.5 py-0.5 text-sky-600 dark:text-sky-400"
                      onClick={async () => {
                        if (!selectedId) return;
                        const nextTitle = titleDraft.trim() || "Untitled";
                        await fetch(`/api/wiskr/conversations/${selectedId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: nextTitle }),
                        }).then(async (res) => {
                          if (res.ok) {
                            setConversation((prev) =>
                              prev ? { ...prev, title: nextTitle } : prev
                            );
                            setConversations((prev) =>
                              prev.map((c) =>
                                c.id === selectedId ? { ...c, title: nextTitle } : c
                              )
                            );
                          }
                        });
                        setRenamingTitle(false);
                      }}
                      aria-label="Save title"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="text-xl px-1.5 py-0.5 text-zinc-500 dark:text-zinc-400"
                      onClick={() => setRenamingTitle(false)}
                      aria-label="Cancel rename"
                    >
                      ✕
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="font-medium truncate max-w-[160px]">
                    {conversation.title || "Untitled"}
                  </span>
                  <button
                    type="button"
                    className="text-3xl px-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    onClick={() => {
                      setTitleDraft(conversation.title || "");
                      setRenamingTitle(true);
                    }}
                    title="Rename conversation"
                  >
                    ✎
                  </button>
                </>
              )}
            </div>
          ) : (
            <span className="font-medium">Chat (Wiskr)</span>
          )}
        </div>

        {/* Right: Panel button */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setBranchDrawerOpen((o) => !o)}
            className="flex items-center gap-1 text-sm font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            title="Conversations, branches & prompt queue"
          >
            Panel <span className="opacity-60">›</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 flex flex-col min-h-0">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center p-6 text-zinc-400 text-sm">
              Type a message below to start a new chat.
            </div>
          ) : (
            <>
              {/* Top bar: context chips (tap to remove) + add/edit */}
              <div
                className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-1.5 transition-colors duration-300"
                style={contextBarStyle((conversation?.contexts ?? []).map((c) => c.contextId))}
              >
                {conversation?.contexts.map((c) => (
                  <button
                    key={c.contextId}
                    type="button"
                    onClick={() => removeContext(c.contextId)}
                    className={`text-xs rounded-full px-2.5 py-1 font-medium transition-colors ${CONTEXT_COLORS[c.contextId]?.chip ?? DEFAULT_CHIP_CLASS}`}
                    title="Remove context"
                  >
                    {c.contextId} ×
                  </button>
                ))}
                <button
                  type="button"
                  onClick={openContextPicker}
                  className="text-xs rounded-full border border-dashed border-zinc-400 dark:border-zinc-500 px-2 py-0.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  title="Add or edit contexts"
                >
                  + Contexts
                </button>
                <Link
                  href="/settings/categories"
                  className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                  title="Manage categories"
                >
                  Manage
                </Link>
                <select
                  value={chatYear}
                  onChange={(e) => setChatYear(e.target.value)}
                  className="ml-auto text-xs rounded-full border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 focus:outline-none"
                  title="Filter context by year"
                >
                  <option value="all">All years</option>
                  {Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => String(new Date().getFullYear() - i)).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              {contextChangedSuggestNewConversation && conversation && conversation.messages.length > 0 && (
                <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-amber-800 dark:text-amber-200">
                    You changed contexts. Starting a new conversation keeps things tidy.
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={startNewConversationFromContextChange}
                      disabled={creating}
                      className="rounded-lg bg-sky-600 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      {creating ? "…" : "Start new conversation"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setContextChangedSuggestNewConversation(false)}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Keep editing
                    </button>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950">
                {conversation && conversation.messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-6 py-8 text-center">
                    {conversation.contexts.length === 0 ? (
                      <div className="max-w-xs">
                        <p className="text-zinc-500 dark:text-zinc-400 text-base mb-2">No contexts selected.</p>
                        <p className="text-zinc-400 dark:text-zinc-500 text-sm">Add a context above so the AI can reference your documents.</p>
                      </div>
                    ) : (
                      <div className="max-w-sm w-full">
                        <p className="text-zinc-400 dark:text-zinc-500 text-sm mb-4">Try asking…</p>
                        <div className="flex flex-col gap-2">
                          {getSuggestedPrompts(conversation.contexts.map((c) => c.contextId)).map((prompt) => (
                            <button
                              key={prompt}
                              type="button"
                              onClick={() => setInput(prompt)}
                              className="text-left rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-sky-300 dark:hover:border-sky-700 transition-colors"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {conversation?.messages.map((m) => {
                  const isUser = m.role === "user";
                  const timeLabel = timeAgo(m.createdAt);
                  return (
                    <div
                      key={m.id}
                      className={`flex items-start gap-1 w-full ${isUser ? "flex-row-reverse ml-auto max-w-[90%]" : "max-w-[90%]"}`}
                    >
                      <div
                        className={`rounded-xl px-4 py-3 max-w-[92%] relative group ${
                          isUser
                            ? "bg-sky-600 text-white"
                            : "bg-zinc-200 dark:bg-zinc-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {m.role === "assistant" && m.persona && (
                              <div className="text-xs opacity-80 mb-1">{m.persona.displayName}</div>
                            )}
                            <div
                              className="whitespace-pre-wrap select-text"
                              data-message-id={m.id}
                              data-message-role={m.role}
                            >
                              {m.content}
                            </div>
                          </div>
                          <div className="shrink-0">
                            <button
                              ref={messageMenuId === m.id ? menuTriggerRef : undefined}
                              type="button"
                              onClick={() => {
                                setSelectionMenu(null);
                                setMessageMenuId(messageMenuId === m.id ? null : m.id);
                              }}
                              className="p-1 rounded opacity-70 hover:opacity-100"
                              aria-label="Message actions"
                            >
                              ⋯
                            </button>
                          </div>
                        </div>
                      </div>
                      <span
                        className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap pt-2"
                        title={new Date(m.createdAt).toLocaleString()}
                      >
                        {timeLabel}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}
          {/* Bottom input bar: always visible */}
          <div className="shrink-0 p-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
            {/* Message box: full width */}
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Message..."
                rows={2}
                className="w-full max-h-40 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 pr-8 text-lg resize-y"
              />
              {input && (
                <button
                  type="button"
                  onClick={() => setInput("")}
                  className="absolute top-1.5 right-1.5 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300 text-xl font-medium"
                  aria-label="Clear input"
                >
                  ×
                </button>
              )}
            </div>

            {/* Context status: count + preview link */}
            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                {conversation?.contexts.length
                  ? `${conversation.contexts.length} context${conversation.contexts.length === 1 ? "" : "s"} selected`
                  : "No contexts selected"}
              </span>
              <button
                type="button"
                onClick={openContextPreview}
                disabled={!selectedId || contextPreviewLoading}
                className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-50 disabled:no-underline"
              >
                {contextPreviewLoading ? "Loading context…" : "Context preview"}
              </button>
            </div>

            {/* Model selector + Send */}
            <div className="flex items-center flex-wrap gap-2">
              {currentPersona && (
                <button
                  type="button"
                  onClick={() => personaSelectRef.current?.showPicker?.() ?? personaSelectRef.current?.focus()}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 overflow-hidden shrink-0 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  aria-label="Choose persona"
                  title="Click to change persona"
                >
                  {currentPersona.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentPersona.avatarUrl}
                      alt={currentPersona.displayName}
                      className="h-20 w-20 object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-20 w-20 items-center justify-center bg-sky-100 dark:bg-sky-900 text-4xl">
                      {PERSONA_AVATAR[currentPersona.name] ?? "🤖"}
                    </span>
                  )}
                </button>
              )}
              <div className="flex flex-col gap-0.5 flex-1 sm:flex-none min-w-0">
                <select
                  ref={personaSelectRef}
                  value={personaId}
                  onChange={(e) => setPersonaId(e.target.value)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50 outline-none text-base w-full sm:w-48 px-2 py-1"
                  aria-label="Persona"
                >
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} ({p.costTier})
                    </option>
                  ))}
                </select>
                {currentPersona?.modelString && (
                  <span className="text-sm text-zinc-400 dark:text-zinc-500 px-1">
                    {currentPersona.modelString.split("/").pop()?.replace(/-/g, " ")}
                    {currentPersona.provider ? ` · ${currentPersona.provider}` : ""}
                  </span>
                )}
                {currentPersona?.description && (
                  <span className="hidden sm:block text-xs text-zinc-400 dark:text-zinc-500 px-1 leading-snug max-w-[24rem]">
                    {currentPersona.description}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="basis-full sm:basis-auto sm:ml-auto shrink-0 rounded-lg bg-sky-600 text-white px-4 py-2 text-base font-medium disabled:opacity-50"
                aria-label="Send"
              >
                Send
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Message menu portal (renders outside overflow container so it's not clipped) */}
      {messageMenuId &&
        menuPosition &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-30"
              aria-hidden
              onClick={() => {
                setMessageMenuId(null);
                setSelectionMenu(null);
              }}
            />
            <div
              className="fixed z-40 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-950 shadow-xl py-1 w-max"
              style={{ bottom: menuPosition.bottom, right: menuPosition.right }}
            >
              {(() => {
                const msg = conversation?.messages.find((mm) => mm.id === messageMenuId);
                if (!msg) return null;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => followUpLater(msg.id, msg.content)}
                      className="block text-left px-3 py-2 text-sm whitespace-nowrap hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Follow up (branch)
                    </button>
                    <button
                      type="button"
                      onClick={() => { savePromptToQueue(msg.content); setMessageMenuId(null); }}
                      className="block text-left px-3 py-2 text-sm whitespace-nowrap hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Save to prompt queue
                    </button>
                    {msg.role === "assistant" && (
                      <button
                        type="button"
                        onClick={() => openWiskrCapture(msg.id, msg.content)}
                        className="block text-left px-3 py-2 text-sm whitespace-nowrap hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Add to my documents
                      </button>
                    )}
                    <p className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 mt-1">
                      Highlight text for more actions
                    </p>
                  </>
                );
              })()}
            </div>
          </>,
          document.body
        )}

      {/* Selection menu portal (text selection actions) */}
      {selectionMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-30"
              aria-hidden
              onClick={() => {
                setSelectionMenu(null);
                window.getSelection()?.removeAllRanges();
              }}
            />
            <div
              className="fixed z-40 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-950 shadow-xl py-1 w-max"
              style={{ bottom: selectionMenu.bottom, right: selectionMenu.right }}
            >
              <button
                type="button"
                onClick={() => {
                  savePromptToQueue(selectionMenu.text);
                  setSelectionMenu(null);
                  window.getSelection()?.removeAllRanges();
                }}
                className="block text-left px-3 py-2 text-sm whitespace-nowrap hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Save to prompt queue
              </button>
              <button
                type="button"
                onClick={() => {
                  followUpLater(selectionMenu.messageId, selectionMenu.text);
                  setSelectionMenu(null);
                  window.getSelection()?.removeAllRanges();
                }}
                className="block text-left px-3 py-2 text-sm whitespace-nowrap hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Follow up (branch)
              </button>
              {selectionMenu.role === "assistant" && (
                <button
                  type="button"
                  onClick={() => {
                    openWiskrCapture(selectionMenu.messageId, selectionMenu.text);
                    setSelectionMenu(null);
                    window.getSelection()?.removeAllRanges();
                  }}
                  className="block text-left px-3 py-2 text-sm whitespace-nowrap hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Add to my documents
                </button>
              )}
            </div>
          </>,
          document.body
        )}

      {/* New conversation modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-sm w-full p-4 flex flex-col gap-4">
            <h2 className="font-semibold text-lg">New conversation</h2>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title (optional)"
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2"
            />
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Contexts (AI will use these documents)</p>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-auto">
                {categories.map((cat) => (
                  <label key={cat.name} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newContextIds.has(cat.name)}
                      onChange={() => toggleContext(setNewContextIds, cat.name)}
                      className="rounded"
                    />
                    <span className="text-sm">{cat.name}</span>
                    {cat.count > 0 && (
                      <span className="text-xs text-zinc-500">({cat.count})</span>
                    )}
                  </label>
                ))}
                {categories.length === 0 && (
                  <p className="text-sm text-zinc-500">No categories yet. Add tags to documents to see them here.</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitNewConversation}
                disabled={creating}
                className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context picker modal (edit contexts for current conversation) */}
      {showContextPicker && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-sm w-full p-4 flex flex-col gap-4">
            <h2 className="font-semibold text-lg">Contexts for this conversation</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              The AI will use documents and notes from the selected contexts.
            </p>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-auto">
              {categories.map((cat) => (
                <label key={cat.name} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pickerContextIds.has(cat.name)}
                    onChange={() => toggleContext(setPickerContextIds, cat.name)}
                    className="rounded"
                  />
                  <span className="text-sm">{cat.name}</span>
                  {cat.count > 0 && (
                    <span className="text-xs text-zinc-500">({cat.count})</span>
                  )}
                </label>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-zinc-500">No categories yet.</p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowContextPicker(false)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveContextPicker}
                disabled={patchingContexts}
                className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversations panel (overlay) */}
      {showConversationsPanel && (
        <div className="fixed inset-0 z-30 flex">
          <div
            className="flex-1 bg-black/30"
            aria-hidden
            onClick={() => setShowConversationsPanel(false)}
          />
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <span className="font-semibold text-sm">Conversations</span>
              <button
                type="button"
                onClick={() => setShowConversationsPanel(false)}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Close conversations"
              >
                ×
              </button>
            </div>
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={createConversation}
                disabled={creating}
                className="w-full rounded-lg bg-sky-600 text-white py-2 px-3 text-sm font-medium disabled:opacity-50"
              >
                New conversation
              </button>
            </div>
            <ul className="flex-1 overflow-auto p-3 space-y-1">
              {conversations.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id);
                      setShowConversationsPanel(false);
                    }}
                    className={`flex-1 text-left rounded-lg py-2 px-3 text-sm truncate ${
                      selectedId === c.id
                        ? "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {c.parentConversation && (
                      <span className="text-zinc-400 dark:text-zinc-500 mr-1">↳ </span>
                    )}
                    {c.title ?? "Untitled"} ({c._count.messages})
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteConversation(c.id)}
                    disabled={!!deletingConversationId}
                    className="shrink-0 p-1.5 rounded-lg text-xs text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40"
                    aria-label="Delete conversation"
                  >
                    🗑
                  </button>
                </li>
              ))}
              {conversations.length === 0 && (
                <li className="text-xs text-zinc-500 py-3">
                  No conversations yet. Create one to start chatting.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Symport panel (left drawer) */}
      {showSymportPanel && (
        <div className="fixed inset-0 z-25 flex">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <span className="font-semibold text-sm">Symport context</span>
              <button
                type="button"
                onClick={() => setShowSymportPanel(false)}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Close Symport panel"
              >
                ×
              </button>
            </div>
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                Context
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setSymportCategory(cat.name)}
                    className={`px-2 py-1 rounded-full text-xs border ${
                      (symportCategory || conversation?.contexts?.[0]?.contextId || categories[0]?.name) === cat.name
                        ? "border-sky-500 bg-sky-50 dark:bg-sky-900/40 text-sky-700 dark:text-sky-200"
                        : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {symportLoading ? (
                <p className="text-xs text-zinc-500">Loading documents…</p>
              ) : symportDocs.length === 0 ? (
                <p className="text-xs text-zinc-500">No documents in this context yet.</p>
              ) : (
                symportDocs.map((doc) => {
                  const data = doc.extractedData || {};
                  const title =
                    (typeof (data as any).title === "string" && (data as any).title.trim()) ||
                    (typeof (data as any).summary === "string" && (data as any).summary) ||
                    "Document";
                  const summary =
                    typeof (data as any).summary === "string"
                      ? (data as any).summary.slice(0, 140)
                      : "";
                  return (
                    <Link
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className="block rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <div className="text-sm font-medium truncate">{title}</div>
                      {summary && (
                        <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{summary}</div>
                      )}
                    </Link>
                  );
                })
              )}
            </div>
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
              <Link
                href="/documents"
                className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-xs text-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => setShowSymportPanel(false)}
              >
                Open Symport
              </Link>
              <Link
                href="/capture"
                className="flex-1 rounded-lg bg-sky-600 text-white px-3 py-2 text-xs text-center font-medium hover:bg-sky-700"
                onClick={() => setShowSymportPanel(false)}
              >
                Capture
              </Link>
            </div>
          </div>
          <div
            className="flex-1 bg-black/30"
            aria-hidden
            onClick={() => setShowSymportPanel(false)}
          />
        </div>
      )}

      {/* Wiskr capture modal: choose context for captured response */}
      {wiskrCaptureMessage && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-sm w-full p-4 flex flex-col gap-4">
            <h2 className="font-semibold text-lg">Add to my documents</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Save this response as a document so future conversations can reference it.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Context</label>
              <select
                value={wiskrCaptureContextId}
                onChange={(e) => setWiskrCaptureContextId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2"
              >
                {categories.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setWiskrCaptureMessage(null)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitWiskrCapture}
                disabled={capturing}
                className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {capturing ? "…" : "Capture"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context preview modal */}
      {showContextPreview && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="font-semibold text-base">What the AI can see</h2>
              <button
                type="button"
                onClick={() => setShowContextPreview(false)}
                className="text-xl leading-none p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Close context preview"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 flex-1 overflow-auto flex flex-col gap-5">
              {contextPreviewLoading ? (
                <p className="text-base text-zinc-500">Loading context…</p>
              ) : contextPreviewError ? (
                <p className="text-base text-red-500">{contextPreviewError}</p>
              ) : contextPreviewText ? (
                contextPreviewText
                  .split(/\n(?=\[CONTEXT:)/)
                  .map((block, i) => {
                    const headerMatch = block.match(/^\[CONTEXT:\s*(.+?)\]/);
                    const label = headerMatch?.[1] ?? null;
                    const body = block.replace(/^\[CONTEXT:\s*.+?\]\n?/, "").trim();
                    const lines = body.split("\n").filter(Boolean);
                    return (
                      <div key={i}>
                        {label && (
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-2">
                            {label}
                          </h3>
                        )}
                        <ul className="flex flex-col gap-1.5">
                          {lines.map((line, j) => (
                            <li key={j} className="text-base text-zinc-800 dark:text-zinc-100 leading-snug pl-3 border-l-2 border-zinc-200 dark:border-zinc-700">
                              {line.replace(/^[-•]\s*/, "")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })
              ) : (
                <p className="text-base text-zinc-500">No context available for this conversation.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* Branch cards / branch conversations drawer (right) */}
      {branchDrawerOpen && (selectedId || branchDrawerMode === "queue") && (
        <div className="fixed inset-0 z-20 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            aria-hidden
            onClick={() => setBranchDrawerOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">Side panel</h2>
                <div className="inline-flex rounded-full border border-zinc-300 dark:border-zinc-700 text-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setBranchDrawerMode("chats"); setPanelSearch(""); }}
                    className={`px-3 py-1 ${
                      branchDrawerMode === "chats"
                        ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-transparent text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    Chats
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBranchDrawerMode("branches"); setPanelSearch(""); }}
                    className={`px-3 py-1 border-l border-zinc-300 dark:border-zinc-700 ${
                      branchDrawerMode === "branches"
                        ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-transparent text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    Branches
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBranchDrawerMode("queue"); setPanelSearch(""); loadSavedPrompts(); }}
                    className={`px-3 py-1 border-l border-zinc-300 dark:border-zinc-700 ${
                      branchDrawerMode === "queue"
                        ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-transparent text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    Queue{savedPrompts.length > 0 && ` (${savedPrompts.length})`}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBranchDrawerOpen(false)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="px-3 pt-3 pb-1">
              <input
                type="search"
                value={panelSearch}
                onChange={(e) => setPanelSearch(e.target.value)}
                placeholder={branchDrawerMode === "chats" ? "Search chats…" : branchDrawerMode === "branches" ? "Search branches…" : "Search queue…"}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <ul className="flex-1 overflow-auto p-3 space-y-3">
              {branchDrawerMode === "chats" && <>
                {(() => {
                  const q = panelSearch.toLowerCase();
                  const filtered = q ? conversations.filter((c) => (c.title ?? "Untitled").toLowerCase().includes(q)) : conversations;
                  return filtered.length === 0
                    ? <li className="text-sm text-zinc-500 py-4">{q ? "No chats match your search." : "No chats yet. Start a new conversation to see it here."}</li>
                    : filtered.map((c) => (
                      <li key={c.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-1">
                        <button
                          type="button"
                          onClick={() => { setSelectedId(c.id); setBranchDrawerOpen(false); }}
                          className={`w-full text-left text-sm font-medium hover:underline ${c.id === selectedId ? "text-sky-600 dark:text-sky-400" : ""}`}
                        >
                          {c.title ?? "Untitled"} ({c._count.messages})
                        </button>
                        <p className="text-xs text-zinc-500">Updated {timeAgo(c.updatedAt)}</p>
                      </li>
                    ));
                })()}
              </>}
              {branchDrawerMode === "branches" && <>
                {(() => {
                  const q = panelSearch.toLowerCase();
                  const filtered = q ? branchCards.filter((c) => (c.triggerText || c.sourceMessage?.content || "").toLowerCase().includes(q)) : branchCards;
                  return filtered.length === 0
                    ? <li className="text-sm text-zinc-500 py-4">{q ? "No branches match your search." : "No branch cards. Use ⋯ on a message and choose \"Follow up later\"."}</li>
                    : filtered.map((card) => (
                      <li key={card.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                        <p className="text-sm line-clamp-2">{card.triggerText || card.sourceMessage?.content || "—"}</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openBranchAsConversation(card)}
                            disabled={!!openingCardId}
                            className="text-sm rounded-lg bg-sky-600 text-white px-3 py-1.5 font-medium disabled:opacity-50"
                          >
                            {openingCardId === card.id ? "…" : "Open"}
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissBranchCard(card.id)}
                            disabled={!!dismissingCardId}
                            className="text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        </div>
                      </li>
                    ));
                })()}
              </>}
              {branchDrawerMode === "queue" && <>
                {(() => {
                  const q = panelSearch.toLowerCase();
                  const filtered = q ? savedPrompts.filter((p) => p.content.toLowerCase().includes(q)) : savedPrompts;
                  return filtered.length === 0
                    ? <li className="text-sm text-zinc-500 py-4">{q ? "No prompts match your search." : "No saved prompts yet. Highlight any text in a message and choose \"Save to prompt queue\"."}</li>
                    : filtered.map((p) => (
                      <li key={p.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                        <p className="text-sm">{p.content}</p>
                        {p.sourceConversation && (
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                            From: {p.sourceConversation.title ?? "Untitled"}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setInput(p.content); setBranchDrawerOpen(false); }}
                            className="text-sm rounded-lg bg-sky-600 text-white px-3 py-1.5 font-medium"
                          >
                            Use
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSavedPrompt(p.id)}
                            className="text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ));
                })()}
              </>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
