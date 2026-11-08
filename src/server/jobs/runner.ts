import "server-only";
import { and, eq, lt, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { jobRuns } from "@/server/db/schema";
import { claimDecision, JOB_STALE_MS } from "@/server/jobs/claim";
import { JobBusyError } from "@/server/jobs/errors";
import { withJobLock } from "@/server/jobs/lock";

export type JobOutcome = {
  status: "done" | "duplicate" | "skipped";
  detail?: Record<string, unknown>;
};

export async function runJob(input: {
  job: string;
  idempotencyKey: string;
  payload: unknown;
  now: Date;
  work: () => Promise<JobOutcome>;
}): Promise<JobOutcome> {
  return withJobLock(input.idempotencyKey, async () => {
    const existing = await loadRun(input.idempotencyKey);
    const decision = claimDecision(existing, input.now);
    if (decision === "duplicate") return { status: "duplicate" };
    if (decision === "busy") throw new JobBusyError();
    if (decision === "insert") {
      const inserted = await getDb()
        .insert(jobRuns)
        .values({
          job: input.job,
          idempotencyKey: input.idempotencyKey,
          status: "running",
          startedAt: input.now,
          payload: input.payload,
        })
        .onConflictDoNothing()
        .returning({ id: jobRuns.id });
      if (inserted.length === 0) {
        const again = claimDecision(await loadRun(input.idempotencyKey), input.now);
        if (again === "duplicate") return { status: "duplicate" };
        if (again !== "retry") throw new JobBusyError();
        await markRetry(input.idempotencyKey, input.now);
      }
    } else {
      await markRetry(input.idempotencyKey, input.now);
    }

    try {
      const outcome = await input.work();
      await finish(input.idempotencyKey, "succeeded", null, input.now);
      return outcome;
    } catch (error) {
      await finish(input.idempotencyKey, "failed", errorText(error), input.now);
      throw error;
    }
  });
}

async function loadRun(idempotencyKey: string) {
  const [row] = await getDb()
    .select({ status: jobRuns.status, startedAt: jobRuns.startedAt })
    .from(jobRuns)
    .where(eq(jobRuns.idempotencyKey, idempotencyKey))
    .limit(1);
  if (!row) return null;
  return { status: row.status, startedAt: row.startedAt?.toISOString() ?? null };
}

async function markRetry(idempotencyKey: string, now: Date) {
  const stale = new Date(now.getTime() - JOB_STALE_MS);
  const updated = await getDb()
    .update(jobRuns)
    .set({ status: "running", startedAt: now, finishedAt: null, error: null })
    .where(
      and(
        eq(jobRuns.idempotencyKey, idempotencyKey),
        or(eq(jobRuns.status, "failed"), and(eq(jobRuns.status, "running"), lt(jobRuns.startedAt, stale))),
      ),
    )
    .returning({ id: jobRuns.id });
  if (updated.length === 0) throw new JobBusyError();
}

async function finish(idempotencyKey: string, status: "succeeded" | "failed", error: string | null, now: Date) {
  await getDb()
    .update(jobRuns)
    .set({ status, error, finishedAt: now })
    .where(eq(jobRuns.idempotencyKey, idempotencyKey));
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : "failed";
  return message.slice(0, 500);
}
