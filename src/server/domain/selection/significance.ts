import { LEAGUE_BASE_POINTS, SIGNIFICANCE_CAP, STAGE_POINTS, type LeagueClass, type RoundStage, type SeriesKind } from "./constants";

export type TeamStanding = {
  tableRank: number | null;
  isRelegation: boolean;
};

export type SignificanceInput = {
  leagueClass: LeagueClass;
  stage: RoundStage | null;
  home: TeamStanding | null;
  away: TeamStanding | null;
  isDerby: boolean;
};

const GRAND_SLAM_TOKENS = ["australian_open", "aus_open", "french_open", "roland_garros", "wimbledon", "us_open"];
const MASTERS_TOKENS = ["indian_wells", "miami", "monte_carlo", "madrid", "rome", "italian", "canada", "cincinnati", "shanghai", "paris", "masters"];

export function inferLeagueClass(
  sportKey: string,
  hints?: { stage?: RoundStage | null; series?: SeriesKind | null },
): LeagueClass {
  if (sportKey === "soccer_uefa_champs_league") return "ucl";
  if (sportKey === "soccer_spain_la_liga") return "la_liga";
  if (sportKey === "soccer_germany_bundesliga") return "bundesliga";
  if (sportKey === "basketball_euroleague") {
    return hints?.series === "euroleague_final" || hints?.stage === "final" ? "euroleague_final" : "euroleague";
  }
  if (sportKey === "basketball_nba") {
    if (hints?.series === "nba_finals") return "nba_finals";
    if (hints?.stage) return "nba_playoffs";
    return "nba";
  }
  if (sportKey === "icehockey_nhl") {
    if (hints?.series === "nhl_finals") return "nhl_finals";
    if (hints?.stage) return "nhl_playoffs";
    return "nhl";
  }
  if (sportKey.startsWith("tennis_")) return inferTennisClass(sportKey);
  return "unlisted";
}

export function significanceScore(input: SignificanceInput): number {
  const base = LEAGUE_BASE_POINTS[input.leagueClass];
  const stage = input.stage ? STAGE_POINTS[input.stage] : 0;
  const total = base + stage + topFourPoints(input.home, input.away) + relegationPoints(input.home, input.away) + (input.isDerby ? 15 : 0);
  return Math.min(SIGNIFICANCE_CAP, total);
}

export function isDerby(sportKey: string, home: string, away: string, pairs: readonly { sportKey: string; teamA: string; teamB: string }[]): boolean {
  const left = normalizeName(home);
  const right = normalizeName(away);
  if (!left || !right || left === right) return false;
  return pairs.some((pair) => {
    if (pair.sportKey !== sportKey) return false;
    const teamA = normalizeName(pair.teamA);
    const teamB = normalizeName(pair.teamB);
    return (teamA === left && teamB === right) || (teamA === right && teamB === left);
  });
}

function inferTennisClass(sportKey: string): LeagueClass {
  const key = sportKey.toLowerCase();
  if (GRAND_SLAM_TOKENS.some((token) => key.includes(token))) return "grand_slam";
  if (key.includes("wta")) return "wta";
  if (MASTERS_TOKENS.some((token) => key.includes(token))) return "masters_1000";
  if (key.includes("500")) return "atp_500";
  if (key.includes("atp")) return "atp_250";
  return "unlisted";
}

function topFourPoints(home: TeamStanding | null, away: TeamStanding | null): number {
  const homeTop = isTopFour(home);
  const awayTop = isTopFour(away);
  if (homeTop && awayTop) return 20;
  if (homeTop || awayTop) return 10;
  return 0;
}

function isTopFour(team: TeamStanding | null): boolean {
  return team != null && team.tableRank != null && team.tableRank >= 1 && team.tableRank <= 4;
}

function relegationPoints(home: TeamStanding | null, away: TeamStanding | null): number {
  return home?.isRelegation && away?.isRelegation ? 15 : 0;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
