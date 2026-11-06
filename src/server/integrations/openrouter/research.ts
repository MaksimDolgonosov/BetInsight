import { sendChat, type ChatResult } from "@/server/integrations/openrouter/chat";
import { renderResearchPrompt, RESEARCH_PROMPT_VERSION } from "@/server/integrations/openrouter/prompt";

export type GenerateResearchInput = {
  model: string;
  webSearch: boolean;
  payload: unknown;
};

export type GenerateResearchOutput = {
  model: string;
  promptVersion: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  latencyMs: number;
  text: string;
  sources: string[];
  error: string | null;
  webSearch: boolean;
};

type Send = (input: { model: string; prompt: string; webSearch: boolean }) => Promise<ChatResult>;

export async function generateResearch(
  input: GenerateResearchInput,
  send: Send = sendResearch,
): Promise<GenerateResearchOutput> {
  const prompt = renderResearchPrompt(RESEARCH_PROMPT_VERSION, input.payload);
  if (!prompt) return emptyResearch(input, "unknown_prompt");
  if (input.model.endsWith(":free") && process.env.VERCEL_ENV === "production") {
    return emptyResearch(input, "free_model_in_production");
  }

  let text = "";
  let sources: string[] = [];
  let lastError = "empty_research";
  let totals = { tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0, model: input.model };
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
      text = response.content.trim();
      sources = [...new Set([...(response.sources ?? []), ...urlsIn(text)])].slice(0, 20);
      if (text) {
        return {
          model: totals.model,
          promptVersion: RESEARCH_PROMPT_VERSION,
          tokensIn: totals.tokensIn,
          tokensOut: totals.tokensOut,
          costUsd: sawCost ? totals.costUsd : null,
          latencyMs: totals.latencyMs,
          text,
          sources,
          error: null,
          webSearch: input.webSearch,
        };
      }
      lastError = "empty_research";
    } catch (error) {
      totals.latencyMs += Date.now() - started;
      lastError = error instanceof Error ? error.message : "request_failed";
    }
  }

  return {
    model: totals.model,
    promptVersion: RESEARCH_PROMPT_VERSION,
    tokensIn: totals.tokensIn || null,
    tokensOut: totals.tokensOut || null,
    costUsd: sawCost ? totals.costUsd : null,
    latencyMs: totals.latencyMs,
    text,
    sources,
    error: lastError,
    webSearch: input.webSearch,
  };
}

async function sendResearch(input: { model: string; prompt: string; webSearch: boolean }) {
  return sendChat(input);
}

function urlsIn(text: string): string[] {
  return (text.match(/https?:\/\/[^\s)\]>"']+/g) ?? []).map((url) => url.replace(/[.,;]+$/, ""));
}

function emptyResearch(input: GenerateResearchInput, error: string): GenerateResearchOutput {
  return {
    model: input.model,
    promptVersion: RESEARCH_PROMPT_VERSION,
    tokensIn: null,
    tokensOut: null,
    costUsd: null,
    latencyMs: 0,
    text: "",
    sources: [],
    error,
    webSearch: input.webSearch,
  };
}
