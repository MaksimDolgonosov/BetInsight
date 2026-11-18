export type LeagueCandidate = {
  eventId: string;
  leagueKey: string;
  commenceTime: Date;
  asymmetryStrength: number;
};

export function applyLeagueQuota<T extends LeagueCandidate>(candidates: readonly T[], quota: number): T[] {
  if (!Number.isInteger(quota) || quota <= 0) return [];
  const ranked = [...candidates].sort(compareCandidates);
  const selected: T[] = [];
  const perLeague = new Map<string, number>();
  for (const candidate of ranked) {
    const count = perLeague.get(candidate.leagueKey) ?? 0;
    if (count >= quota) continue;
    selected.push(candidate);
    perLeague.set(candidate.leagueKey, count + 1);
  }
  return selected;
}

function compareCandidates(left: LeagueCandidate, right: LeagueCandidate): number {
  if (right.asymmetryStrength !== left.asymmetryStrength) return right.asymmetryStrength - left.asymmetryStrength;
  const time = left.commenceTime.getTime() - right.commenceTime.getTime();
  if (time !== 0) return time;
  if (left.eventId < right.eventId) return -1;
  if (left.eventId > right.eventId) return 1;
  return 0;
}
