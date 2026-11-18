import { peakAsymmetry, type AsymmetryMarket, type AsymmetryOutcome } from "./asymmetry";
import {
  DEFAULT_LEAGUE_QUOTA,
  DEFAULT_PROB_RANGE,
  DEFAULT_SELECTION_WINDOW,
  DEFAULT_VOTE_LEAD_HOURS,
  DEFAULT_VOTE_WINDOW,
  type ProbRange,
  type VoteWindow,
} from "./constants";
import { applyLeagueQuota } from "./quotas";
import { voteTime } from "./vote-time";
import { inSelectionWindow } from "./window";

export type PricedEvent = {
  eventId: string;
  sportKey: string;
  leagueKey?: string;
  home: string;
  away: string;
  commenceTime: Date;
  outcomes: readonly AsymmetryOutcome[];
};

export type SelectedEvent = {
  eventId: string;
  sportKey: string;
  leagueKey: string;
  home: string;
  away: string;
  commenceTime: Date;
  asymmetryScore: number;
  asymmetryMarket: AsymmetryMarket;
  asymmetrySelection: string;
  asymmetryPoint: number | null;
  asymmetryStrength: number;
  voteTime: Date;
};

export function selectDay(input: {
  now: Date;
  events: readonly PricedEvent[];
  window?: { minHours: number; maxHours: number };
  range?: ProbRange;
  leagueQuota?: number;
  voteLeadHours?: number;
  voteWindow?: VoteWindow;
}): SelectedEvent[] {
  return rankDay(input).selected;
}

export function rankDay(input: {
  now: Date;
  events: readonly PricedEvent[];
  window?: { minHours: number; maxHours: number };
  range?: ProbRange;
  leagueQuota?: number;
  voteLeadHours?: number;
  voteWindow?: VoteWindow;
}): { ranked: SelectedEvent[]; selected: SelectedEvent[] } {
  const window = input.window ?? DEFAULT_SELECTION_WINDOW;
  const range = input.range ?? DEFAULT_PROB_RANGE;
  const voteWindow = input.voteWindow ?? DEFAULT_VOTE_WINDOW;
  const leadHours = input.voteLeadHours ?? DEFAULT_VOTE_LEAD_HOURS;
  const ranked: SelectedEvent[] = [];
  for (const event of input.events) {
    if (!inSelectionWindow(event.commenceTime, input.now, window)) continue;
    const peak = peakAsymmetry(event.outcomes, range);
    if (!peak) continue;
    ranked.push({
      eventId: event.eventId,
      sportKey: event.sportKey,
      leagueKey: event.leagueKey ?? event.sportKey,
      home: event.home,
      away: event.away,
      commenceTime: event.commenceTime,
      asymmetryScore: peak.probability,
      asymmetryMarket: peak.market,
      asymmetrySelection: peak.selection,
      asymmetryPoint: peak.point,
      asymmetryStrength: peak.strength,
      voteTime: voteTime({ commenceTime: event.commenceTime, now: input.now, leadHours, window: voteWindow }),
    });
  }
  return { ranked, selected: applyLeagueQuota(ranked, input.leagueQuota ?? DEFAULT_LEAGUE_QUOTA) };
}
