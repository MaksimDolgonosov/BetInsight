import type { RoundStage, SeriesKind } from "./constants";

/** Upcoming matches kept so a round played across several days is counted whole. */
export const ROUND_BOARD_HOURS = 240;

const ROUND_GAP_MS = 36 * 60 * 60 * 1000;
const SERIES_WINDOW_MS = ROUND_BOARD_HOURS * 60 * 60 * 1000;
const SERIES_MIN_SPAN_MS = 72 * 60 * 60 * 1000;

export type RoundFixture = {
  eventId: string;
  sportKey: string;
  home: string;
  away: string;
  commenceTime: Date;
};

export type RoundHint = {
  stage: RoundStage | null;
  series: SeriesKind | null;
};

const EMPTY: RoundHint = { stage: null, series: null };

const CUP_STAGE: Partial<Record<number, RoundStage>> = {
  1: "final",
  2: "semifinal",
  4: "quarterfinal",
  8: "round_of_16",
};

export function inferRounds(scheduled: readonly RoundFixture[]): Map<string, RoundHint> {
  const hints = new Map<string, RoundHint>();
  const bySport = new Map<string, RoundFixture[]>();
  for (const fixture of uniqueFixtures(scheduled)) {
    const list = bySport.get(fixture.sportKey);
    if (list) list.push(fixture);
    else bySport.set(fixture.sportKey, [fixture]);
  }

  for (const [sportKey, fixtures] of bySport) {
    const kind = competitionKind(sportKey);
    if (kind === "league") {
      for (const fixture of fixtures) hints.set(fixture.eventId, EMPTY);
      continue;
    }
    if (kind === "series") {
      for (const fixture of fixtures) hints.set(fixture.eventId, seriesHint(fixture, fixtures));
      continue;
    }
    for (const cluster of splitClusters(fixtures)) {
      for (const fixture of cluster) hints.set(fixture.eventId, cupHint(sportKey, fixture, cluster, fixtures));
    }
  }
  return hints;
}

function competitionKind(sportKey: string): "cup" | "series" | "league" {
  if (sportKey.startsWith("tennis_") || sportKey === "soccer_uefa_champs_league" || sportKey === "basketball_euroleague") return "cup";
  if (sportKey === "basketball_nba" || sportKey === "icehockey_nhl") return "series";
  return "league";
}

function cupHint(sportKey: string, event: RoundFixture, cluster: readonly RoundFixture[], sportFixtures: readonly RoundFixture[]): RoundHint {
  if (sportKey === "basketball_euroleague") return euroleagueHint(event, cluster, sportFixtures);
  const stage = CUP_STAGE[cluster.length] ?? null;
  if (stage === "final" && hasOutsideMatch(event, cluster, sportFixtures)) return EMPTY;
  return { stage, series: null };
}

function euroleagueHint(event: RoundFixture, cluster: readonly RoundFixture[], sportFixtures: readonly RoundFixture[]): RoundHint {
  if (hasOutsideMatch(event, cluster, sportFixtures)) return EMPTY;
  if (cluster.length === 3) return euroleagueFinalFour(event, cluster);
  if (cluster.length === 1) return { stage: "final", series: "euroleague_final" };
  if (cluster.length === 2) return { stage: "semifinal", series: null };
  return EMPTY;
}

function euroleagueFinalFour(event: RoundFixture, cluster: readonly RoundFixture[]): RoundHint {
  const latest = Math.max(...cluster.map((match) => match.commenceTime.getTime()));
  const finals = cluster.filter((match) => match.commenceTime.getTime() === latest);
  if (finals.length === 1 && finals[0]?.eventId === event.eventId) return { stage: "final", series: "euroleague_final" };
  return { stage: "semifinal", series: null };
}

// One NBA or NHL night is still the regular season. A playoff round has to span several days, unless the board is a single pair.
function seriesHint(event: RoundFixture, fixtures: readonly RoundFixture[]): RoundHint {
  const from = event.commenceTime.getTime() - SERIES_WINDOW_MS;
  const to = event.commenceTime.getTime() + SERIES_WINDOW_MS;
  const board = fixtures.filter((match) => {
    const time = match.commenceTime.getTime();
    return time >= from && time <= to;
  });
  const teams = new Set<string>();
  for (const match of board) {
    teams.add(teamKey(match.home));
    teams.add(teamKey(match.away));
  }
  const times = board.map((match) => match.commenceTime.getTime());
  const span = times.length === 0 ? 0 : Math.max(...times) - Math.min(...times);
  if (teams.size !== 2 && span < SERIES_MIN_SPAN_MS) return EMPTY;
  if (teams.size === 2 && board.length < 2) return EMPTY;
  const stage = stageForTeams(teams.size);
  if (!stage) return EMPTY;
  return { stage, series: stage === "final" ? finalsSeries(event.sportKey) : null };
}

function stageForTeams(teams: number): RoundStage | null {
  if (teams === 2) return "final";
  if (teams === 3 || teams === 4) return "semifinal";
  if (teams >= 5 && teams <= 8) return "quarterfinal";
  if (teams >= 9 && teams <= 16) return "round_of_16";
  return null;
}

function finalsSeries(sportKey: string): SeriesKind | null {
  if (sportKey === "basketball_nba") return "nba_finals";
  if (sportKey === "icehockey_nhl") return "nhl_finals";
  return null;
}

function splitClusters(fixtures: readonly RoundFixture[]): RoundFixture[][] {
  const sorted = [...fixtures].sort((left, right) => left.commenceTime.getTime() - right.commenceTime.getTime() || left.eventId.localeCompare(right.eventId));
  const groups: RoundFixture[][] = [];
  for (const fixture of sorted) {
    const current = groups[groups.length - 1];
    const previous = current?.[current.length - 1];
    if (!current || !previous || fixture.commenceTime.getTime() - previous.commenceTime.getTime() > ROUND_GAP_MS) groups.push([fixture]);
    else current.push(fixture);
  }
  return groups;
}

function hasOutsideMatch(event: RoundFixture, cluster: readonly RoundFixture[], fixtures: readonly RoundFixture[]): boolean {
  const ids = new Set(cluster.map((match) => match.eventId));
  return fixtures.some((match) => {
    if (ids.has(match.eventId)) return false;
    return Math.abs(match.commenceTime.getTime() - event.commenceTime.getTime()) <= SERIES_WINDOW_MS;
  });
}

function uniqueFixtures(scheduled: readonly RoundFixture[]): RoundFixture[] {
  const seen = new Set<string>();
  const unique: RoundFixture[] = [];
  for (const fixture of scheduled) {
    if (seen.has(fixture.eventId)) continue;
    seen.add(fixture.eventId);
    unique.push(fixture);
  }
  return unique;
}

function teamKey(name: string): string {
  return name.trim().toLowerCase();
}
