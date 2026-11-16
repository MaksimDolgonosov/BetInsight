import "server-only";
import { and, desc, eq, gt, gte, inArray, lt, lte, or, sql } from "drizzle-orm";
import { budgetSnapshot, canSpend, startOfUtcDay, startOfUtcMonth } from "@/server/budget/budget";
import { absentScoreIds } from "@/server/jobs/plan";
import { alertBudget } from "@/server/integrations/telegram/alerts";
import { getDb } from "@/server/db";
import { apiPayloads, oddsSnapshots } from "@/server/db/data-tables";
import { apiUsage, auditLog, events, modelEvaluations, rivalryPairs, sports, teamMeta } from "@/server/db/schema";
import type { NormalizedQuote, Selection } from "@/server/domain/odds/evaluate";
import { isRoundStage, ROUND_BOARD_HOURS, SELECTION_MARKET, type ScoredEvent } from "@/server/domain/selection";
import { MARKETS, type Market } from "@/server/domain/settings";
import type { ModelRow } from "@/server/jobs/evaluate";
import { attachResearchScores, attachSelectionScores, selectionScore, type SelectionEvent } from "@/server/jobs/selection";
import type { OddsEvent } from "@/server/integrations/odds-api/schema";
import type { ScoreEvent, TrackedSport, UpcomingEvent } from "@/server/integrations/odds-api/schema";

export async function enabledLeagues() {
  const rows = await getDb().select().from(sports);
  return rows.filter((row) => row.enabledByAdmin && row.active);
}

export async function saveSports(tracked: TrackedSport[]) {
  const db = getDb();
  for (const sport of tracked) {
    await db
      .insert(sports)
      .values({
        key: sport.key,
        group: sport.group,
        title: sport.title,
        active: sport.active,
        enabledByAdmin: true,
      })
      .onConflictDoUpdate({
        target: sports.key,
        set: { group: sport.group, title: sport.title, active: sport.active },
      });
  }

  const activeTennis = tracked.filter((sport) => sport.group === "tennis" && sport.active).map((sport) => sport.key);
  if (activeTennis.length === 0) {
    await db.update(sports).set({ active: false }).where(eq(sports.group, "tennis"));
    return;
  }
  const current = await db.select({ key: sports.key }).from(sports).where(eq(sports.group, "tennis"));
  const stale = current.map((row) => row.key).filter((key) => !activeTennis.includes(key));
  if (stale.length > 0) {
    await db.update(sports).set({ active: false }).where(inArray(sports.key, stale));
  }
}

export async function saveUpcomingEvents(rows: UpcomingEvent[]) {
  if (rows.length === 0) return;
  const db = getDb();
  const ids = rows.map((row) => row.id);
  const existing = await db.select({ id: events.id, status: events.status }).from(events).where(inArray(events.id, ids));
  const completed = new Set(existing.filter((row) => row.status === "completed" || row.status === "void").map((row) => row.id));
  const fresh = rows.filter((row) => !completed.has(row.id));
  if (fresh.length === 0) return;
  await db
    .insert(events)
    .values(
      fresh.map((row) => ({
        id: row.id,
        sportKey: row.sportKey,
        home: row.home,
        away: row.away,
        commenceTime: new Date(row.commenceTime),
        status: "scheduled",
      })),
    )
    .onConflictDoUpdate({
      target: events.id,
      set: {
        sportKey: sql`excluded.sport_key`,
        home: sql`excluded.home`,
        away: sql`excluded.away`,
        commenceTime: sql`excluded.commence_time`,
      },
    });
}

export async function saveOdds(rows: OddsEvent[], fetchedAt: Date, options?: { closing?: boolean }) {
  await saveUpcomingEvents(rows);
  const quotes = rows.flatMap((event) =>
    event.quotes.map((quote) => ({
      eventId: event.id,
      fetchedAt,
      bookmaker: quote.bookmaker,
      market: quote.market,
      outcome: quote.selection,
      point: quote.point,
      price: quote.price,
      isClosing: options?.closing ?? false,
    })),
  );
  if (quotes.length === 0) return;
  await getDb().insert(oddsSnapshots).values(quotes);
}

