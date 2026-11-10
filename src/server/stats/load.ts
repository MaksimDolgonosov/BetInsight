import "server-only";
import { and, count, countDistinct, desc, eq, gte, inArray } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "@/server/db";
import { aiConsensus, aiRequests, aiVotes, appSettings, events, modelEvaluations, predictions, sports } from "@/server/db/schema";
import { oddsSnapshots } from "@/server/db/data-tables";
import { quoteTable, type QuoteTable } from "@/server/domain/odds/lines";
import { samePoint } from "@/server/domain/predictions/publish";
import { gradePrediction } from "@/server/domain/settlement/grade";
import { inStatsEpoch } from "@/server/domain/stats/epoch";
import type { BaselineBet, ModelVoteBet, PublicPick, StatsTrack } from "@/server/domain/stats/metrics";

export type PublicFunnel = {
  events: number;
  candidates: number;
  filtered: number;
};

export type PublicBoard = {
  available: boolean;
  epochStartedAt: string | null;
  picks: PublicPick[];
  baselines: BaselineBet[];
  votes: ModelVoteBet[];
  funnel: PublicFunnel;
};

const EMPTY_FUNNEL: PublicFunnel = { events: 0, candidates: 0, filtered: 0 };

export function emptyBoard(): PublicBoard {
  return { available: true, epochStartedAt: null, picks: [], baselines: [], votes: [], funnel: EMPTY_FUNNEL };
}

const readCachedBoard = unstable_cache(readBoard, ["public-stats-board"], {
  tags: ["public-stats"],
  revalidate: 3600,
});

export async function loadPublicBoard(): Promise<PublicBoard> {
  if (!process.env.DATABASE_URL) return emptyBoard();
  try {
    return await readCachedBoard();
  } catch (error) {
    console.error("public stats unavailable", error instanceof Error ? error.message : "failed");
    return { ...emptyBoard(), available: false };
  }
}

