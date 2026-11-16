const HOUR_MS = 60 * 60 * 1000;

export function inSelectionWindow(
  commenceTime: Date,
  now: Date,
  window: { minHours: number; maxHours: number },
): boolean {
  const commence = commenceTime.getTime();
  const start = now.getTime();
  if (!Number.isFinite(commence) || !Number.isFinite(start)) return false;
  if (!Number.isFinite(window.minHours) || !Number.isFinite(window.maxHours)) return false;
  if (window.minHours > window.maxHours) return false;
  const earliest = start + window.minHours * HOUR_MS;
  const latest = start + window.maxHours * HOUR_MS;
  return commence >= earliest && commence <= latest;
}
