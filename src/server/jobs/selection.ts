import { rankDay, type PricedEvent, type SelectedEvent } from "@/server/domain/selection";

export type SelectionEvent = {
  id: string;
  sportKey: string;
  home: string;
  away: string;
  commenceTime: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
};

export type ResearchStamp = {
  dataScore: number;
  researchSummary: string | null;
  discardReason: string | null;
  lowConfidence: boolean;
};

export function reviewSelection(input: {
  now: Date;
  events: readonly PricedEvent[];
  window: { minHours: number; maxHours: number };
  range: { min: number; max: number };
  leagueQuota: number;
  voteWindow: { startHour: number; endHour: number };
}): { ranked: SelectedEvent[]; selected: SelectedEvent[] } {
  return rankDay(input);
}

export function attachResearchScores<T extends { eventId: string }>(
  rows: readonly T[],
  prior: readonly ({ eventId: string } & { [K in keyof ResearchStamp]?: ResearchStamp[K] | null })[],
): (T & Partial<ResearchStamp>)[] {
  const scores = new Map<string, ResearchStamp>();
  for (const row of prior) {
    if (scores.has(row.eventId) || typeof row.dataScore !== "number" || typeof row.lowConfidence !== "boolean") continue;
    scores.set(row.eventId, {
      dataScore: row.dataScore,
      researchSummary: row.researchSummary ?? null,
      discardReason: row.discardReason ?? null,
      lowConfidence: row.lowConfidence,
    });
  }
  return rows.map((row) => {
    const score = scores.get(row.eventId);
    return score ? { ...row, ...score } : row;
  });
}
