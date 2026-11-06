import { parseJson, sendChat, type ChatResult } from "@/server/integrations/openrouter/chat";
import { renderPrompt } from "@/server/integrations/openrouter/prompt";
import { predictionJsonSchema, predictionSchema, type PredictionResult } from "@/server/integrations/openrouter/schema";

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
  sources: string[];
  webSearch: boolean;
};

type Send = (input: GeneratePredictionInput) => Promise<ChatResult>;

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
  let sources: string[] = [];
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
      sources = response.sources ?? [];
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
          sources,
          webSearch: input.webSearch,
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
    sources,
    webSearch: input.webSearch,
  };
}

async function sendWithSdk(input: GeneratePredictionInput): Promise<ChatResult> {
  const prompt = renderPrompt(input.promptVersion, input.payload);
  if (!prompt) throw new Error("unknown_prompt");
  return sendChat({
    model: input.model,
    prompt,
    webSearch: input.webSearch,
    jsonSchema: { name: "prediction", schema: predictionJsonSchema },
  });
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
    sources: [],
    webSearch: input.webSearch,
  };
}
