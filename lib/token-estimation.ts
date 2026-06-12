/**
 * Very lightweight token estimation for budgeting context.
 * We intentionally avoid model-specific tokenizers and instead approximate
 * tokens from character length, which is sufficient for coarse budgeting.
 */

const APPROX_CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / APPROX_CHARS_PER_TOKEN);
}

export function estimateLinesTokens(lines: string[]): number {
  return estimateTokens(lines.join("\n"));
}