export async function saveScores(rows: ScoreEvent[], now: Date) {
  const db = getDb();
  for (const row of rows) {
    if (!row.completed || row.homeScore == null || row.awayScore == null) continue;
    await db
      .insert(events)
      .values({
        id: row.id,
        sportKey: row.sportKey,
        home: row.home,
        away: row.away,
        commenceTime: new Date(row.commenceTime),
        status: "completed",
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        completedAt: now,
        missingFromScores: false,
      })
      .onConflictDoUpdate({
        target: events.id,
        set: {
          status: "completed",
          homeScore: row.homeScore,
          awayScore: row.awayScore,
          completedAt: now,
          missingFromScores: false,
        },
      });
  }
}

const MARKET_SET = new Set<Market>(MARKETS);
const SELECTIONS = new Set<Selection>(["home", "draw", "away", "over", "under"]);

export async function loadLatestOdds(sportKey: string): Promise<{ id: string; home: string; away: string; quotes: NormalizedQuote[] }[]> {
  const db = getDb();
  const leagueEvents = await db.select().from(events).where(eq(events.sportKey, sportKey));
  if (leagueEvents.length === 0) return [];
  const snaps = await db
    .select()
    .from(oddsSnapshots)
    .where(inArray(oddsSnapshots.eventId, leagueEvents.map((event) => event.id)));
  const latest = new Map<string, number>();
  for (const snap of snaps) {
    const time = snap.fetchedAt.getTime();
    const current = latest.get(snap.eventId) ?? 0;
    if (time > current) latest.set(snap.eventId, time);
  }

  return leagueEvents.flatMap((event) => {
    const fetchedAt = latest.get(event.id);
    if (fetchedAt == null) return [];
    const quotes = snaps.flatMap((snap): NormalizedQuote[] => {
      if (snap.eventId !== event.id || snap.fetchedAt.getTime() !== fetchedAt) return [];
      if (!MARKET_SET.has(snap.market as Market) || !SELECTIONS.has(snap.outcome as Selection)) return [];
      return [{
        bookmakerKey: snap.bookmaker.toLowerCase(),
        bookmaker: snap.bookmaker,
        market: snap.market as Market,
        selection: snap.outcome as Selection,
        point: snap.point,
        price: snap.price,
      }];
    });
    if (quotes.length === 0) return [];
    return [{ id: event.id, home: event.home, away: event.away, quotes }];
  });
}

export async function replaceJobEvaluations(eventIds: string[], rows: ModelRow[], now: Date) {
  const db = getDb();
  const since = startOfUtcDay(now);
  const prior = eventIds.length === 0 ? [] : await db
    .select({
      eventId: modelEvaluations.eventId,
      significanceScore: modelEvaluations.significanceScore,
      formHome: modelEvaluations.formHome,
      formAway: modelEvaluations.formAway,
      formDelta: modelEvaluations.formDelta,
      formBonus: modelEvaluations.formBonus,
      finalScore: modelEvaluations.finalScore,
      formSource: modelEvaluations.formSource,
      roundStage: modelEvaluations.roundStage,
      dataScore: modelEvaluations.dataScore,
      researchSummary: modelEvaluations.researchSummary,
      discardReason: modelEvaluations.discardReason,
      lowConfidence: modelEvaluations.lowConfidence,
    })
    .from(modelEvaluations)
    .where(and(eq(modelEvaluations.source, "job"), inArray(modelEvaluations.eventId, eventIds), gte(modelEvaluations.createdAt, since)));
  if (eventIds.length > 0) {
    await db
      .delete(modelEvaluations)
      .where(and(eq(modelEvaluations.source, "job"), inArray(modelEvaluations.eventId, eventIds), gte(modelEvaluations.createdAt, since)));
  }
  if (rows.length === 0) return [];
  const scored = attachResearchScores(attachSelectionScores(rows, prior.flatMap((row) => {
    if (row.formSource !== "calculated" && row.formSource !== "insufficient_data") return [];
    return [{ ...row, formSource: row.formSource, roundStage: isRoundStage(row.roundStage) ? row.roundStage : null }];
  })), prior);
  await db.insert(modelEvaluations).values(scored.map((row) => ({ ...row, source: "job" as const })));
  return scored;
}

