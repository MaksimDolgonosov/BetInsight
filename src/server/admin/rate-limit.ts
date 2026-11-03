export const TEST_RUN_INTERVAL_MS = 5 * 60 * 1000;

export function testRunAllowance(input: {
  now: Date;
  lastRunAt: string | null;
  runsToday: number;
  dailyLimit: number;
  minIntervalMs?: number;
}): { ok: true } | { ok: false; reason: "interval" | "daily" } {
  if (input.runsToday >= input.dailyLimit) {
    return { ok: false, reason: "daily" };
  }
  if (input.lastRunAt) {
    const elapsed = input.now.getTime() - new Date(input.lastRunAt).getTime();
    if (elapsed < (input.minIntervalMs ?? TEST_RUN_INTERVAL_MS)) {
      return { ok: false, reason: "interval" };
    }
  }
  return { ok: true };
}
