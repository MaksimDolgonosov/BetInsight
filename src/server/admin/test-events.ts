import type { OutcomeEvaluation, Selection } from "@/server/domain/odds/evaluate";
import type { ConsensusDecision } from "@/server/domain/predictions/ai-pick";
import type { VoteResult } from "@/server/integrations/openrouter/schema";

export type TestTrack = "ai_pick";

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

export type SelectionTableRow = {
  eventId: string;
  sportKey: string;
  home: string;
  away: string;
  commenceTime: string;
  asymmetryScore: number;
  asymmetryMarket: "h2h" | "totals" | "spreads";
  voteTime: string;
  selected: boolean;
  tested: boolean;
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
  | {
      type: "selection";
      windowMinHours: number;
      windowMaxHours: number;
      rows: SelectionTableRow[];
    }
  | { type: "model"; rows: ModelTableRow[] }
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
      homeForm: ("W" | "D" | "L")[];
      awayForm: ("W" | "D" | "L")[];
      sources: string[];
      error: string | null;
      webSearch: boolean;
      dataScore: number | null;
      action: "vote" | "low_confidence" | "discard" | null;
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
      lowConfidence: boolean;
    } & ConsensusDecision)
  | {
      type: "note";
      code:
        | "missing_openrouter_key"
        | "ai_pick_disabled"
        | "ai_pick_budget"
        | "ai_pick_cap"
        | "no_shortlist"
        | "not_selected"
        | "data_score_discard"
        | "missing_price"
        | "web_search_limited";
    }
  | { type: "error"; code: string }
  | { type: "done" };

export type BestPrices = Record<Selection, number | null>;
