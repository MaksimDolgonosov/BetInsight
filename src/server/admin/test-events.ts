import type { OutcomeEvaluation, Selection } from "@/server/domain/odds/evaluate";
import type { ConsensusDecision } from "@/server/domain/predictions/ai-pick";
import type { PredictionResult, VoteResult } from "@/server/integrations/openrouter/schema";

export type TestTrack = "value" | "ai_pick";

export type OddsTableRow = {
  eventId: string;
  home: string;
  away: string;
  commenceTime: string;
  bookmakerCount: number;
  bestHome: number | null;
  bestDraw: number | null;
  bestAway: number | null;
  totalPoint: number | null;
  bestOver: number | null;
  bestUnder: number | null;
};

export type ModelTableRow = OutcomeEvaluation & {
  eventId: string;
  home: string;
  away: string;
  commenceTime: string;
  aiPickShortlisted: boolean;
};

export type TestStreamEvent =
  | {
      type: "odds";
      httpStatus: number;
      latencyMs: number;
      remaining: number | null;
      used: number | null;
      lastCost: number | null;
      mocked: boolean;
      raw: unknown;
      table: OddsTableRow[];
      valid: boolean;
    }
  | { type: "model"; rows: ModelTableRow[] }
  | {
      type: "prediction";
      track: "value";
      eventId: string;
      home: string;
      away: string;
      model: string;
      promptVersion: string;
      tokensIn: number | null;
      tokensOut: number | null;
      costUsd: number | null;
      latencyMs: number;
      parsed: PredictionResult | null;
      raw: string;
      validationError: string | null;
      sources: string[];
      webSearch: boolean;
    }
  | {
      type: "research";
      eventId: string;
      home: string;
      away: string;
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
    }
  | {
      type: "vote";
      eventId: string;
      home: string;
      away: string;
      model: string;
      promptVersion: string;
      tokensIn: number | null;
      tokensOut: number | null;
      costUsd: number | null;
      latencyMs: number;
      parsed: VoteResult | null;
      raw: string;
      validationError: string | null;
    }
  | ({
      type: "consensus";
      eventId: string;
      home: string;
      away: string;
    } & ConsensusDecision)
  | {
      type: "note";
      code:
        | "value_cap"
        | "missing_openrouter_key"
        | "no_value_candidates"
        | "ai_pick_disabled"
        | "ai_pick_budget"
        | "ai_pick_cap"
        | "no_shortlist"
        | "web_search_limited";
    }
  | { type: "error"; code: string }
  | { type: "done" };

export type BestPrices = Record<Selection, number | null>;
