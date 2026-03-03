export type DetailLevel = "low" | "medium" | "high";

export interface ModelCapability {
  /** Approximate maximum context window in tokens for the model. */
  maxContextTokens: number;
  /** Safe maximum tokens to request for the model's output. */
  maxOutputTokens: number;
  /**
   * Fraction of the context window that we are willing to devote to
   * background context (documents + conversation history). The rest is
   * reserved for instructions and the model's reply.
   */
  contextFraction: number;
  /** How much detail to include in assembled context for this model. */
  detailLevel: DetailLevel;
}

const DEFAULT_CAPABILITY: ModelCapability = {
  maxContextTokens: 16_000,
  maxOutputTokens: 2_048,
  contextFraction: 0.4,
  detailLevel: "medium",
};

/**
 * Explicit overrides for known model strings. These do not need to be
 * perfectly accurate; they just give us sane relative budgets.
 */
const MODEL_CAPABILITIES: Record<string, Partial<ModelCapability>> = {
  // Google Gemini
  "google/gemini-2.5-flash": {
    maxContextTokens: 128_000,
    maxOutputTokens: 4_096,
    contextFraction: 0.5,
    detailLevel: "high",
  },
  "google/gemini-3.1-pro": {
    maxContextTokens: 128_000,
    maxOutputTokens: 4_096,
    contextFraction: 0.5,
    detailLevel: "high",
  },

  // OpenAI
  "openai/gpt-4o-mini-2024-07-18": {
    maxContextTokens: 32_000,
    maxOutputTokens: 2_048,
    contextFraction: 0.4,
    detailLevel: "medium",
  },
  "openai/gpt-4o-2024-11-20": {
    maxContextTokens: 128_000,
    maxOutputTokens: 4_096,
    contextFraction: 0.5,
    detailLevel: "high",
  },
  "openai/gpt-5.2": {
    maxContextTokens: 200_000,
    maxOutputTokens: 4_096,
    contextFraction: 0.5,
    detailLevel: "high",
  },
  "openai/gpt-4-turbo": {
    maxContextTokens: 128_000,
    maxOutputTokens: 4_096,
    contextFraction: 0.45,
    detailLevel: "high",
  },

  // Anthropic
  "anthropic/claude-3-haiku": {
    maxContextTokens: 200_000,
    maxOutputTokens: 4_096,
    contextFraction: 0.5,
    detailLevel: "high",
  },
  "anthropic/claude-3.5-sonnet": {
    maxContextTokens: 200_000,
    maxOutputTokens: 4_096,
    contextFraction: 0.5,
    detailLevel: "high",
  },
  "anthropic/claude-sonnet-4-6": {
    maxContextTokens: 200_000,
    maxOutputTokens: 4_096,
    contextFraction: 0.5,
    detailLevel: "high",
  },
  "anthropic/claude-opus-4": {
    maxContextTokens: 200_000,
    maxOutputTokens: 4_096,
    contextFraction: 0.5,
    detailLevel: "high",
  },

  // Meta Llama
  "meta-llama/llama-3.1-70b-instruct": {
    maxContextTokens: 128_000,
    maxOutputTokens: 4_096,
    contextFraction: 0.45,
    detailLevel: "high",
  },
  "meta-llama/llama-3.1-405b-instruct": {
    maxContextTokens: 200_000,
    maxOutputTokens: 4_096,
    contextFraction: 0.5,
    detailLevel: "high",
  },

  // DeepSeek
  "deepseek/deepseek-v3.2": {
    maxContextTokens: 64_000,
    maxOutputTokens: 2_048,
    contextFraction: 0.4,
    detailLevel: "high",
  },

  // Mistral
  "mistralai/mistral-large": {
    maxContextTokens: 128_000,
    maxOutputTokens: 4_096,
    contextFraction: 0.45,
    detailLevel: "high",
  },
};

function inferFromProvider(model: string): Partial<ModelCapability> | null {
  const [provider] = model.split("/");
  switch (provider) {
    case "google":
      return { maxContextTokens: 128_000, maxOutputTokens: 4_096, contextFraction: 0.5, detailLevel: "high" };
    case "openai":
      return { maxContextTokens: 128_000, maxOutputTokens: 4_096, contextFraction: 0.45, detailLevel: "high" };
    case "anthropic":
      return { maxContextTokens: 200_000, maxOutputTokens: 4_096, contextFraction: 0.5, detailLevel: "high" };
    case "meta-llama":
      return { maxContextTokens: 128_000, maxOutputTokens: 4_096, contextFraction: 0.45, detailLevel: "high" };
    case "deepseek":
      return { maxContextTokens: 64_000, maxOutputTokens: 2_048, contextFraction: 0.4, detailLevel: "medium" };
    case "mistralai":
      return { maxContextTokens: 64_000, maxOutputTokens: 2_048, contextFraction: 0.4, detailLevel: "medium" };
    default:
      return null;
  }
}

export function getModelCapability(modelString: string | null | undefined): ModelCapability {
  if (!modelString) return { ...DEFAULT_CAPABILITY };
  const explicit = MODEL_CAPABILITIES[modelString];
  if (explicit) {
    return { ...DEFAULT_CAPABILITY, ...explicit };
  }
  const inferred = inferFromProvider(modelString);
  if (inferred) {
    return { ...DEFAULT_CAPABILITY, ...inferred };
  }
  return { ...DEFAULT_CAPABILITY };
}

