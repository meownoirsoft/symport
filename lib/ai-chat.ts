import { openRouterChat, type OpenRouterMessage } from "./openrouter";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface UserKeys {
  openrouter?: string | null;
  openai?: string | null;
  anthropic?: string | null;
}

export interface AiChatOptions {
  model: string;
  provider: string;
  messages: ChatMessage[];
  max_tokens?: number;
  userKeys: UserKeys;
}

export class NoApiKeyError extends Error {
  constructor() {
    super("NO_API_KEY");
    this.name = "NoApiKeyError";
  }
}

export async function aiChat(options: AiChatOptions): Promise<string> {
  const { model, provider, messages, max_tokens = 2048, userKeys } = options;

  if (provider === "OpenAI" && userKeys.openai) {
    const client = new OpenAI({ apiKey: userKeys.openai });
    const modelId = model.replace(/^openai\//, "");
    const response = await client.chat.completions.create({
      model: modelId,
      messages: messages as OpenAI.ChatCompletionMessageParam[],
      max_tokens,
    });
    return response.choices[0]?.message?.content?.trim() ?? "No response generated.";
  }

  if (provider === "Anthropic" && userKeys.anthropic) {
    const client = new Anthropic({ apiKey: userKeys.anthropic });
    const modelId = model.replace(/^anthropic\//, "");
    const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
    const convoMsgs = messages.filter((m) => m.role !== "system") as Anthropic.MessageParam[];
    const response = await client.messages.create({
      model: modelId,
      max_tokens,
      system: systemMsg || undefined,
      messages: convoMsgs,
    });
    const block = response.content[0];
    return (block?.type === "text" ? block.text.trim() : "") || "No response generated.";
  }

  if (userKeys.openrouter) {
    const response = await openRouterChat({
      model,
      messages: messages as OpenRouterMessage[],
      max_tokens,
      apiKey: userKeys.openrouter,
    });
    return response.choices?.[0]?.message?.content?.trim() ?? "No response generated.";
  }

  throw new NoApiKeyError();
}