export async function saveResearchScore(eventId: string, score: {
  dataScore: number;
  researchSummary: string;
  discardReason: string | null;
  lowConfidence: boolean;
}, now: Date) {
  await getDb()
    .update(modelEvaluations)
    .set(score)
    .where(and(
      eq(modelEvaluations.eventId, eventId),
      eq(modelEvaluations.source, "job"),
      gte(modelEvaluations.createdAt, startOfUtcDay(now)),
    ));
}

export async function saveSelectionScores(selected: readonly ScoredEvent[], now: Date) {
  if (selected.length === 0) return;
  const db = getDb();
  const since = startOfUtcDay(now);
  const ids = selected.map((event) => event.eventId);
  await db
    .delete(modelEvaluations)
    .where(and(
      eq(modelEvaluations.source, "job"),
      eq(modelEvaluations.market, SELECTION_MARKET),
      inArray(modelEvaluations.eventId, ids),
      gte(modelEvaluations.createdAt, since),
    ));

  const placeholders: (ReturnType<typeof selectionPlaceholder>)[] = [];
  for (const event of selected) {
    const updated = await db
      .update(modelEvaluations)
      .set(selectionScore(event))
      .where(and(eq(modelEvaluations.eventId, event.eventId), eq(modelEvaluations.source, "job"), gte(modelEvaluations.createdAt, since)))
      .returning({ id: modelEvaluations.id });
    if (updated.length === 0) placeholders.push(selectionPlaceholder(event, now));
  }
  if (placeholders.length > 0) await db.insert(modelEvaluations).values(placeholders);
}

function selectionPlaceholder(event: ScoredEvent, now: Date) {
  return {
    eventId: event.eventId,
    home: event.home,
    away: event.away,
    market: SELECTION_MARKET,
    outcome: "event",
    point: null,
    consensusProb: 0,
    bestPrice: 1,
    bestBookmaker: "—",
    ev: 0,
    isCandidate: false,
    nearMiss: false,
    aiPickShortlisted: false,
    ...selectionScore(event),
    source: "job" as const,
    createdAt: now,
  };
}

export async function listSelectionEvents(now: Date, windowMaxHours: number): Promise<SelectionEvent[]> {
  const formSince = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
  const latest = new Date(now.getTime() + Math.max(windowMaxHours, ROUND_BOARD_HOURS) * 60 * 60 * 1000);
  return getDb()
    .select({
      id: events.id,
      sportKey: events.sportKey,
      home: events.home,
      away: events.away,
      commenceTime: events.commenceTime,
      status: events.status,
      homeScore: events.homeScore,
      awayScore: events.awayScore,
    })
    .from(events)
    .where(or(
      and(eq(events.status, "completed"), gte(events.commenceTime, formSince), lt(events.commenceTime, now)),
      and(eq(events.status, "scheduled"), gte(events.commenceTime, now), lte(events.commenceTime, latest)),
    ));
}

export async function listTeamMeta() {
  const rows = await getDb().select().from(teamMeta);
  return rows.map((row) => ({
    teamName: row.teamName,
    sportKey: row.sportKey,
    leagueKey: row.leagueKey,
    tableRank: row.tableRank,
    isRelegation: row.isRelegation,
  }));
}

export async function listRivalries() {
  const rows = await getDb().select().from(rivalryPairs);
  return rows.map((row) => ({ sportKey: row.sportKey, teamA: row.teamA, teamB: row.teamB }));
}

export async function listPlanEvents() {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  return getDb()
    .select({
      sportKey: events.sportKey,
      commenceTime: events.commenceTime,
      status: events.status,
    })
    .from(events)
    .where(gte(events.commenceTime, since));
}

export async function markScoresMissing(sportKey: string, seenIds: string[], now: Date) {
  const earliest = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const rows = await getDb()
    .select({ id: events.id, commenceTime: events.commenceTime, status: events.status })
    .from(events)
    .where(and(eq(events.sportKey, sportKey), gte(events.commenceTime, earliest)));
  const missing = absentScoreIds({
    events: rows.map((row) => ({ id: row.id, commenceTime: row.commenceTime.toISOString(), status: row.status })),
    seenIds,
    now,
  });
  if (missing.length === 0) return 0;
  await getDb().update(events).set({ missingFromScores: true }).where(inArray(events.id, missing));
  return missing.length;
}

