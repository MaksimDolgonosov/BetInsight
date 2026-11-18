import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { aiConsensus, aiVotes, events, modelEvaluations } from "@/server/db/schema";
import { samePoint } from "@/server/domain/predictions/publish";
import { gradePrediction } from "@/server/domain/settlement/grade";
import { leadingVirtualPick, summarizeVirtual, type VirtualMetrics, type VirtualSample } from "@/server/domain/stats/virtual";

export type VirtualConsensus = VirtualMetrics & {
  events: number;
  tied: number;
  unpriced: number;
};

const EMPTY: VirtualConsensus = {
  events: 0,
  tied: 0,
  unpriced: 0,
  count: 0,
  won: 0,
  lost: 0,
  void: 0,
  pending: 0,
  decided: 0,
  hitRate: null,
  profit: null,
  roi: null,
};

export async function loadVirtualNoConsensus(epochStartedAt: string | null): Promise<VirtualConsensus> {
  if (!process.env.DATABASE_URL) return EMPTY;
  const db = getDb();
  const epoch = epochStartedAt ? new Date(epochStartedAt) : null;
  const rows = await db
    .select()
    .from(aiConsensus)
    .where(and(eq(aiConsensus.source, "job"), eq(aiConsensus.status, "no_consensus"), epoch ? gte(aiConsensus.createdAt, epoch) : undefined))
    .orderBy(desc(aiConsensus.createdAt));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.eventId)) latest.set(row.eventId, row);
  }
  const decisions = [...latest.values()];
  if (decisions.length === 0) return EMPTY;

  const eventIds = decisions.map((row) => row.eventId);
  const [voteRows, eventRows, quoteRows] = await Promise.all([
    db.select().from(aiVotes).where(and(eq(aiVotes.source, "job"), inArray(aiVotes.eventId, eventIds))),
    db.select().from(events).where(inArray(events.id, eventIds)),
    db
      .select()
      .from(modelEvaluations)
      .where(and(eq(modelEvaluations.source, "job"), inArray(modelEvaluations.eventId, eventIds)))
      .orderBy(desc(modelEvaluations.createdAt)),
  ]);
  const votesById = new Map(voteRows.map((row) => [row.id, row]));
  const eventsById = new Map(eventRows.map((row) => [row.id, row]));
  const samples: VirtualSample[] = [];
  let tied = 0;
  let unpriced = 0;

  for (const decision of decisions) {
    const linked = decision.voteIds.flatMap((id) => {
      const vote = votesById.get(id);
      return vote ? [vote] : [];
    });
    const votes = linked.length > 0 ? linked : voteRows.filter((row) => row.eventId === decision.eventId);
    const pick = leadingVirtualPick(votes.map((vote) => ({ market: vote.market, selection: vote.selection, point: vote.point })));
    if (!pick) {
      tied += 1;
      continue;
    }
    const quote = quoteRows.find(
      (row) =>
        row.eventId === decision.eventId &&
        row.market === pick.market &&
        row.outcome === pick.selection &&
        samePoint(row.point, pick.point) &&
        row.bestPrice > 1,
    );
    const event = eventsById.get(decision.eventId);
    if (!quote || !event) {
      unpriced += 1;
      continue;
    }
    const graded = gradePrediction({
      sportKey: event.sportKey,
      eventStatus: event.status,
      market: pick.market,
      selection: pick.selection,
      point: pick.point,
      price: quote.bestPrice,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
    });
    if (graded.action === "wait") {
      samples.push({ status: "pending", price: quote.bestPrice, profitUnits: 0 });
      continue;
    }
    samples.push({ status: graded.status, price: quote.bestPrice, profitUnits: graded.profitUnits });
  }

  return { events: decisions.length, tied, unpriced, ...summarizeVirtual(samples) };
}
