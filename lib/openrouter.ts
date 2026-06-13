/**
 * OpenRouter API client for Wiskr — one API, every model, no vendor lock-in.
 * Uses OpenAI-compatible chat completion format.
 */

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export type OpenRouterMessage = { role: "system" | "user" | "assistant"; content: string };

export interface OpenRouterChatOptions {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  apiKey?: string;
}

export interface OpenRouterChatResponse {
  id?: string;
  choices?: Array<{
    message?: { role: string; content: string };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: { message: string; code?: string };
}

/**
 * Create a chat completion via OpenRouter.
 * Requires OPENROUTER_API_KEY in env.
 */
export async function openRouterChat(
  options: OpenRouterChatOptions
): Promise<OpenRouterChatResponse> {
  const key = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!key?.trim()) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      max_tokens: options.max_tokens ?? 2048,
      temperature: options.temperature ?? 0.7,
    }),
  });

  const data = (await res.json()) as OpenRouterChatResponse;
  if (!res.ok) {
    const msg = data?.error?.message ?? res.statusText;
    throw new Error(`OpenRouter: ${msg}`);
  }
  return data;
}