async function readBoard(): Promise<PublicBoard> {
  const db = getDb();
  const [settings] = await db.select({ epoch: appSettings.statsEpochStartedAt }).from(appSettings).limit(1);
  const epochStartedAt = settings?.epoch ?? null;
  const joined = await db
    .select({
      id: predictions.id,
      eventId: predictions.eventId,
      track: predictions.track,
      sportKey: events.sportKey,
      league: sports.title,
      home: events.home,
      away: events.away,
      market: predictions.market,
      selection: predictions.selection,
      point: predictions.point,
      price: predictions.price,
      bookmaker: predictions.bookmaker,
      status: predictions.status,
      profitUnits: predictions.profitUnits,
      aiProb: predictions.aiProb,
      confidence: predictions.confidence,
      llmModel: predictions.llmModel,
      promptVersion: predictions.promptVersion,
      publishedAt: predictions.publishedAt,
      settledAt: predictions.settledAt,
      commenceTime: events.commenceTime,
      ev: predictions.ev,
      hash: predictions.hash,
      eventStatus: events.status,
      homeScore: events.homeScore,
      awayScore: events.awayScore,
      completedAt: events.completedAt,
    })
    .from(predictions)
    .innerJoin(events, eq(predictions.eventId, events.id))
    .leftJoin(sports, eq(events.sportKey, sports.key));

  const picks = joined.flatMap((row) => {
    const status = asStatus(row.status);
    const track = asTrack(row.track);
    if (track !== "ai_pick" || !status || !row.publishedAt || !inStatsEpoch(row.publishedAt, epochStartedAt)) return [];
    return [{ ...row, status, track, publishedAt: row.publishedAt }];
  });
  const funnel = await readFunnel(epochStartedAt);
  if (picks.length === 0) {
    return { available: true, epochStartedAt: epochStartedAt?.toISOString() ?? null, picks: [], baselines: [], votes: [], funnel };
  }

  const eventIds = [...new Set(picks.map((row) => row.eventId))];
  const [evaluations, voteRows, consensusRows, closingRows, searchRows] = await Promise.all([
    db.select().from(modelEvaluations).where(and(eq(modelEvaluations.source, "job"), inArray(modelEvaluations.eventId, eventIds))),
    db.select().from(aiVotes).where(and(eq(aiVotes.source, "job"), inArray(aiVotes.eventId, eventIds))),
    db.select().from(aiConsensus).where(and(eq(aiConsensus.source, "job"), inArray(aiConsensus.eventId, eventIds))),
    db.select().from(oddsSnapshots).where(and(eq(oddsSnapshots.isClosing, true), inArray(oddsSnapshots.eventId, eventIds))),
    db
      .select({ eventId: aiRequests.eventId, purpose: aiRequests.purpose })
      .from(aiRequests)
      .where(and(eq(aiRequests.source, "job"), eq(aiRequests.webSearch, true), inArray(aiRequests.eventId, eventIds))),
  ]);

  const latest = latestByEvent(evaluations);
  const valueSearch = new Set(searchRows.filter((row) => row.purpose === "value_check" && row.eventId).map((row) => row.eventId));
  const researchSearch = new Set(searchRows.filter((row) => row.purpose === "research" && row.eventId).map((row) => row.eventId));
  const closing = latestClosing(closingRows);

  const publicPicks: PublicPick[] = picks.map((row) => {
    const consensus = consensusFor(consensusRows, row.eventId, row.id);
    return {
      id: row.id,
      eventId: row.eventId,
      track: row.track,
      sportKey: row.sportKey,
      league: row.league ?? row.sportKey,
      home: row.home,
      away: row.away,
      market: row.market,
      selection: row.selection,
      point: row.point,
      price: row.price,
      bookmaker: row.bookmaker,
      status: row.status,
      profitUnits: row.profitUnits,
      aiProb: row.aiProb,
      confidence: row.confidence,
      llmModel: row.llmModel,
      promptVersion: row.promptVersion,
      webSearch: row.track === "ai_pick" ? researchSearch.has(row.eventId) : valueSearch.has(row.eventId),
      publishedAt: row.publishedAt.toISOString(),
      settledAt: row.settledAt?.toISOString() ?? null,
      hash: row.hash,
      matchesMarketFavorite: consensus?.matchesMarketFavorite ?? null,
      unanimous: consensus ? consensus.votesTotal >= 2 && consensus.votesFor === consensus.votesTotal : null,
      closingPrice: closing.get(quoteKey(row.eventId, row.market, row.selection, row.point)) ?? null,
      commenceTime: row.commenceTime.toISOString(),
      ev: row.ev,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
    };
  });

  const seenEvents = new Set<string>();
  const baselines: BaselineBet[] = [];
  for (const row of picks) {
    if (seenEvents.has(row.eventId)) continue;
    seenEvents.add(row.eventId);
    const batch = latest.filter((item) => item.eventId === row.eventId);
    const at = (row.completedAt ?? row.publishedAt).toISOString();
    const favorite = [...batch].filter((item) => item.market === "h2h").sort((left, right) => right.consensusProb - left.consensusProb)[0];
    const model = [...batch].filter((item) => item.isCandidate).sort((left, right) => right.ev - left.ev || right.consensusProb - left.consensusProb)[0];
    const favoriteBet = gradedBaseline(row, favorite, "favorite", at);
    const modelBet = gradedBaseline(row, model, "model", at);
    if (favoriteBet) baselines.push(favoriteBet);
    if (modelBet) baselines.push(modelBet);
  }

  const votes: ModelVoteBet[] = [];
  for (const vote of voteRows) {
    const event = picks.find((row) => row.eventId === vote.eventId);
    const quote = latest.find(
      (item) =>
        item.eventId === vote.eventId &&
        item.market === vote.market &&
        item.outcome === vote.selection &&
        samePoint(item.point, vote.point) &&
        item.bestPrice > 1,
    );
    if (!event || !quote) continue;
    const graded = gradePrediction({
      sportKey: event.sportKey,
      eventStatus: event.eventStatus,
      market: vote.market,
      selection: vote.selection,
      point: vote.point,
      price: quote.bestPrice,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
    });
    if (graded.action !== "settle") continue;
    votes.push({
      eventId: vote.eventId,
      model: vote.model,
      price: quote.bestPrice,
      probability: probabilityFor(vote.probabilities, vote.market, vote.selection, vote.point),
      status: graded.status,
      profitUnits: graded.profitUnits,
      at: (event.completedAt ?? event.publishedAt).toISOString(),
    });
  }

  return {
    available: true,
    epochStartedAt: epochStartedAt?.toISOString() ?? null,
    picks: publicPicks,
    baselines,
    votes,
    funnel,
  };
}

