import { outcomeKey, type PickRef } from "@/server/domain/predictions/ai-pick";
import { parseJson, sendChat, type ChatResult } from "@/server/integrations/openrouter/chat";
import { renderVotePrompt, VOTE_PROMPT_VERSION } from "@/server/integrations/openrouter/prompt";
import { voteJsonSchema, voteSchema, type VoteResult } from "@/server/integrations/openrouter/schema";

export type GenerateVoteInput = {
  model: string;
  webSearch: boolean;
  payload: unknown;
  allowed: PickRef[];
};

export type GenerateVoteOutput = {
  model: string;
  promptVersion: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  latencyMs: number;
  raw: string;
  parsed: VoteResult | null;
  validationError: string | null;
  sources: string[];
  webSearch: boolean;
};

type Send = (input: { model: string; prompt: string; webSearch: boolean }) => Promise<ChatResult>;

export async function generateVote(input: GenerateVoteInput, send: Send = sendVote): Promise<GenerateVoteOutput> {
  const prompt = renderVotePrompt(VOTE_PROMPT_VERSION, input.payload);
  if (!prompt) return emptyVote(input, "unknown_prompt");
  if (input.model.endsWith(":free") && process.env.VERCEL_ENV === "production") {
    return emptyVote(input, "free_model_in_production");
  }

  const allowed = new Set(input.allowed.map(outcomeKey));
  let lastRaw = "";
  let lastError = "invalid_json";
  let totals = { tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0, model: input.model };
  let sources: string[] = [];
  let sawCost = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now();
    try {
      const response = await send({ model: input.model, prompt, webSearch: input.webSearch });
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
      const parsed = voteSchema.safeParse(parseJson(response.content));
      if (!parsed.success) {
        lastError = parsed.error.issues.map((issue) => issue.message).join("; ").slice(0, 500);
        continue;
      }
      const covered = new Set(parsed.data.probabilities.map(outcomeKey));
      if (!allowed.has(outcomeKey(parsed.data.pick)) || [...allowed].some((key) => !covered.has(key))) {
        lastError = "pick_not_in_shortlist";
        continue;
      }
      return {
        model: totals.model,
        promptVersion: VOTE_PROMPT_VERSION,
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
    } catch (error) {
      totals.latencyMs += Date.now() - started;
      lastError = error instanceof Error ? error.message : "request_failed";
      lastRaw = lastRaw || lastError;
    }
  }

  return {
    model: totals.model,
    promptVersion: VOTE_PROMPT_VERSION,
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

async function sendVote(input: { model: string; prompt: string; webSearch: boolean }) {
  return sendChat({
    ...input,
    jsonSchema: { name: "vote", schema: voteJsonSchema },
  });
}

function emptyVote(input: GenerateVoteInput, error: string): GenerateVoteOutput {
  return {
    model: input.model,
    promptVersion: VOTE_PROMPT_VERSION,
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
