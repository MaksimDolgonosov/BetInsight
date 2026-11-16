import { isRoundStage, SELECTION_MARKET, type RoundStage } from "./constants";
import type { FormSource } from "./form";

export type BoardEvaluation = {
  eventId: string;
  home: string;
  away: string;
  market: string;
  significanceScore?: number | null;
  formHome?: number | null;
  formAway?: number | null;
  formBonus?: number | null;
  finalScore?: number | null;
  formSource?: FormSource | null;
  roundStage?: string | null;
  dataScore?: number | null;
  lowConfidence?: boolean;
  discardReason?: string | null;
};

export type SelectionBoardRow = {
  eventId: string;
  home: string;
  away: string;
  significanceScore: number;
  formHome: number;
  formAway: number;
  formBonus: number;
  finalScore: number;
  formSource: FormSource;
  roundStage: RoundStage | null;
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
    .sort((left, right) => right.finalScore - left.finalScore || left.eventId.localeCompare(right.eventId))
    .map((row) => ({
      eventId: row.eventId,
      home: row.home,
      away: row.away,
      significanceScore: row.significanceScore,
      formHome: row.formHome,
      formAway: row.formAway,
      formBonus: row.formBonus,
      finalScore: row.finalScore,
      formSource: row.formSource,
      roundStage: row.roundStage,
      dataScore: row.dataScore,
      lowConfidence: row.lowConfidence,
      discardReason: row.discardReason,
    }));
}

function toBoardRow(row: BoardEvaluation): SelectionBoardRow | null {
  if (
    row.significanceScore == null ||
    row.formHome == null ||
    row.formAway == null ||
    row.formBonus == null ||
    row.finalScore == null ||
    (row.formSource !== "calculated" && row.formSource !== "insufficient_data")
  ) {
    return null;
  }
  return {
    eventId: row.eventId,
    home: row.home,
    away: row.away,
    significanceScore: row.significanceScore,
    formHome: row.formHome,
    formAway: row.formAway,
    formBonus: row.formBonus,
    finalScore: row.finalScore,
    formSource: row.formSource,
    roundStage: isRoundStage(row.roundStage) ? row.roundStage : null,
    dataScore: row.dataScore ?? null,
    lowConfidence: row.lowConfidence ?? false,
    discardReason: row.discardReason ?? null,
  };
}
