export const JOB_STALE_MS = 5 * 60 * 1000;

export function claimDecision(
  existing: { status: string; startedAt: string | null } | null,
  now: Date,
  staleMs = JOB_STALE_MS,
): "insert" | "duplicate" | "busy" | "retry" {
  if (!existing) return "insert";
  if (existing.status === "succeeded") return "duplicate";
  if (existing.status === "failed") return "retry";
  if (existing.status === "running") {
    if (!existing.startedAt) return "retry";
    const age = now.getTime() - new Date(existing.startedAt).getTime();
    return age >= staleMs ? "retry" : "busy";
  }
  return "retry";
}