async function readFunnel(epoch: Date | null): Promise<PublicFunnel> {
  try {
    const db = getDb();
    const [eventRow, candidateRow, filteredRow] = await Promise.all([
      db.select({ value: count() }).from(events).where(epoch ? gte(events.commenceTime, epoch) : undefined),
      db
        .select({ value: countDistinct(modelEvaluations.eventId) })
        .from(modelEvaluations)
        .where(and(eq(modelEvaluations.source, "job"), eq(modelEvaluations.aiPickShortlisted, true), epoch ? gte(modelEvaluations.createdAt, epoch) : undefined)),
      db
        .select({ value: countDistinct(aiConsensus.eventId) })
        .from(aiConsensus)
        .where(and(eq(aiConsensus.source, "job"), eq(aiConsensus.status, "no_consensus"), epoch ? gte(aiConsensus.createdAt, epoch) : undefined)),
    ]);
    return {
      events: Number(eventRow[0]?.value ?? 0),
      candidates: Number(candidateRow[0]?.value ?? 0),
      filtered: Number(filteredRow[0]?.value ?? 0),
    };
  } catch (error) {
    console.error("public funnel unavailable", error instanceof Error ? error.message : "failed");
    return EMPTY_FUNNEL;
  }
}

function gradedBaseline(
  event: {
    eventId: string;
    sportKey: string;
    eventStatus: string;
    homeScore: number | null;
    awayScore: number | null;
  },
  quote: { market: string; outcome: string; point: number | null; bestPrice: number; consensusProb: number } | undefined,
  kind: BaselineBet["kind"],
  at: string,
): BaselineBet | null {
  if (!quote || !(quote.bestPrice > 1)) return null;
  const graded = gradePrediction({
    sportKey: event.sportKey,
    eventStatus: event.eventStatus,
    market: quote.market,
    selection: quote.outcome,
    point: quote.point,
    price: quote.bestPrice,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
  });
  if (graded.action !== "settle") return null;
  return {
    eventId: event.eventId,
    kind,
    price: quote.bestPrice,
    probability: quote.consensusProb,
    status: graded.status,
    profitUnits: graded.profitUnits,
    at,
  };
}

function consensusFor(rows: (typeof aiConsensus.$inferSelect)[], eventId: string, predictionId: string) {
  const matches = rows.filter((row) => row.eventId === eventId);
  return matches.find((row) => row.predictionId === predictionId) ?? matches.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;
}

function latestClosing(rows: (typeof oddsSnapshots.$inferSelect)[]): Map<string, number> {
  const map = new Map<string, { at: number; price: number }>();
  for (const row of rows) {
    const key = quoteKey(row.eventId, row.market, row.outcome, row.point);
    const current = map.get(key);
    if (!current || row.fetchedAt.getTime() >= current.at) map.set(key, { at: row.fetchedAt.getTime(), price: row.price });
  }
  return new Map([...map.entries()].map(([key, value]) => [key, value.price]));
}

function latestByEvent<T extends { eventId: string; createdAt: Date }>(rows: T[]): T[] {
  const latest = new Map<string, number>();
  for (const row of rows) {
    const time = row.createdAt.getTime();
    if (time > (latest.get(row.eventId) ?? 0)) latest.set(row.eventId, time);
  }
  return rows.filter((row) => (latest.get(row.eventId) ?? 0) - row.createdAt.getTime() < 5000);
}

function probabilityFor(raw: unknown, market: string, selection: string, point: number | null): number | null {
  if (!Array.isArray(raw)) return null;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { market?: unknown; selection?: unknown; point?: unknown; p?: unknown };
    if (row.market !== market || row.selection !== selection || typeof row.p !== "number") continue;
    const votePoint = typeof row.point === "number" ? row.point : null;
    if (!samePoint(votePoint, point)) continue;
    return row.p;
  }
  return null;
}

function quoteKey(eventId: string, market: string, selection: string, point: number | null): string {
  return `${eventId}|${market}|${selection}|${point ?? ""}`;
}

