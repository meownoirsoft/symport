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
  ensureStandardFields(result, schema.standardFields);

  return result;
}
