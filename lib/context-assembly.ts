import { prisma } from "@/lib/db";
import { getCategoryForTag, documentBelongsToOnlyOther } from "@/lib/document-categories";
import { readCategoryOverrides } from "@/lib/category-overrides";
import { effectiveTitle } from "@/lib/extract";
import { getEmbedding, embeddingToVectorLiteral } from "@/lib/embeddings";
import { getModelCapability, type DetailLevel } from "@/lib/model-capabilities";
import { estimateLinesTokens } from "@/lib/token-estimation";

export type ContextLabel = string;

export type ContextItemRef =
  | {
      kind: "document";
      id: string;
      contextLabel: ContextLabel;
      score?: number;
    }
  | {
      kind: "message";
      id: string;
      contextLabel: "ConversationHistory";
    };

export interface BuildContextPackageOptions {
  conversationId: string;
  contextLabels: ContextLabel[];
  /**
   * Underlying OpenRouter model string for the selected persona.
   * Used to choose token budgets and detail level.
   */
  modelString?: string | null;
  /**
   * Latest user message content; used to steer semantic retrieval.
   */
  latestUserMessage: string;
  /**
   * Optional 4-digit year string (e.g. "2024"). When set, only documents
   * whose extractedData.date starts with this year are included in context.
   */
  taxYear?: string | null;
}

export interface BuildContextPackageResult {
  contextPackage: string;
  includedItems: ContextItemRef[];
  /**
   * Approximate number of tokens consumed by the assembled context.
   */
  contextTokens: number;
  /**
   * True when the current context set differs from the context set of the most recent message.
   * UI can use this to show a "contexts changed" hint or banner.
   */
  contextMismatch?: boolean;
}

type SemanticDocRow = {
  id: string;
  tags: string[];
  extractedData: unknown;
  createdAt: Date;
};

const SEMANTIC_LIMIT = 50;

/**
 * In-memory cache of recent context packages so we do not recompute
 * everything on every single keystroke. Keys are stable across requests
 * within a single server process.
 */
type CacheKey = string;

type CacheEntry = {
  createdAt: number;
  result: BuildContextPackageResult;
};

const CONTEXT_CACHE = new Map<CacheKey, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function makeCacheKey(opts: BuildContextPackageOptions): CacheKey {
  const normalizedMessage = opts.latestUserMessage.trim().slice(0, 512);
  return [
    opts.conversationId,
    opts.contextLabels.slice().sort().join(","),
    opts.modelString ?? "unknown",
    opts.taxYear ?? "all",
    normalizedMessage,
  ].join("|");
}

