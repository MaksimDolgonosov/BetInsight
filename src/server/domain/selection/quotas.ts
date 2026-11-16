export type DailyQuotas = {
  perLeague: number;
  tennis: number;
};

export type QuotaCandidate = {
  eventId: string;
  sportKey: string;
  leagueKey: string;
  commenceTime: Date;
  significanceScore: number;
  finalScore: number;
};

export function isTennisSport(sportKey: string): boolean {
  return sportKey.startsWith("tennis_");
}

export function applyDailyQuotas<T extends QuotaCandidate>(
  candidates: readonly T[],
  options: { dailyLimit: number; quotas: DailyQuotas },
): T[] {
  if (options.dailyLimit <= 0 || options.quotas.perLeague <= 0) return [];
  const ranked = [...candidates].sort(compareCandidates);
  const selected: T[] = [];
  const perLeague = new Map<string, number>();
  let tennis = 0;

  for (const candidate of ranked) {
    if (selected.length >= options.dailyLimit) break;
    const leagueCount = perLeague.get(candidate.leagueKey) ?? 0;
    if (leagueCount >= options.quotas.perLeague) continue;
    const tennisMatch = isTennisSport(candidate.sportKey);
    if (tennisMatch && tennis >= options.quotas.tennis) continue;
    selected.push(candidate);
    perLeague.set(candidate.leagueKey, leagueCount + 1);
    if (tennisMatch) tennis += 1;
  }

  return selected;
}

function compareCandidates(left: QuotaCandidate, right: QuotaCandidate): number {
  if (right.finalScore !== left.finalScore) return right.finalScore - left.finalScore;
  if (right.significanceScore !== left.significanceScore) return right.significanceScore - left.significanceScore;
  const time = left.commenceTime.getTime() - right.commenceTime.getTime();
  if (time !== 0) return time;
  if (left.eventId < right.eventId) return -1;
  if (left.eventId > right.eventId) return 1;
  return 0;
}
