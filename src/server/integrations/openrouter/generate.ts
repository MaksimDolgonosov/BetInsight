import { OpenRouter } from "@openrouter/sdk";
import { predictionJsonSchema, predictionSchema, type PredictionResult } from "@/server/integrations/openrouter/schema";
import { renderPrompt } from "@/server/integrations/openrouter/prompt";

export type GeneratePredictionInput = {
  model: string;
  promptVersion: string;
  webSearch: boolean;
  payload: unknown;
};

export type GeneratePredictionOutput = {
  model: string;
  promptVersion: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  latencyMs: number;
  raw: string;
  parsed: PredictionResult | null;
  validationError: string | null;
};

type Send = (input: GeneratePredictionInput) => Promise<{ content: string; model: string; tokensIn: number | null; tokensOut: number | null; costUsd: number | null }>;

export async function generatePrediction(
  input: GeneratePredictionInput,
  send: Send = sendWithSdk,
): Promise<GeneratePredictionOutput> {
  if (input.model.endsWith(":free") && process.env.VERCEL_ENV === "production") {
    return emptyOutput(input, "free_model_in_production");
  }

  const prompt = renderPrompt(input.promptVersion, input.payload);
  if (!prompt) return emptyOutput(input, "unknown_prompt");

  let lastRaw = "";
  let lastError = "invalid_json";
  let totals = { tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0, model: input.model };
  let sawCost = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now();
    try {
      const response = await send(input);
      totals = {
        tokensIn: totals.tokensIn + (response.tokensIn ?? 0),
        tokensOut: totals.tokensOut + (response.tokensOut ?? 0),
        costUsd: totals.costUsd + (response.costUsd ?? 0),
        latencyMs: totals.latencyMs + (Date.now() - started),
        model: response.model || input.model,
      };
      if (response.costUsd != null) sawCost = true;
      lastRaw = response.content;
      const parsed = predictionSchema.safeParse(parseJson(response.content));
      if (parsed.success) {
        return {
          model: totals.model,
          promptVersion: input.promptVersion,
          tokensIn: totals.tokensIn,
          tokensOut: totals.tokensOut,
          costUsd: sawCost ? totals.costUsd : null,
          latencyMs: totals.latencyMs,
          raw: lastRaw,
          parsed: parsed.data,
          validationError: null,
        };
      }
      lastError = parsed.error.issues.map((issue) => issue.message).join("; ").slice(0, 500);
    } catch (error) {
      totals.latencyMs += Date.now() - started;
      lastError = error instanceof Error ? error.message : "request_failed";
      lastRaw = lastRaw || lastError;
    }
  }

  return {
    model: totals.model,
    promptVersion: input.promptVersion,
    tokensIn: totals.tokensIn || null,
    tokensOut: totals.tokensOut || null,
    costUsd: sawCost ? totals.costUsd : null,
    latencyMs: totals.latencyMs,
    raw: lastRaw,
    parsed: null,
    validationError: lastError,
  };
}

async function sendWithSdk(input: GeneratePredictionInput) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("missing_openrouter_key");
  const prompt = renderPrompt(input.promptVersion, input.payload);
  if (!prompt) throw new Error("unknown_prompt");

  const client = new OpenRouter({
    apiKey,
    appTitle: "BetInsight",
  });
  const result = await client.chat.send({
    chatRequest: {
      model: input.model,
      messages: [{ role: "user", content: prompt }],
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "prediction",
          strict: true,
          schema: predictionJsonSchema,
        },
      },
      plugins: input.webSearch ? [{ id: "web" }] : undefined,
    },
  });

  if (!isChatResult(result)) {
    throw new Error("unexpected_stream");
  }

  return {
    content: messageText(result.choices[0]?.message.content),
    model: result.model,
    tokensIn: result.usage?.promptTokens ?? null,
    tokensOut: result.usage?.completionTokens ?? null,
    costUsd: result.usage?.cost ?? null,
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
      if (typeof item === "object" && item && "text" in item && typeof item.text === "string") {
        return item.text;
      }
      return "";
    })
    .join("");
}

function parseJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenced?.[1] ?? trimmed);
}

function emptyOutput(input: GeneratePredictionInput, error: string): GeneratePredictionOutput {
  return {
    model: input.model,
    promptVersion: input.promptVersion,
    tokensIn: null,
    tokensOut: null,
    costUsd: null,
    latencyMs: 0,
    raw: "",
    parsed: null,
    validationError: error,
  };
}