function asStatus(value: string): PublicPick["status"] | null {
  if (value === "pending" || value === "won" || value === "lost" || value === "void") return value;
  return null;
}

function asTrack(value: string): StatsTrack | null {
  if (value === "ai_pick") return value;
  return null;
}

export type MarketQuote = {
  market: string;
  selection: string;
  point: number | null;
  consensusProb: number;
  bestPrice: number;
  bestBookmaker: string;
  ev: number;
  candidate: boolean;
};

export type PublicEvent = {
  region: string;
  snapshotAt: string | null;
  bookmakers: number;
  table: QuoteTable;
  line: MarketQuote[];
  pick: PublicPick & { reasoningRu: string | null; reasoningEn: string | null; modelProb: number | null };
  focus: MarketQuote | null;
  other: { market: string; point: number | null; quotes: MarketQuote[]; skipped: boolean } | null;
};

const EVENT_ID = /^[A-Za-z0-9_-]{1,128}$/;

export async function loadPublicEvent(eventId: string): Promise<PublicEvent | null> {
  if (!EVENT_ID.test(eventId) || !process.env.DATABASE_URL) return null;
  try {
    return await unstable_cache(() => readEvent(eventId), ["public-event", eventId], {
      tags: ["public-stats"],
      revalidate: 3600,
    })();
  } catch (error) {
    console.error("public event unavailable", error instanceof Error ? error.message : "failed");
    return null;
  }
}

async function readEvent(eventId: string): Promise<PublicEvent | null> {
  const db = getDb();
  const [settings] = await db
    .select({ region: appSettings.region, epoch: appSettings.statsEpochStartedAt })
    .from(appSettings)
    .limit(1);
  const [row] = await db
    .select({
      id: predictions.id,
      eventId: predictions.eventId,
      track: predictions.track,
      sportKey: events.sportKey,
      league: sports.title,
      home: events.home,
      away: events.away,
      market: predictions.market,
      selection: predictions.selection,
      point: predictions.point,
      price: predictions.price,
      bookmaker: predictions.bookmaker,
      status: predictions.status,
      profitUnits: predictions.profitUnits,
      modelProb: predictions.modelProb,
      aiProb: predictions.aiProb,
      confidence: predictions.confidence,
      reasoningRu: predictions.reasoningRu,
      reasoningEn: predictions.reasoningEn,
      llmModel: predictions.llmModel,
      promptVersion: predictions.promptVersion,
      publishedAt: predictions.publishedAt,
      settledAt: predictions.settledAt,
      hash: predictions.hash,
      eventStatus: events.status,
      homeScore: events.homeScore,
      awayScore: events.awayScore,
      completedAt: events.completedAt,
      commenceTime: events.commenceTime,
      ev: predictions.ev,
    })
    .from(predictions)
    .innerJoin(events, eq(predictions.eventId, events.id))
    .leftJoin(sports, eq(events.sportKey, sports.key))
    .where(and(eq(predictions.eventId, eventId), eq(predictions.track, "ai_pick")))
    .orderBy(desc(predictions.publishedAt))
    .limit(1);

  const status = row ? asStatus(row.status) : null;
  if (!row || !status || !row.publishedAt || !inStatsEpoch(row.publishedAt, settings?.epoch ?? null)) return null;

  const [snapshots, evaluations, closingRows, searchRows, consensusRows] = await Promise.all([
    db.select().from(oddsSnapshots).where(eq(oddsSnapshots.eventId, eventId)),
    db.select().from(modelEvaluations).where(and(eq(modelEvaluations.eventId, eventId), eq(modelEvaluations.source, "job"))),
    db.select().from(oddsSnapshots).where(and(eq(oddsSnapshots.eventId, eventId), eq(oddsSnapshots.isClosing, true))),
    db
      .select({ purpose: aiRequests.purpose })
      .from(aiRequests)
      .where(and(eq(aiRequests.eventId, eventId), eq(aiRequests.source, "job"), eq(aiRequests.webSearch, true))),
    db.select().from(aiConsensus).where(and(eq(aiConsensus.eventId, eventId), eq(aiConsensus.source, "job"))),
  ]);

  const batch = snapshotBatch(snapshots, row.publishedAt);
  const focusQuotes = batch.filter((item) => sameQuoteLine(item.market, item.outcome, item.point, row.market, row.selection, row.point));
  const table = quoteTable(focusQuotes.map((item) => ({ bookmaker: item.bookmaker, selection: item.outcome, price: item.price })));
  const latest = latestByEvent(evaluations);
  const quotes = latest.map(asMarketQuote);
  const line = quotes.filter((item) => sameQuoteLine(item.market, item.selection, item.point, row.market, row.selection, row.point));
  const focus = line.find((item) => item.selection === row.selection) ?? null;
  const other = otherMarket(row.market, quotes);
  const consensus = consensusFor(consensusRows, eventId, row.id);
  const closing = latestClosing(closingRows);

  return {
    region: (settings?.region ?? "eu").toUpperCase(),
    snapshotAt: batch.length > 0 ? new Date(Math.max(...batch.map((item) => item.fetchedAt.getTime()))).toISOString() : null,
    bookmakers: new Set(focusQuotes.map((item) => item.bookmaker)).size,
    table,
    line,
    focus,
    other,
    pick: {
      id: row.id,
      eventId: row.eventId,
      track: "ai_pick",
      sportKey: row.sportKey,
      league: row.league ?? row.sportKey,
      home: row.home,
      away: row.away,
      market: row.market,
      selection: row.selection,
      point: row.point,
      price: row.price,
      bookmaker: row.bookmaker,
      status,
      profitUnits: row.profitUnits,
      aiProb: row.aiProb,
      confidence: row.confidence,
      llmModel: row.llmModel,
      promptVersion: row.promptVersion,
      webSearch: searchRows.some((item) => item.purpose === "research"),
      publishedAt: row.publishedAt.toISOString(),
      settledAt: row.settledAt?.toISOString() ?? null,
      hash: row.hash,
      matchesMarketFavorite: consensus?.matchesMarketFavorite ?? null,
      unanimous: consensus ? consensus.votesTotal >= 2 && consensus.votesFor === consensus.votesTotal : null,
      closingPrice: closing.get(quoteKey(row.eventId, row.market, row.selection, row.point)) ?? null,
      commenceTime: row.commenceTime.toISOString(),
      ev: row.ev,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      reasoningRu: row.reasoningRu,
      reasoningEn: row.reasoningEn,
      modelProb: row.modelProb,
    },
  };
}

