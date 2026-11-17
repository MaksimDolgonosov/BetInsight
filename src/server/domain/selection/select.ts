import { DEFAULT_DAILY_LIMIT, DEFAULT_DAILY_QUOTAS, DEFAULT_SELECTION_WINDOW, type LeagueClass, type RoundStage, type SeriesKind } from "./constants";
import { assessForm, finalScore, type FormResult, type FormSource } from "./form";
import { applyDailyQuotas, type DailyQuotas } from "./quotas";
import { inferLeagueClass, isDerby, significanceScore, type TeamStanding } from "./significance";
import { inSelectionWindow } from "./window";

export type TeamMeta = {
  teamName: string;
  sportKey: string;
  leagueKey: string;
  tableRank: number | null;
  isRelegation: boolean;
};

export type RivalryPair = {
  sportKey: string;
  teamA: string;
  teamB: string;
};

export type ScheduleEvent = {
  eventId: string;
  sportKey: string;
  leagueKey?: string;
  home: string;
  away: string;
  commenceTime: Date;
  stage?: RoundStage | null;
  series?: SeriesKind | null;
  leagueClass?: LeagueClass;
  homeForm?: readonly FormResult[];
  awayForm?: readonly FormResult[];
};

export type ScoredEvent = {
  eventId: string;
  sportKey: string;
  leagueKey: string;
  home: string;
  away: string;
  commenceTime: Date;
  leagueClass: LeagueClass;
  stage: RoundStage | null;
  series: SeriesKind | null;
  significanceScore: number;
  formHome: number;
  formAway: number;
  formDelta: number;
  formBonus: number;
  formSource: FormSource;
  finalScore: number;
  isDerby: boolean;
};

export function scoreEvent(event: ScheduleEvent, teamMeta: readonly TeamMeta[], rivalries: readonly RivalryPair[]): ScoredEvent {
  const leagueKey = event.leagueKey ?? event.sportKey;
  const stage = event.stage ?? null;
  const leagueClass = event.leagueClass ?? inferLeagueClass(event.sportKey, { stage, series: event.series });
  const derby = isDerby(event.sportKey, event.home, event.away, rivalries);
  const significance = significanceScore({
    leagueClass,
    stage,
    home: standing(teamMeta, event.home, leagueKey),
    away: standing(teamMeta, event.away, leagueKey),
    isDerby: derby,
  });
  const form = assessForm(event.homeForm ?? [], event.awayForm ?? []);
  return {
    eventId: event.eventId,
    sportKey: event.sportKey,
    leagueKey,
    home: event.home,
    away: event.away,
    commenceTime: event.commenceTime,
    leagueClass,
    stage,
    series: event.series ?? null,
    significanceScore: significance,
    formHome: form.formHome,
    formAway: form.formAway,
    formDelta: form.formDelta,
    formBonus: form.formBonus,
    formSource: form.formSource,
    finalScore: finalScore(significance, form.formBonus),
    isDerby: derby,
  };
}

export function selectDay(input: {
  now: Date;
  events: readonly ScheduleEvent[];
  teamMeta?: readonly TeamMeta[];
  rivalries?: readonly RivalryPair[];
  window?: { minHours: number; maxHours: number };
  dailyLimit?: number;
  quotas?: DailyQuotas;
}): ScoredEvent[] {
  return rankDay(input).selected;
}

export function rankDay(input: {
  now: Date;
  events: readonly ScheduleEvent[];
  teamMeta?: readonly TeamMeta[];
  rivalries?: readonly RivalryPair[];
  window?: { minHours: number; maxHours: number };
  dailyLimit?: number;
  quotas?: DailyQuotas;
}): { ranked: ScoredEvent[]; selected: ScoredEvent[] } {
  const window = input.window ?? DEFAULT_SELECTION_WINDOW;
  const teamMeta = input.teamMeta ?? [];
  const rivalries = input.rivalries ?? [];
  const ranked = input.events
    .filter((event) => inSelectionWindow(event.commenceTime, input.now, window))
    .map((event) => scoreEvent(event, teamMeta, rivalries));
  const selected = applyDailyQuotas(ranked, {
    dailyLimit: input.dailyLimit ?? DEFAULT_DAILY_LIMIT,
    quotas: input.quotas ?? DEFAULT_DAILY_QUOTAS,
  });
  return { ranked, selected };
}

function standing(teamMeta: readonly TeamMeta[], teamName: string, leagueKey: string): TeamStanding | null {
  const name = teamName.trim().toLowerCase();
  const row = teamMeta.find((item) => item.leagueKey === leagueKey && item.teamName.trim().toLowerCase() === name);
  if (!row) return null;
  return { tableRank: row.tableRank, isRelegation: row.isRelegation };
}
