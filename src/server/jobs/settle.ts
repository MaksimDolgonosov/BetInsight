import "server-only";
import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/server/db";
import { events, predictions } from "@/server/db/schema";
import { settlementsFor } from "@/server/domain/settlement/grade";
import { JobInputError } from "@/server/jobs/errors";
import { runJob, type JobOutcome } from "@/server/jobs/runner";

const payloadSchema = z.object({
  sportKey: z.string().regex(/^[a-z0-9_]{3,80}$/),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  purpose: z.enum(["opening", "closing", "retry"]),
});

export async function runSettle(payload: unknown, now = new Date()): Promise<JobOutcome> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success || parsed.data.purpose === "opening") throw new JobInputError("invalid_payload");
  const { sportKey, day, purpose } = parsed.data;
  return runJob({
    job: "settle",
    idempotencyKey: `settle:${sportKey}:${day}:${purpose}`,
    payload,
    now,
    work: () => settleSport(sportKey, now),
  });
}

async function settleSport(sportKey: string, now: Date): Promise<JobOutcome> {
  const db = getDb();
  const pending = await db
    .select({
      id: predictions.id,
      sportKey: events.sportKey,
      eventStatus: events.status,
      market: predictions.market,
      selection: predictions.selection,
      point: predictions.point,
      price: predictions.price,
      homeScore: events.homeScore,
      awayScore: events.awayScore,
    })
    .from(predictions)
    .innerJoin(events, eq(predictions.eventId, events.id))
    .where(and(eq(predictions.status, "pending"), eq(events.sportKey, sportKey)));

  const ready = settlementsFor(pending);
  for (const row of ready) {
    await db
      .update(predictions)
      .set({ status: row.status, profitUnits: row.profitUnits, settledAt: now })
      .where(and(eq(predictions.id, row.id), eq(predictions.status, "pending")));
  }
  if (ready.length > 0) revalidatePublicStats();
  return { status: "done", detail: { pending: pending.length, settled: ready.length, waiting: pending.length - ready.length } };
}

function revalidatePublicStats() {
  try {
    revalidateTag("public-stats", "max");
  } catch {
    return;
  }
}
