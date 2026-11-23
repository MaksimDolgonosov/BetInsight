import { DEFAULT_VOTE_LEAD_HOURS, DEFAULT_VOTE_WINDOW, type VoteWindow } from "./constants";
import { voteTime } from "./vote-time";

export type ScheduledSource = {
  eventId: string;
  home: string;
  away: string;
  sportKey: string;
  league: string | null;
  commenceTime: Date;
  voteTime: Date | null;
  createdAt: Date;
  asymmetryScore: number | null;
  discardReason: string | null;
};

export type ScheduledForecast = {
  eventId: string;
  sportKey: string;
  league: string;
  home: string;
  away: string;
  commenceTime: string;
  voteTime: string;
};

export function scheduledForecasts(input: {
  rows: readonly ScheduledSource[];
  publishedEventIds: ReadonlySet<string>;
  declinedEventIds?: ReadonlySet<string>;
  now: Date;
  voteWindow?: VoteWindow;
  leadHours?: number;
}): ScheduledForecast[] {
  const latest = new Map<string, number>();
  for (const row of input.rows) {
    const time = row.createdAt.getTime();
    if (time > (latest.get(row.eventId) ?? 0)) latest.set(row.eventId, time);
  }

  const chosen = new Map<string, ScheduledSource>();
  for (const row of input.rows) {
    const stamp = latest.get(row.eventId) ?? 0;
    if (stamp - row.createdAt.getTime() >= 5000 || row.asymmetryScore == null) continue;
    const current = chosen.get(row.eventId);
    if (!current || row.createdAt.getTime() >= current.createdAt.getTime()) chosen.set(row.eventId, row);
  }

  const window = input.voteWindow ?? DEFAULT_VOTE_WINDOW;
  const leadHours = input.leadHours ?? DEFAULT_VOTE_LEAD_HOURS;
  const result: ScheduledForecast[] = [];
  for (const row of chosen.values()) {
    if (input.publishedEventIds.has(row.eventId) || row.discardReason || input.declinedEventIds?.has(row.eventId)) continue;
    if (row.commenceTime.getTime() <= input.now.getTime()) continue;
    const at =
      row.voteTime ??
      voteTime({
        commenceTime: row.commenceTime,
        now: row.createdAt,
        leadHours,
        window,
      });
    result.push({
      eventId: row.eventId,
      sportKey: row.sportKey,
      league: row.league ?? row.sportKey,
      home: row.home,
      away: row.away,
      commenceTime: row.commenceTime.toISOString(),
      voteTime: at.toISOString(),
    });
  }
  return result.sort((left, right) => left.commenceTime.localeCompare(right.commenceTime));
}
