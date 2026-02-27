/**
 * Assemble a context package for Wiskr conversations from Symport documents.
 * Used to build the system prompt so the AI has access to selected contexts (Medical, Vehicle, etc.).
 */

import { prisma } from "@/lib/db";
import { getCategoryForTag, documentBelongsToOnlyOther } from "@/lib/document-categories";
import { readCategoryOverrides } from "@/lib/category-overrides";
import { effectiveTitle } from "@/lib/extract";

export type ContextLabel = string;

/**
 * Build a text block describing documents in the given contexts.
 * Each context gets a section with document summaries and key fields from extractedData.
 * "Other" only includes docs that have no tag mapping to any other category.
 */
async function getDocumentsForContexts(contextLabels: ContextLabel[]): Promise<string> {
  if (contextLabels.length === 0) return "";

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
      const title = effectiveTitle(data);
      const summary = typeof data.summary === "string" ? data.summary : "";
      const keyFields: string[] = [];
      if (data.vendor) keyFields.push(`Vendor: ${data.vendor}`);
      if (data.amount != null) keyFields.push(`Amount: ${data.amount}`);
      if (data.date) keyFields.push(`Date: ${data.date}`);
      if (data.insurer) keyFields.push(`Insurer: ${data.insurer}`);
      if (data.provider) keyFields.push(`Provider: ${data.provider}`);
      const desc = [title, summary, keyFields.join(", ")].filter(Boolean).join(" — ");
      lines.push(`- ${desc}`);
    }
    sections.push(`[CONTEXT: ${label}]\n${lines.join("\n")}`);
  }
  return sections.join("\n\n");
}

/**
 * Assemble the full context package for the system prompt.
 */
export async function buildContextPackage(contextLabels: ContextLabel[]): Promise<string> {
  if (contextLabels.length === 0) {
    return "The user has not selected any context. You have no document or prior analysis context.";
  }
  const docBlock = await getDocumentsForContexts(contextLabels);
  const parts: string[] = [];
  parts.push("The user has selected the following contexts. Use this information to inform your answers.\n");
  if (docBlock) parts.push(docBlock);
  return parts.join("\n").trim() || "No documents for the selected contexts.";
}
