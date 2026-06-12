/**
 * Standardize extracted document data so every document kind has a
 * consistent set of standard fields. Uses the schema registry; no
 * hard-coded branches per category beyond small value-resolution helpers.
 */

import {
  type DocumentKind,
  DOCUMENT_SCHEMAS,
  getSchema,
} from "@/lib/document-schemas";

/** @deprecated Use DocumentKind from @/lib/document-schemas */
export type DocumentCategory = DocumentKind;

/** @deprecated Use getSchema("receipt").standardFields from @/lib/document-schemas */
export const RECEIPT_STANDARD_FIELDS = DOCUMENT_SCHEMAS.receipt.standardFields;

/** @deprecated Use getSchema("financial").standardFields from @/lib/document-schemas */
export const FINANCIAL_STANDARD_FIELDS = DOCUMENT_SCHEMAS.financial.standardFields;

function getDocumentKind(obj: Record<string, unknown>): DocumentKind {
  const cat = obj.category ?? obj.type;
  if (cat === "receipt" || cat === "rx_receipt") return "receipt";
  if (cat === "financial" || cat === "eob" || cat === "utility_bill" || cat === "invoice" || cat === "bill")
    return "financial";
  if (cat === "medical" || obj.insurer != null || obj.pharmacy != null) return "medical";
  if (cat === "government") return "government";
  if (cat === "legal") return "legal";
  if (cat === "identity") return "identity";
  return "general";
}

function pickNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function pickDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function pickString(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

function pickBoolean(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "yes" || s === "1") return true;
    if (s === "false" || s === "no" || s === "0") return false;
  }
  return null;
}

const TAX_CATEGORY_VALUES = new Set([
  "medical",
  "charity",
  "tax_payment",
  "mortgage_interest",
  "business_expense",
  "personal",
  "unknown",
]);

function pickTaxCategory(v: unknown): string | null {
  const s = pickString(v);
  if (!s) return null;
  const normalized = s.toLowerCase().replace(/[\s-]+/g, "_");
  return TAX_CATEGORY_VALUES.has(normalized) ? normalized : "unknown";
}

/** Multi-source value resolution for receipt. */
function applyReceiptValues(
  result: Record<string, unknown>,
  raw: Record<string, unknown>
): void {
  result.amount =
    pickNumber(raw.amount) ??
    pickNumber(raw.total) ??
    pickNumber(raw.copay_amount) ??
    pickNumber(raw.total_paid);
  result.date = pickDate(raw.date) ?? pickDate(raw.purchase_date);
  result.vendor =
    pickString(raw.vendor) ??
    pickString(raw.pharmacy) ??
    pickString(raw.merchant) ??
    pickString(raw.store);
  result.category =
    pickString(raw.category) ?? (raw.pharmacy ? "pharmacy" : null) ?? "other";
  result.payment_method =
    pickString(raw.payment_method) ??
    pickString(raw.payment) ??
    pickString(raw.paid_with);
  result.tax = pickNumber(raw.tax);
  result.currency = pickString(raw.currency) ?? "USD";
}

/** Multi-source value resolution for financial. */
function applyFinancialValues(
  result: Record<string, unknown>,
  raw: Record<string, unknown>
): void {
  result.amount_due =
    pickNumber(raw.amount_due) ??
    pickNumber(raw.patient_responsibility) ??
    pickNumber(raw.billed_amount) ??
    pickNumber(raw.balance_due);
  result.amount_paid =
    pickNumber(raw.amount_paid) ??
    pickNumber(raw.insurance_paid) ??
    pickNumber(raw.paid);
  result.date =
    pickDate(raw.date) ??
    pickDate(raw.service_date) ??
    pickDate(raw.date_issued);
  result.due_date = pickDate(raw.due_date);
  result.party =
    pickString(raw.party) ??
    pickString(raw.provider) ??
    pickString(raw.insurer) ??
    pickString(raw.utility);
  result.account_ref =
    pickString(raw.account_ref) ??
    pickString(raw.account_number) ??
    pickString(raw.member_id) ??
    pickString(raw.claim_number);
  result.status =
    pickString(raw.status) ??
    (result.amount_paid != null ? "paid" : null) ??
    "unpaid";
  result.period_start = pickDate(raw.period_start);
  result.period_end = pickDate(raw.period_end);
}