async function getSemanticDocsForContexts(
  contextLabels: ContextLabel[],
  queryText: string
): Promise<Map<ContextLabel, SemanticDocRow[]>> {
  const byContext = new Map<ContextLabel, SemanticDocRow[]>();
  if (contextLabels.length === 0 || !queryText.trim()) return byContext;

  const vec = await getEmbedding(queryText);
  if (!vec?.length) {
    return byContext;
  }

  const literal = embeddingToVectorLiteral(vec);
  const rows = await prisma.$queryRaw<SemanticDocRow[]>`
    SELECT id, tags, "extractedData", "createdAt"
    FROM "Document"
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${SEMANTIC_LIMIT}
  `;

  const overrides = readCategoryOverrides();

  for (const label of contextLabels) {
    const matching = rows.filter((doc) => {
      const tags = (doc.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
      if (label === "Other") return documentBelongsToOnlyOther(tags, overrides);
      return tags.some((t) => getCategoryForTag(t, overrides) === label);
    });
    if (matching.length > 0) {
      byContext.set(label, matching);
    }
  }

  return byContext;
}

function describeDocument(data: Record<string, unknown>, detailLevel: DetailLevel): string {
  const title = effectiveTitle(data);
  const summary = typeof data.summary === "string" ? data.summary : "";
  const keyFields: string[] = [];
  if (data.vendor) keyFields.push(`Vendor: ${data.vendor}`);
  if (data.amount != null) keyFields.push(`Amount: ${data.amount}`);
  if (data.date) keyFields.push(`Date: ${data.date}`);
  if (data.insurer) keyFields.push(`Insurer: ${data.insurer}`);
  if (data.provider) keyFields.push(`Provider: ${data.provider}`);

  if (detailLevel !== "low") {
    if (data.tax_category && data.tax_category !== "unknown") {
      keyFields.push(`Tax category: ${data.tax_category}`);
    }
    if (data.hsa_fsa_eligible === true) keyFields.push("HSA/FSA eligible: yes");
    else if (data.hsa_fsa_eligible === false) keyFields.push("HSA/FSA eligible: no");
  }

  const base = [title, summary].filter(Boolean).join(" — ");

  if (detailLevel === "low") {
    return base || title || summary;
  }

  const joinedFields = keyFields.join(", ");
  const parts = [base, joinedFields].filter(Boolean);

  return parts.join(" — ");
}

function buildContextSummary(
  docs: { tags: string[]; extractedData: unknown }[],
  label: string,
  overrides: Record<string, string | null>
): string {
  const matching = docs.filter((doc) => {
    const tags = (doc.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
    if (label === "Other") return documentBelongsToOnlyOther(tags, overrides);
    return tags.some((t) => getCategoryForTag(t, overrides) === label);
  });
  if (!matching.length) return "";

  let totalAmount = 0;
  let amountCount = 0;
  let hsaEligible = 0;

  for (const doc of matching) {
    const data = (doc.extractedData as Record<string, unknown>) ?? {};
    const rawAmt = data.amount ?? data.copay_amount ?? data.patient_responsibility ?? data.amount_paid;
    const amt = rawAmt != null ? parseFloat(String(rawAmt)) : NaN;
    if (!isNaN(amt)) { totalAmount += amt; amountCount++; }
    if (data.hsa_fsa_eligible === true) hsaEligible++;
  }

  const parts: string[] = [`${matching.length} docs`];
  if (amountCount > 0) parts.push(`$${totalAmount.toFixed(2)} total`);
  if (hsaEligible > 0) parts.push(`${hsaEligible} HSA/FSA eligible`);
  return `Summary: ${parts.join(" — ")}`;
}

function sameContextSet(activeIds: string[] | null | undefined, currentLabels: ContextLabel[]): boolean {
  if (activeIds == null) return true;
  const a = Array.isArray(activeIds) ? activeIds : [];
  const current = new Set(currentLabels.slice().sort());
  const msgSet = new Set([...a].sort());
  if (current.size !== msgSet.size) return false;
  for (const id of current) if (!msgSet.has(id)) return false;
  return true;
}

async function buildConversationHistoryBlock(
  conversationId: string,
  contextLabels: ContextLabel[],
  detailLevel: DetailLevel,
  remainingTokenBudget: number
): Promise<{
  block: string | null;
  items: ContextItemRef[];
  tokensUsed: number;
  contextMismatch: boolean;
}> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, activeContextIds: true },
  });
  if (!messages.length) {
    return { block: null, items: [], tokensUsed: 0, contextMismatch: false };
  }

  const currentSet = contextLabels.slice().sort();
  const filtered = messages.filter((m) =>
    sameContextSet(m.activeContextIds as string[] | null, contextLabels)
  );

  let contextMismatch = false;
  const last = messages[messages.length - 1];
  if (last?.activeContextIds != null && Array.isArray(last.activeContextIds)) {
    const lastSet = [...(last.activeContextIds as string[])].sort();
    contextMismatch =
      currentSet.length !== lastSet.length ||
      currentSet.some((id, i) => id !== lastSet[i]);
  }

  const maxMessages =
    detailLevel === "high" ? 12 : detailLevel === "medium" ? 8 : 4;
  const recent = filtered.slice(-maxMessages);

  const lines: string[] = [];
  const items: ContextItemRef[] = [];

  for (const msg of recent) {
    const prefix = msg.role === "assistant" ? "Assistant" : msg.role === "system" ? "System" : "User";
    const content =
      detailLevel === "low"
        ? msg.content.slice(0, 200)
        : detailLevel === "medium"
        ? msg.content.slice(0, 400)
        : msg.content.slice(0, 800);
    const line = `- [${prefix}] ${content}`;
    lines.push(line);
    items.push({
      kind: "message",
      id: msg.id,
      contextLabel: "ConversationHistory",
    });
  }

  const header = "[CONTEXT: ConversationHistory]";
  const blockLines = [header, ...lines];
  const tokens = estimateLinesTokens(blockLines);

  if (tokens > remainingTokenBudget) {
    return { block: null, items: [], tokensUsed: 0, contextMismatch };
  }

  return {
    block: blockLines.join("\n"),
    items,
    tokensUsed: tokens,
    contextMismatch,
  };
}

/**
 * Legacy, non-token-aware context assembly. Kept for compatibility but
 * new call sites should use buildContextPackageForConversation.
 */
