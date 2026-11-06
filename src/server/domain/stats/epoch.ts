export function inStatsEpoch(
  at: string | Date | null | undefined,
  epochStartedAt: string | Date | null | undefined,
): boolean {
  if (at == null) return false;
  if (epochStartedAt == null) return true;
  const time = at instanceof Date ? at.getTime() : Date.parse(at);
  const epoch = epochStartedAt instanceof Date ? epochStartedAt.getTime() : Date.parse(epochStartedAt);
  if (!Number.isFinite(time) || !Number.isFinite(epoch)) return false;
  return time >= epoch;
}

export function countEpoch(
  dates: Array<string | Date | null | undefined>,
  epochStartedAt: string | Date | null,
): { included: number; archived: number } {
  let included = 0;
  let archived = 0;
  for (const at of dates) {
    if (at == null) continue;
    if (inStatsEpoch(at, epochStartedAt)) included += 1;
    else archived += 1;
  }
  return { included, archived };
}
