/**
 * Embedding generation for semantic search (Wiskr / pgvector).
 * Uses OpenAI text-embedding-3-small (1536 dims) by default.
 */

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

export { EMBEDDING_DIMENSIONS };

/** Truncate text to a safe length for embedding API (e.g. 8k tokens ~= 32k chars). */
const MAX_TEXT_LENGTH = 30_000;

/**
 * Generate an embedding vector for the given text.
 * Returns null if OPENAI_API_KEY is not set or the API fails.
 */
export async function getEmbedding(text: string | null | undefined): Promise<number[] | null> {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return null;

  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const toEmbed = trimmed.length > MAX_TEXT_LENGTH ? trimmed.slice(0, MAX_TEXT_LENGTH) : trimmed;

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: key });
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: toEmbed,
    });
    const vec = res.data?.[0]?.embedding;
    return Array.isArray(vec) ? vec : null;
  } catch {
    return null;
  }
}

/**
 * Format an embedding array as a pgvector literal string for raw SQL.
 * e.g. [0.1, -0.2] -> '[0.1,-0.2]'
 */
export function embeddingToVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/** Prisma client type for executeRaw (avoid circular import). */
type PrismaClient = import("@prisma/client").PrismaClient;

/**
 * Generate embedding from text and persist to Document.embedding.
 * No-op if OPENAI_API_KEY is unset or embedding generation fails.
 */
export async function updateDocumentEmbedding(
  prisma: PrismaClient,
  documentId: string,
  text: string | null | undefined
): Promise<void> {
  const vec = await getEmbedding(text);
  if (!vec?.length) return;
  const literal = embeddingToVectorLiteral(vec);
  await prisma.$executeRaw`UPDATE "Document" SET embedding = ${literal}::vector WHERE id = ${documentId}`;
}