export async function hasUnsettledScores(sportKey: string, now: Date): Promise<boolean> {
  const latest = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const earliest = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const rows = await getDb()
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.sportKey, sportKey),
        inArray(events.status, ["scheduled", "live"]),
        sql`${events.commenceTime} <= ${latest}`,
        sql`${events.commenceTime} >= ${earliest}`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function findCachedCall(input: { endpoint: string; sportKey: string; day: string; purpose: string }) {
  const [row] = await getDb()
    .select()
    .from(apiPayloads)
    .where(
      and(
        eq(apiPayloads.endpoint, input.endpoint),
        eq(apiPayloads.sportKey, input.sportKey),
        eq(apiPayloads.day, input.day),
        eq(apiPayloads.purpose, input.purpose),
        sql`${apiPayloads.cost} > 0`,
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function rememberCall(input: {
  endpoint: string;
  sportKey: string | null;
  day: string | null;
  purpose: string | null;
  cost: number;
  remaining: number | null;
  used: number | null;
  params: Record<string, unknown>;
  body: unknown;
}) {
  const db = getDb();
  await db
    .insert(apiPayloads)
    .values({
      endpoint: input.endpoint,
      sportKey: input.sportKey,
      day: input.day,
      purpose: input.purpose,
      cost: input.cost,
      remaining: input.remaining,
      used: input.used,
      body: input.body ?? {},
    })
    .onConflictDoNothing();
  if (input.cost <= 0 || !input.sportKey || !input.day || !input.purpose) {
    await db.insert(apiUsage).values({
      endpoint: input.endpoint,
      params: input.params,
      cost: input.cost,
      remaining: input.remaining,
      used: input.used,
      source: "job",
    });
    return;
  }
  const [existing] = await db
    .select({ id: apiUsage.id })
    .from(apiUsage)
    .where(
      and(
        eq(apiUsage.endpoint, input.endpoint),
        eq(apiUsage.source, "job"),
        gt(apiUsage.cost, 0),
        sql`${apiUsage.params}->>'sportKey' = ${input.sportKey}`,
        sql`${apiUsage.params}->>'day' = ${input.day}`,
        sql`${apiUsage.params}->>'purpose' = ${input.purpose}`,
      ),
    )
    .limit(1);
  if (existing) return;
  await db.insert(apiUsage).values({
    endpoint: input.endpoint,
    params: input.params,
    cost: input.cost,
    remaining: input.remaining,
    used: input.used,
    source: "job",
  });
}

export async function listMonthUsage(now: Date) {
  return getDb()
    .select({
      cost: apiUsage.cost,
      remaining: apiUsage.remaining,
      createdAt: apiUsage.createdAt,
      endpoint: apiUsage.endpoint,
      params: apiUsage.params,
    })
    .from(apiUsage)
    .where(gte(apiUsage.createdAt, startOfUtcMonth(now)))
    .orderBy(desc(apiUsage.createdAt));
}

export async function budgetAllows(input: {
  cost: number;
  task: "scores" | "other";
  now: Date;
  monthlyLimit: number;
  reserveCredits: number;
  sportKey: string;
  endpoint: string;
}): Promise<{ ok: true } | { ok: false; reason: "reserve" | "insufficient" }> {
  const db = getDb();
  const rows = await db
    .select({ cost: apiUsage.cost, remaining: apiUsage.remaining, createdAt: apiUsage.createdAt })
    .from(apiUsage)
    .where(gte(apiUsage.createdAt, startOfUtcMonth(input.now)))
    .orderBy(desc(apiUsage.createdAt));
  const used = rows.reduce((sum, row) => sum + row.cost, 0);
  const latest = rows.find((row) => row.remaining != null);
  const snapshot = budgetSnapshot({
    monthlyLimit: input.monthlyLimit,
    reserveCredits: input.reserveCredits,
    used,
    now: input.now,
    apiRemaining: latest?.remaining ?? null,
  });
  const decision = canSpend(snapshot, input.cost, input.task);
  if (!decision.ok) {
    await db.insert(auditLog).values({
      actor: "job",
      action: "budget.skip",
      entity: input.sportKey,
      payload: { reason: decision.reason, endpoint: input.endpoint, cost: input.cost },
    });
    try {
      await alertBudget(decision.reason, input.now);
    } catch (error) {
      console.error("budget alert", error instanceof Error ? error.message : "failed");
    }
  }
  return decision;
}
