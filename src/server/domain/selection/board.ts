import type { AsymmetryMarket } from "./asymmetry";
import { SELECTION_MARKET } from "./constants";

export type BoardEvaluation = {
  eventId: string;
  home: string;
  away: string;
  market: string;
  asymmetryScore?: number | null;
  asymmetryMarket?: string | null;
  dataScore?: number | null;
  lowConfidence?: boolean;
  discardReason?: string | null;
};

export type SelectionBoardRow = {
  eventId: string;
  home: string;
  away: string;
  asymmetryScore: number;
  asymmetryMarket: AsymmetryMarket;
  dataScore: number | null;
  lowConfidence: boolean;
  discardReason: string | null;
};

export function selectionBoard(rows: readonly BoardEvaluation[]): SelectionBoardRow[] {
  const byEvent = new Map<string, SelectionBoardRow & { placeholder: boolean }>();
  for (const row of rows) {
    const mapped = toBoardRow(row);
    if (!mapped) continue;
    const placeholder = row.market === SELECTION_MARKET;
    const current = byEvent.get(row.eventId);
    if (current && !(current.placeholder && !placeholder)) continue;
    byEvent.set(row.eventId, { ...mapped, placeholder });
  }
  return [...byEvent.values()]
    .sort((left, right) => right.asymmetryScore - left.asymmetryScore || left.eventId.localeCompare(right.eventId))
    .map((row) => ({
      eventId: row.eventId,
      home: row.home,
      away: row.away,
      asymmetryScore: row.asymmetryScore,
      asymmetryMarket: row.asymmetryMarket,
      dataScore: row.dataScore,
      lowConfidence: row.lowConfidence,
      discardReason: row.discardReason,
    }));
}

function toBoardRow(row: BoardEvaluation): SelectionBoardRow | null {
  if (typeof row.asymmetryScore !== "number" || !isAsymmetryMarket(row.asymmetryMarket)) return null;
  return {
    eventId: row.eventId,
    home: row.home,
    away: row.away,
    asymmetryScore: row.asymmetryScore,
    asymmetryMarket: row.asymmetryMarket,
    dataScore: row.dataScore ?? null,
    lowConfidence: row.lowConfidence ?? false,
    discardReason: row.discardReason ?? null,
  };
}

function isAsymmetryMarket(value: string | null | undefined): value is AsymmetryMarket {
  return value === "h2h" || value === "totals" || value === "spreads";
}
