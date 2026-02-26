async function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey: key });
}

const EXTRACTION_SYSTEM = `You are a document extraction assistant. Analyze the image and extract structured data.

Current date context: We are in 2025. Use 2025 (not 2023 or other past years) for any ambiguous or partial dates when no stronger clue is present.

Use context clues from the document text to infer the correct year:
- "2025 taxes due in 2026" or "file 2025 taxes by April 2026" → tax year 2025
- "Plan year 2025", "Coverage year 2025", "Effective 2025" → use 2025 for dates
- "For the period ending 12/31/2025", "January 2025 – December 2025" → use 2025
- "Due in 2026" on a tax-related doc often refers to tax year 2025 (filed in 2026)
When the document explicitly states a year or tax year, use that year in all date fields. Only fall back to "current year 2025" when no such clue is present.

Respond with a single JSON object. The "type" field must be one of: rx_receipt, eob, utility_bill, general. Include a "tags" field: an array of 3–8 short lowercase labels that help categorize and find this document (e.g. medical, dental, receipt, insurance, eob, tax, w2, hsa, urgent, prescription, utility, bill). Use the document type, category, and salient traits. No spaces in a tag; use underscores if needed (e.g. tax_deductible).

IMPORTANT - "title" (required, 2-5 words max): A short category label only. NO sentences. NO phrases like "This document provides...", "This is a...", or "Document that shows...". Use a concrete label the user would scan for in a list. Examples:
- Insurance ID card (any insurer: Delta Dental, Blue Cross, etc.) → "Medical ID card" or "Dental insurance card"
- Pharmacy slip with drug/copay → "Prescription receipt"
- Explanation of Benefits → "Insurance EOB"
- Bill from utility company → "Utility bill"
- Appointment reminder, discharge summary, lab result → "Medical document" or "Appointment reminder"
Title must be a noun phrase (e.g. "Medical ID card"), never a sentence.

Schema by type (each includes "title" and "tags" as above):

- rx_receipt: type, title, date (YYYY-MM-DD), pharmacy, drug_name, ndc_code?, quantity?, copay_amount?, insurance_paid?, prescriber?, rx_number?, hsa_eligible?, reimbursement_status? (pending|submitted|reimbursed|not_eligible)

- eob: type, title, date, insurer, member_id?, provider, service_date?, billed_amount?, insurance_paid?, patient_responsibility?, deductible_applied?, linked_rx_receipts? (array), hsa_reimbursable?, claim_number?

- utility_bill: type, title, date_issued?, due_date?, provider, account_number?, amount_due?, status? (unpaid|paid), autopay?, period_start?, period_end?

- general (fallback): type "general", title, detected_category?, date?, issuer?, key_fields? (object), summary?, action_required?, action_description?

Use null for missing values. For amounts use numbers. For dates use YYYY-MM-DD; infer the year from context clues above when present, otherwise use 2025. Always output a "tags" array (string array). Output only valid JSON, no markdown or explanation.`;

export type ExtractedDoc =
  | { type: "rx_receipt"; [k: string]: unknown }
  | { type: "eob"; [k: string]: unknown }
  | { type: "utility_bill"; [k: string]: unknown }
  | { type: "general"; [k: string]: unknown };

export async function extractFromImageBuffer(
  buffer: Buffer,
  options?: { userFeedback?: string | null }
): Promise<ExtractedDoc> {
  const base64 = buffer.toString("base64");
  const mime = "image/jpeg"; // assume jpeg; png also works

  let systemContent = EXTRACTION_SYSTEM;
  if (options?.userFeedback?.trim()) {
    systemContent += `\n\nIMPORTANT - User feedback on this document (apply these corrections or use to improve extraction):\n${options.userFeedback.trim()}`;
  }

  const openai = await getOpenAI();
  const model = process.env.OPENAI_EXTRACTION_MODEL || "gpt-4o";
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemContent },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${base64}` },
          },
        ],
      },
    ],
    max_tokens: 1024,
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error("No extraction response");

  // Strip optional markdown code block
  let jsonStr = raw;
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) jsonStr = match[1].trim();

  const parsed = JSON.parse(jsonStr);
  if (typeof parsed !== "object" || parsed === null) {
    return { type: "general", title: "Document", summary: "Invalid extraction response" } as ExtractedDoc;
  }
  const obj = parsed as Record<string, unknown>;
  const t = obj.type;
  if (t !== "rx_receipt" && t !== "eob" && t !== "utility_bill" && t !== "general") {
    return { ...obj, type: "general" } as ExtractedDoc;
  }
  return obj as ExtractedDoc;
}

export function buildSearchText(data: ExtractedDoc): string {
  const parts: string[] = [];
  if ("title" in data && data.title) parts.push(String(data.title));
  if ("summary" in data && data.summary) parts.push(String(data.summary));
  if ("pharmacy" in data && data.pharmacy) parts.push(String(data.pharmacy));
  if ("drug_name" in data && data.drug_name) parts.push(String(data.drug_name));
  if ("insurer" in data && data.insurer) parts.push(String(data.insurer));
  if ("provider" in data && data.provider) parts.push(String(data.provider));
  if ("issuer" in data && data.issuer) parts.push(String(data.issuer));
  if ("tags" in data && Array.isArray(data.tags)) {
    parts.push(...(data.tags as string[]).map((t) => String(t).trim()).filter(Boolean));
  }
  if ("key_fields" in data && data.key_fields && typeof data.key_fields === "object") {
    parts.push(JSON.stringify(data.key_fields));
  }
  return parts.join(" ");
}

/** Normalize AI-extracted tags to a string array (lowercase, trimmed, unique). */
export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    const s = String(item).trim().toLowerCase().replace(/\s+/g, "_");
    if (s) out.add(s);
  }
  return [...out];
}
