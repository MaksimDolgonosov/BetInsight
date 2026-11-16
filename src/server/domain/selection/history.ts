import { FORM_SAMPLE } from "./constants";
import type { FormResult } from "./form";

export type FinishedMatch = {
  id: string;
  sportKey: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  commenceTime: Date;
};

export function teamForm(
  team: string,
  sportKey: string,
  matches: readonly FinishedMatch[],
  before: Date,
): FormResult[] {
  const name = normalize(team);
  if (!name) return [];
  return matches
    .filter((match) => match.sportKey === sportKey && match.commenceTime.getTime() < before.getTime() && plays(match, name))
    .sort((left, right) => right.commenceTime.getTime() - left.commenceTime.getTime() || right.id.localeCompare(left.id))
    .slice(0, FORM_SAMPLE)
    .flatMap((match) => {
      const result = resultFor(name, match);
      return result ? [result] : [];
    });
}

function plays(match: FinishedMatch, name: string): boolean {
  return normalize(match.home) === name || normalize(match.away) === name;
}

function resultFor(name: string, match: FinishedMatch): FormResult | null {
  if (!Number.isFinite(match.homeScore) || !Number.isFinite(match.awayScore)) return null;
  if (match.homeScore === match.awayScore) return "D";
  const homeWin = match.homeScore > match.awayScore;
  const isHome = normalize(match.home) === name;
  return (isHome ? homeWin : !homeWin) ? "W" : "L";
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