function snapshotBatch(rows: (typeof oddsSnapshots.$inferSelect)[], publishedAt: Date) {
  const opening = rows.filter((row) => !row.isClosing && row.fetchedAt.getTime() <= publishedAt.getTime());
  const pool = opening.length > 0 ? opening : rows.filter((row) => !row.isClosing);
  const source = pool.length > 0 ? pool : rows;
  if (source.length === 0) return [];
  const latest = Math.max(...source.map((row) => row.fetchedAt.getTime()));
  return source.filter((row) => latest - row.fetchedAt.getTime() < 5000);
}

function asMarketQuote(row: typeof modelEvaluations.$inferSelect): MarketQuote {
  return {
    market: row.market,
    selection: row.outcome,
    point: row.point,
    consensusProb: row.consensusProb,
    bestPrice: row.bestPrice,
    bestBookmaker: row.bestBookmaker,
    ev: row.ev,
    candidate: row.isCandidate,
  };
}

function otherMarket(market: string, quotes: MarketQuote[]) {
  const others = quotes.filter((item) => item.market !== market);
  const line = [...others].sort((left, right) => right.ev - left.ev)[0];
  if (!line) return null;
  const paired = others.filter((item) => sameQuoteLine(item.market, item.selection, item.point, line.market, line.selection, line.point));
  return {
    market: line.market,
    point: line.point,
    quotes: paired,
    skipped: !paired.some((item) => item.candidate),
  };
}

function sameQuoteLine(
  market: string,
  selection: string,
  point: number | null,
  focusMarket: string,
  focusSelection: string,
  focusPoint: number | null,
): boolean {
  if (market !== focusMarket) return false;
  if (market !== "spreads") return samePoint(point, focusPoint);
  if (point == null || focusPoint == null) return false;
  return samePoint(point, focusPoint) || samePoint(point, focusSelection === "home" || focusSelection === "away" ? -focusPoint : focusPoint);
}