export async function buildContextPackage(contextLabels: ContextLabel[]): Promise<string> {
  if (contextLabels.length === 0) {
    return "The user has not selected any context. You have no document or prior analysis context.";
  }

  const overrides = readCategoryOverrides();
  const docs = await prisma.document.findMany({
    select: { tags: true, extractedData: true, searchText: true },
  });

  const sections: string[] = [];
  for (const label of contextLabels) {
    const matching = docs.filter((doc) => {
      const tags = (doc.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
      if (label === "Other") return documentBelongsToOnlyOther(tags, overrides);
      return tags.some((t) => getCategoryForTag(t, overrides) === label);
    });
    if (matching.length === 0) continue;
    const lines: string[] = [];
    for (const doc of matching) {
      const data = (doc.extractedData as Record<string, unknown>) ?? {};
      const desc = describeDocument(data, "medium");
      lines.push(`- ${desc}`);
    }
    sections.push(`[CONTEXT: ${label}]\n${lines.join("\n")}`);
  }
  const docBlock = sections.join("\n\n");
  const parts: string[] = [];
  parts.push("The user has selected the following contexts. Use this information to inform your answers.\n");
  if (docBlock) parts.push(docBlock);
  return parts.join("\n").trim() || "No documents for the selected contexts.";
}

/**
 * Token-aware, model-aware context assembly used by Wiskr conversations.
 */
export async function buildContextPackageForConversation(
  opts: BuildContextPackageOptions
): Promise<BuildContextPackageResult> {
  const { conversationId, contextLabels, modelString, latestUserMessage, taxYear } = opts;

  if (!contextLabels.length) {
    const contextPackage =
      "The user has not selected any Symport contexts. You have no document or prior analysis context.";
    return {
      contextPackage,
      includedItems: [],
      contextTokens: estimateLinesTokens([contextPackage]),
      contextMismatch: false,
    };
  }

  const cacheKey = makeCacheKey(opts);
  const cached = CONTEXT_CACHE.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.createdAt < CACHE_TTL_MS) {
    return cached.result;
  }

  const capability = getModelCapability(modelString);
  const totalContextBudget = Math.max(
    512,
    Math.floor(capability.maxContextTokens * capability.contextFraction)
  );

  let remainingBudget = totalContextBudget;
  const blocks: string[] = [];
  const includedItems: ContextItemRef[] = [];
  let totalTokens = 0;

  const history = await buildConversationHistoryBlock(
    conversationId,
    contextLabels,
    capability.detailLevel,
    remainingBudget
  );
  if (history.block) {
    blocks.push(history.block);
    includedItems.push(...history.items);
    totalTokens += history.tokensUsed;
    remainingBudget -= history.tokensUsed;
  }
  const contextMismatch = history.contextMismatch;

  const semanticByContext = await getSemanticDocsForContexts(
    contextLabels,
    latestUserMessage
  );
  const fallbackDocs =
    semanticByContext.size === 0
      ? await prisma.document.findMany({
          select: { id: true, tags: true, extractedData: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : null;
  const overrides = readCategoryOverrides();

  const allDocsForSummary = await prisma.document.findMany({
    select: { tags: true, extractedData: true },
  });

  for (const label of contextLabels) {
    const rawDocs = semanticByContext.get(label) ?? fallbackDocs ?? [];
    const docs = taxYear
      ? rawDocs.filter((doc) => {
          const d = (doc.extractedData as Record<string, unknown>)?.date;
          return typeof d === "string" && d.startsWith(taxYear);
        })
      : rawDocs;

    if (!docs.length) continue;

    const lines: string[] = [];

    for (const doc of docs) {
      const tags = (doc.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
      if (label === "Other") {
        if (!documentBelongsToOnlyOther(tags, overrides)) continue;
      } else {
        const matchesLabel = tags.some((t) => getCategoryForTag(t, overrides) === label);
        if (!matchesLabel) continue;
      }

      const data = (doc.extractedData as Record<string, unknown>) ?? {};
      const desc = describeDocument(data, capability.detailLevel);
      if (!desc) continue;
      const candidateLine = `- ${desc}`;
      const newTokens = estimateLinesTokens([...lines, candidateLine]);
      const headerTokens = estimateLinesTokens([`[CONTEXT: ${label}]`]);

      if (headerTokens + newTokens > remainingBudget) {
        break;
      }

      lines.push(candidateLine);
      includedItems.push({
        kind: "document",
        id: doc.id,
        contextLabel: label,
      });
    }

    if (!lines.length) continue;

    const summary = buildContextSummary(allDocsForSummary, label, overrides);
    const header = `[CONTEXT: ${label}]`;
    const sectionLines = summary ? [header, summary, ...lines] : [header, ...lines];
    const sectionTokens = estimateLinesTokens(sectionLines);

    if (sectionTokens > remainingBudget) {
      continue;
    }

    blocks.push(sectionLines.join("\n"));
    remainingBudget -= sectionTokens;
    totalTokens += sectionTokens;

    if (remainingBudget <= 0) {
      break;
    }
  }

  if (!blocks.length) {
    const contextPackage =
      "No documents or prior analysis were found for the selected contexts.";
    const tokens = estimateLinesTokens([contextPackage]);
    const result: BuildContextPackageResult = {
      contextPackage,
      includedItems,
      contextTokens: tokens,
      contextMismatch,
    };
    CONTEXT_CACHE.set(cacheKey, { createdAt: now, result });
    return result;
  }

  const header =
    "The user has selected the following contexts and recent conversation history. Use this information to inform your answers.\n";
  const fullLines = [header.trim(), "", ...blocks];
  const contextPackage = fullLines.join("\n").trim();
  const headerTokens = estimateLinesTokens([header]);

  const result: BuildContextPackageResult = {
    contextPackage,
    includedItems,
    contextTokens: totalTokens + headerTokens,
    contextMismatch,
  };

  CONTEXT_CACHE.set(cacheKey, { createdAt: now, result });
  return result;
}

