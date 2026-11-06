import { OpenRouter } from "@openrouter/sdk";

export type ChatResult = {
  content: string;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  sources: string[];
};

export async function sendChat(input: {
  model: string;
  prompt: string;
  webSearch: boolean;
  jsonSchema?: { name: string; schema: object };
}): Promise<ChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("missing_openrouter_key");

  const client = new OpenRouter({
    apiKey,
    appTitle: "BetInsight",
  });
  const result = await client.chat.send({
    chatRequest: {
      model: input.model,
      messages: [{ role: "user", content: input.prompt }],
      responseFormat: input.jsonSchema
        ? {
            type: "json_schema",
            jsonSchema: {
              name: input.jsonSchema.name,
              strict: true,
              schema: input.jsonSchema.schema,
            },
          }
        : undefined,
      plugins: input.webSearch ? [{ id: "web" }] : undefined,
    },
  });

  if (!isChatResult(result)) throw new Error("unexpected_stream");
  const content = messageText(result.choices[0]?.message.content);
  return {
    content,
    model: result.model,
    tokensIn: result.usage?.promptTokens ?? null,
    tokensOut: result.usage?.completionTokens ?? null,
    costUsd: result.usage?.cost ?? null,
    sources: collectSources(result, content),
  };
}

type ChatCompletion = {
  choices: { message: { content?: string | unknown[] | null } }[];
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    cost?: number | null;
  };
};

function isChatResult(result: unknown): result is ChatCompletion {
  return typeof result === "object" && result != null && "choices" in result && Array.isArray(result.choices);
}

function messageText(content: string | unknown[] | null | undefined): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item === "object" && item && "text" in item && typeof item.text === "string") return item.text;
      return "";
    })
    .join("");
}

export function collectSources(value: unknown, text: string): string[] {
  const urls = new Set<string>();
  for (const match of text.match(/https?:\/\/[^\s)\]>"']+/g) ?? []) {
    urls.add(match.replace(/[.,;]+$/, ""));
  }
  walk(value, urls, 0);
  return [...urls].slice(0, 20);
}

function walk(value: unknown, urls: Set<string>, depth: number) {
  if (depth > 8 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, urls, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.type === "url_citation" && typeof record.url === "string") urls.add(record.url);
  for (const child of Object.values(record)) walk(child, urls, depth + 1);
}

export function parseJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenced?.[1] ?? trimmed);
}
