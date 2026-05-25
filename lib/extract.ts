import { getPromptStandardFieldsSection } from "@/lib/document-schemas";

async function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey: key });
}

const EXTRACTION_SYSTEM_HEAD = `You are a document extraction assistant. Analyze the image and extract structured data.

Current date context: We are in 2025. Use 2025 (not 2023 or other past years) for any ambiguous or partial dates when no stronger clue is present.

Use context clues from the document text to infer the correct year:
- "2025 taxes due in 2026" or "file 2025 taxes by April 2026" → tax year 2025
- "Plan year 2025", "Coverage year 2025", "Effective 2025" → use 2025 for dates
- "For the period ending 12/31/2025", "January 2025 – December 2025" → use 2025
- "Due in 2026" on a tax-related doc often refers to tax year 2025 (filed in 2026)
When the document explicitly states a year or tax year, use that year in all date fields. Only fall back to "current year 2025" when no such clue is present.

Respond with a single JSON object. Include "type", "category", "title", and "tags" in every response.

- "type": one of rx_receipt, eob, utility_bill, general (legacy classification).
- "category": one of receipt, financial, medical, government, legal, identity, general. Use "receipt" for any purchase/payment receipt (retail, pharmacy, etc.). Use "financial" for bills, statements, EOBs, invoices, utility bills. Use "medical" for medical records, provider statements, prescriptions. Use "government", "legal", or "identity" when the document clearly fits (e.g. tax notice, court doc, ID). Use "general" for everything else.
- "title" (required, 3-6 words): Include the specific vendor, pharmacy, provider, or insurer name when visible, plus the document type. Examples: "CVS Pharmacy receipt", "Blue Shield EOB", "PG&E utility bill", "Dr. Kim visit record". Prefer specific names over generic labels like "Prescription receipt" or "Insurance EOB".
- "tags": array of 3–8 short labels (e.g. medical, receipt, insurance, tax, HSA). No spaces in a tag; use underscores if needed.

`;

const EXTRACTION_SYSTEM_TAIL = `

Use null for missing values. Amounts as numbers. Dates as YYYY-MM-DD; use context clues for year (2025 when appropriate). Output only valid JSON, no markdown or explanation.`;

function buildExtractionSystem(): string {
  return (
    EXTRACTION_SYSTEM_HEAD +
    getPromptStandardFieldsSection() +
    "\n\nFor receipt you may also include: pharmacy, drug_name, copay_amount (map to amount if total), etc. For financial you may also include: insurer, provider, patient_responsibility (map to amount_due), billed_amount, insurance_paid, claim_number, etc." +
    EXTRACTION_SYSTEM_TAIL
  );
}

const EXTRACTION_SYSTEM = buildExtractionSystem();

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
  const { normalizeExtractedData } = await import("@/lib/normalize-extraction");
  return normalizeExtractedData(obj) as ExtractedDoc;
}

const EXTRACTION_SYSTEM_TEXT = EXTRACTION_SYSTEM.replace(
  "Analyze the image and extract structured data.",
  "The user will provide document content as text. Extract structured data from it."
);

/** Extract same JSON structure from plain text (for notes). */
export async function extractFromText(
  text: string,
  options?: { userFeedback?: string | null }
): Promise<ExtractedDoc> {
  let systemContent = EXTRACTION_SYSTEM_TEXT;
  if (options?.userFeedback?.trim()) {
    systemContent += `\n\nIMPORTANT - User feedback (apply these corrections):\n${options.userFeedback.trim()}`;
  }

  const openai = await getOpenAI();
  const model = process.env.OPENAI_EXTRACTION_MODEL || "gpt-4o";
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: `Document text:\n\n${text.trim()}` },
    ],
    max_tokens: 1024,
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error("No extraction response");

  let jsonStr = raw;
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) jsonStr = match[1].trim();

  const parsed = JSON.parse(jsonStr);
  if (typeof parsed !== "object" || parsed === null) {
    return { type: "general", title: "Note", summary: "Invalid extraction response" } as ExtractedDoc;
  }
  const obj = parsed as Record<string, unknown>;
  const t = obj.type;
  if (t !== "rx_receipt" && t !== "eob" && t !== "utility_bill" && t !== "general") {
    return { ...obj, type: "general" } as ExtractedDoc;
  }
  const { normalizeExtractedData } = await import("@/lib/normalize-extraction");
  return normalizeExtractedData(obj) as ExtractedDoc;
}

/** Effective title for display/search: title or first useful fallback. */
export function effectiveTitle(data: Record<string, unknown>): string {
  if (typeof data.title === "string" && data.title.trim()) return data.title.trim();
  if (typeof data.summary === "string") return data.summary;
  if (typeof data.provider === "string") return data.provider;
  if (typeof data.vendor === "string") return data.vendor;
  if (typeof data.party === "string") return data.party;
  if (typeof data.insurer === "string") return data.insurer;
  if (typeof data.pharmacy === "string") return data.pharmacy;
  if (typeof data.issuer === "string") return data.issuer;
  if (typeof data.type === "string") return data.type;
  return "Document";
}

export function buildSearchText(data: ExtractedDoc): string {
  const parts: string[] = [];
  parts.push(effectiveTitle(data as Record<string, unknown>));
  if ("summary" in data && data.summary && String(data.summary).trim() !== parts[0]) parts.push(String(data.summary));
  if ("pharmacy" in data && data.pharmacy) parts.push(String(data.pharmacy));
  if ("drug_name" in data && data.drug_name) parts.push(String(data.drug_name));
  if ("insurer" in data && data.insurer) parts.push(String(data.insurer));
  if ("provider" in data && data.provider) parts.push(String(data.provider));
  if ("vendor" in data && data.vendor) parts.push(String(data.vendor));
  if ("party" in data && data.party) parts.push(String(data.party));
  if ("issuer" in data && data.issuer) parts.push(String(data.issuer));
  if ("tags" in data && Array.isArray(data.tags)) {
    parts.push(...(data.tags as string[]).map((t) => String(t).trim()).filter(Boolean));
  }
  if ("key_fields" in data && data.key_fields && typeof data.key_fields === "object") {
    parts.push(JSON.stringify(data.key_fields));
  }
  return parts.join(" ");
}

/**
 * Extract structured data from a PDF buffer.
 * For text-based PDFs: extracts text via pdf-parse then calls extractFromText().
 * For image-only/scanned PDFs (no extractable text): returns a minimal record
 * with an extraction note so the user knows to try re-extracting after adding notes.
 */
export async function extractFromPDF(
  buffer: Buffer,
  options?: { userFeedback?: string | null }
): Promise<ExtractedDoc> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfModule = await import("pdf-parse") as any;
  const pdfParse = (pdfModule.default ?? pdfModule) as (buf: Buffer) => Promise<{ text: string }>;
  let text = "";
  try {
    const result = await pdfParse(buffer);
    text = result.text?.trim() ?? "";
  } catch {
    // Malformed or encrypted PDF — fall through to scanned handling
  }

  if (text.length > 80) {
    return extractFromText(text, options);
  }

  // Scanned/image-only PDF: no usable text layer
  return {
    type: "general",
    title: "Scanned PDF",
    summary: "This appears to be a scanned (image-only) PDF. No text could be extracted automatically. Add notes below describing the document content, then use Re-extract with feedback.",
    tags: ["pdf", "scanned"],
  } as ExtractedDoc;
}

/** Normalize tags to a string array (trimmed, spaces→underscores, unique). Preserves capitalization. */
export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    const s = String(item).trim().replace(/\s+/g, "_");
    if (s) out.add(s);
  }
  return [...out];
}