function applyAliases(
  result: Record<string, unknown>,
  raw: Record<string, unknown>,
  aliases: Record<string, string>
): void {
  for (const [rawKey, canonicalKey] of Object.entries(aliases)) {
    if (result[canonicalKey] != null) continue;
    const v = raw[rawKey];
    if (v == null) continue;
    result[canonicalKey] = v;
  }
}

function ensureStandardFields(
  result: Record<string, unknown>,
  standardFields: readonly string[]
): void {
  for (const f of standardFields) {
    if (!(f in result)) result[f] = null;
  }
}

/** Coerce tax_category and hsa_fsa_eligible to canonical types if present. */
function applyTaxFields(
  result: Record<string, unknown>,
  raw: Record<string, unknown>
): void {
  if ("tax_category" in raw) {
    result.tax_category = pickTaxCategory(raw.tax_category);
  }
  if ("hsa_fsa_eligible" in raw) {
    result.hsa_fsa_eligible = pickBoolean(raw.hsa_fsa_eligible);
  }
}

function formatTitleDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${parseInt(m[2])}/${parseInt(m[3])}/${m[1].slice(2)}`;
}

function extractTypeLabel(aiTitle: string, kind: string): string {
  const t = aiTitle.toLowerCase();
  if (t.includes("prescription") || t.includes(" rx")) return "Rx";
  if (t.includes("receipt")) return "Receipt";
  if (t.includes("eob") || t.includes("explanation of benefit")) return "EOB";
  if (t.includes("invoice")) return "Invoice";
  if (t.includes("bill")) return "Bill";
  if (t.includes("statement")) return "Statement";
  if (t.includes("claim")) return "Claim";
  if (t.includes("record")) return "Record";
  if (kind === "receipt") return "Receipt";
  if (kind === "financial") return "Statement";
  return aiTitle;
}

function buildRichTitle(result: Record<string, unknown>, raw: Record<string, unknown>): string | null {
  const dateStr =
    formatTitleDate(result.date as string | null) ??
    formatTitleDate(result.due_date as string | null) ??
    formatTitleDate(raw.service_date as string | null) ??
    formatTitleDate(raw.date_issued as string | null);

  const entity =
    pickString(raw.vendor) ??
    pickString(raw.pharmacy) ??
    pickString(raw.merchant) ??
    pickString(raw.store) ??
    pickString(raw.provider) ??
    pickString(raw.insurer) ??
    pickString(raw.party) ??
    pickString(raw.utility) ??
    pickString(result.vendor as unknown) ??
    pickString(result.party as unknown);

  const aiTitle = pickString(raw.title) ?? "";
  const kind = String(result.doc_category ?? "general");
  const isGeneric = !aiTitle || /^(document|general|note|unknown)$/i.test(aiTitle);

  if (!entity && !dateStr && isGeneric) return null;

  if (entity) {
    const typeLabel = isGeneric ? "" : extractTypeLabel(aiTitle, kind);
    const namePart =
      typeLabel && typeLabel.toLowerCase() !== entity.toLowerCase()
        ? `${entity} ${typeLabel}`
        : entity;
    return dateStr ? `${namePart} — ${dateStr}` : namePart;
  }

  if (!isGeneric && dateStr) return `${aiTitle} — ${dateStr}`;
  if (dateStr) return dateStr;
  return null;
}

/**
 * Normalize raw extraction into a consistent shape using the schema
 * registry. Kind is derived from raw data; aliases are applied and
 * all standard fields for that kind are ensured (null if missing).
 */
export function normalizeExtractedData(raw: Record<string, unknown>): Record<string, unknown> {
  const kind = getDocumentKind(raw);
  const schema = getSchema(kind);
  const result: Record<string, unknown> = { ...raw, doc_category: kind };

  if (kind === "receipt") applyReceiptValues(result, raw);
  if (kind === "financial") applyFinancialValues(result, raw);

  if (schema.aliases) applyAliases(result, raw, schema.aliases);
  applyTaxFields(result, raw);
  ensureStandardFields(result, schema.standardFields);

  const richTitle = buildRichTitle(result, raw);
  if (richTitle) result.title = richTitle;

  return result;
}
