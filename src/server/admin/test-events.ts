import type { OutcomeEvaluation, Selection } from "@/server/domain/odds/evaluate";
import type { PredictionResult } from "@/server/integrations/openrouter/schema";

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
    }
  | { type: "note"; code: "ai_cap" | "missing_openrouter_key" }
  | { type: "error"; code: string }
  | { type: "done" };

export type BestPrices = Record<Selection, number | null>;
