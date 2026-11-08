import { evaluateQuotes, type NormalizedQuote } from "@/server/domain/odds/evaluate";
import { outcomeKey, selectAiPickShortlist } from "@/server/domain/predictions/ai-pick";
import type { SportThresholds } from "@/server/domain/settings";

export type LeagueEvent = {
  id: string;
  home: string;
  away: string;
  quotes: NormalizedQuote[];
};

export type ModelRow = {
  eventId: string;
  home: string;
  away: string;
  market: string;
  outcome: string;
  point: number | null;
  consensusProb: number;
  bestPrice: number;
  bestBookmaker: string;
  ev: number;
  isCandidate: boolean;
  nearMiss: boolean;
  aiPickShortlisted: boolean;
};

export function evaluateLeague(input: {
  events: LeagueEvent[];
  thresholds: SportThresholds;
  aiPick: { oddsMin: number; oddsMax: number; minEv: number; shortlistSize: number };
}): ModelRow[] {
  const evaluated = input.events.flatMap((event) =>
    evaluateQuotes(event.quotes, input.thresholds).map((row) => ({
      ...row,
      eventId: event.id,
      home: event.home,
      away: event.away,
    })),
  );
  const shortlist = selectAiPickShortlist(evaluated, {
    oddsMin: input.aiPick.oddsMin,
    oddsMax: input.aiPick.oddsMax,
    minEv: input.aiPick.minEv,
    minBookmakers: input.thresholds.minBookmakers,
    outcomesPerEvent: 3,
    eventLimit: input.aiPick.shortlistSize,
  });
  const shortlisted = new Set(shortlist.map((row) => `${row.eventId}|${outcomeKey(row)}`));

  return evaluated.map((row) => ({
    eventId: row.eventId,
    home: row.home,
    away: row.away,
    market: row.market,
    outcome: row.selection,
    point: row.point,
    consensusProb: row.consensusProb,
    bestPrice: row.bestPrice,
    bestBookmaker: row.bestBookmaker,
    ev: row.ev,
    isCandidate: row.candidate,
    nearMiss: row.nearMiss,
    aiPickShortlisted: shortlisted.has(`${row.eventId}|${outcomeKey(row)}`),
  }));
}
