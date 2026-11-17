import { inferRounds, isRoundStage, rankDay, type DailyQuotas, type RivalryPair, type RoundStage, type ScoredEvent, type TeamMeta } from "@/server/domain/selection";
import { teamForm, type FinishedMatch } from "@/server/domain/selection/history";

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

export type SelectionScore = {
  significanceScore: number;
  formHome: number;
  formAway: number;
  formDelta: number;
  formBonus: number;
  finalScore: number;
  formSource: ScoredEvent["formSource"];
  roundStage: RoundStage | null;
};

export function planSelection(input: {
  now: Date;
  events: readonly SelectionEvent[];
  teamMeta?: readonly TeamMeta[];
  rivalries?: readonly RivalryPair[];
  window: { minHours: number; maxHours: number };
  dailyLimit: number;
  quotas: DailyQuotas;
}): ScoredEvent[] {
  return reviewSelection(input).selected;
}

export function reviewSelection(input: {
  now: Date;
  events: readonly SelectionEvent[];
  teamMeta?: readonly TeamMeta[];
  rivalries?: readonly RivalryPair[];
  window: { minHours: number; maxHours: number };
  dailyLimit: number;
  quotas: DailyQuotas;
}): { ranked: ScoredEvent[]; selected: ScoredEvent[] } {
  const finished = finishedMatches(input.events);
  const scheduled = input.events.filter((event) => event.status === "scheduled");
  const rounds = inferRounds(scheduled.map((event) => ({
    eventId: event.id,
    sportKey: event.sportKey,
    home: event.home,
    away: event.away,
    commenceTime: event.commenceTime,
  })));
  const schedule = scheduled.map((event) => {
    const round = rounds.get(event.id);
    return {
      eventId: event.id,
      sportKey: event.sportKey,
      home: event.home,
      away: event.away,
      commenceTime: event.commenceTime,
      stage: round?.stage ?? null,
      series: round?.series ?? null,
      homeForm: teamForm(event.home, event.sportKey, finished, event.commenceTime),
      awayForm: teamForm(event.away, event.sportKey, finished, event.commenceTime),
    };
  });
  return rankDay({
    now: input.now,
    events: schedule,
    teamMeta: input.teamMeta,
    rivalries: input.rivalries,
    window: input.window,
    dailyLimit: input.dailyLimit,
    quotas: input.quotas,
  });
}

export function selectionScore(event: ScoredEvent): SelectionScore {
  return {
    significanceScore: event.significanceScore,
    formHome: event.formHome,
    formAway: event.formAway,
    formDelta: event.formDelta,
    formBonus: event.formBonus,
    finalScore: event.finalScore,
    formSource: event.formSource,
    roundStage: event.stage,
  };
}

export type ResearchStamp = {
  dataScore: number;
  researchSummary: string | null;
  discardReason: string | null;
  lowConfidence: boolean;
};

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

export function attachSelectionScores<T extends { eventId: string }>(
  rows: readonly T[],
  prior: readonly ({ eventId: string } & { [K in keyof SelectionScore]?: SelectionScore[K] | null })[],
): (T & Partial<SelectionScore>)[] {
  const scores = new Map<string, SelectionScore>();
  for (const row of prior) {
    if (scores.has(row.eventId) || !isSelectionScore(row)) continue;
    scores.set(row.eventId, { ...row, roundStage: isRoundStage(row.roundStage) ? row.roundStage : null });
  }
  return rows.map((row) => {
    const score = scores.get(row.eventId);
    return score ? { ...row, ...score } : row;
  });
}

function finishedMatches(events: readonly SelectionEvent[]): FinishedMatch[] {
  return events.flatMap((event) => {
    if (event.status !== "completed" || event.homeScore == null || event.awayScore == null) return [];
    return [{
      id: event.id,
      sportKey: event.sportKey,
      home: event.home,
      away: event.away,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      commenceTime: event.commenceTime,
    }];
  });
}

function isSelectionScore(row: { [Key in keyof SelectionScore]?: SelectionScore[Key] | null }): row is SelectionScore {
  return (
    typeof row.significanceScore === "number" &&
    typeof row.formHome === "number" &&
    typeof row.formAway === "number" &&
    typeof row.formDelta === "number" &&
    typeof row.formBonus === "number" &&
    typeof row.finalScore === "number" &&
    (row.formSource === "calculated" || row.formSource === "insufficient_data")
  );
}
