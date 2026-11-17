/** Base points from TZ 5.5. Leagues absent from that table use `unlisted` (0). */
export const LEAGUE_BASE_POINTS = {
  ucl: 40,
  nba_finals: 40,
  nhl_finals: 40,
  euroleague_final: 40,
  la_liga: 30,
  bundesliga: 30,
  nba: 30,
  nba_playoffs: 30,
  nhl: 30,
  nhl_playoffs: 30,
  euroleague: 30,
  grand_slam: 35,
  masters_1000: 25,
  atp_500: 25,
  atp_250: 15,
  wta: 15,
  unlisted: 0,
} as const;

export type LeagueClass = keyof typeof LEAGUE_BASE_POINTS;

export type SeriesKind = "nba_finals" | "nhl_finals" | "euroleague_final";

export const STAGE_POINTS = {
  final: 25,
  semifinal: 20,
  quarterfinal: 15,
  round_of_16: 15,
} as const;

export type RoundStage = keyof typeof STAGE_POINTS;

export function isRoundStage(value: string | null | undefined): value is RoundStage {
  return value === "final" || value === "semifinal" || value === "quarterfinal" || value === "round_of_16";
}

export const FORM_WEIGHTS = [0.35, 0.25, 0.2, 0.12, 0.08] as const;
export const FORM_VALUES = { W: 1, D: 0.4, L: 0 } as const;
export const FORM_SAMPLE = 5;
export const MIN_FORM_MATCHES = 3;
export const FORM_BONUS_SCALE = 15;
export const SIGNIFICANCE_CAP = 100;

export const SELECTION_MARKET = "selection";
export const DEFAULT_SELECTION_WINDOW = { minHours: 4, maxHours: 24 };
export const DEFAULT_DAILY_LIMIT = 8;
export const DEFAULT_DAILY_QUOTAS = { perLeague: 3, tennis: 2 };
export const DEFAULT_DATA_SCORE_THRESHOLDS = { voteMin: 6, lowConfidenceMin: 4 };
