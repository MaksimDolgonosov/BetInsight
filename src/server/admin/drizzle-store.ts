import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { getDb } from "@/server/db";
import { aiConsensus, aiRequests, aiVotes, apiUsage, appSettings, auditLog, events, jobRuns, modelEvaluations, predictions, sports } from "@/server/db/schema";
import { startOfUtcDay } from "@/server/budget/budget";
import {
  aiPickFromEnv,
  defaultSettings,
  hydrateSettings,
  isSportGroup,
  SPORT_GROUPS,
  type AdminSettings,
  type LeagueSetting,
  type Market,
  type SportThresholds,
} from "@/server/domain/settings";
import { countEpoch } from "@/server/domain/stats/epoch";
import { decideSettlement } from "@/server/domain/settlement/profit";
import { testRunAllowance } from "@/server/admin/rate-limit";
import {
  TEST_RUN_ENDPOINT,
  type AdminStore,
  type AiConsensusDraft,
  type AiConsensusRecord,
  type AiPurpose,
  type AiRequestDraft,
  type AiRequestRecord,
  type AiVoteDraft,
  type AiVoteRecord,
  type ApiUsageRecord,
  type ModelEvaluationDraft,
  type ModelEvaluationRecord,
  type JobRunRecord,
  type JobStatus,
  type StatsEpoch,
  type UsageDraft,
} from "@/server/admin/types";

type Database = ReturnType<typeof getDb>;

export class DrizzleAdminStore implements AdminStore {
  readonly mode = "postgres" as const;

  getSettings() {
    return this.withDb(async (db) => {
      const row = await ensureSettings(db);
      const sportRows = await db.select().from(sports);
      return toSettings(row, sportRows);
    });
  }

  getStatsEpoch() {
    return this.withDb((db) => readStatsEpoch(db));
  }

  resetStatsEpoch(input: { actor: string; now: Date }) {
    return this.withDb(async (db) => {
      await ensureSettings(db);
      const before = await readStatsEpoch(db);
      await db
        .update(appSettings)
        .set({ statsEpochStartedAt: input.now, updatedAt: input.now })
        .where(eq(appSettings.id, 1));
      await db.insert(auditLog).values({
        actor: input.actor,
        action: "stats.reset",
        entity: "app_settings",
        payload: {
          startedAt: input.now.toISOString(),
          previousStartedAt: before.startedAt,
          archivedPredictions: before.predictions,
        },
      });
      return readStatsEpoch(db);
    });
  }

  saveSettings(settings: AdminSettings, actor: string) {
    return this.withDb(async (db) => {
      const { id, ...rest } = toSettingsRow(settings);
      await db.insert(appSettings).values({ id, ...rest }).onConflictDoUpdate({
        target: appSettings.id,
        set: rest,
      });
      for (const league of settings.leagues) {
        await db
          .insert(sports)
          .values({
            key: league.key,
            group: league.group,
            title: league.title,
            active: true,
            enabledByAdmin: league.enabled,
          })
          .onConflictDoUpdate({
            target: sports.key,
            set: {
              group: league.group,
              title: league.title,
              enabledByAdmin: league.enabled,
            },
          });
      }
      await db.insert(auditLog).values({
        actor,
        action: "settings.update",
        entity: "app_settings",
        payload: settings,
      });
    });
  }

  listApiUsage(limit: number) {
    return this.withDb(async (db) => {
      const rows = await db.select().from(apiUsage).orderBy(desc(apiUsage.createdAt)).limit(limit);
      return rows.map(toUsage);
    });
  }

  listApiUsageSince(since: Date) {
    return this.withDb(async (db) => {
      const rows = await db
        .select()
        .from(apiUsage)
        .where(gte(apiUsage.createdAt, since))
        .orderBy(desc(apiUsage.createdAt));
      return rows.map(toUsage);
    });
  }

  listAiRequests(limit: number) {
    return this.withDb(async (db) => {
      const rows = await db.select().from(aiRequests).orderBy(desc(aiRequests.createdAt)).limit(limit);
      return rows.map(toAiRequest);
    });
  }

  aiSpendSince(since: Date, purposes?: AiPurpose[]) {
    return this.withDb(async (db) => {
      const rows = await db
        .select({ costUsd: aiRequests.costUsd, purpose: aiRequests.purpose })
        .from(aiRequests)
        .where(gte(aiRequests.createdAt, since));
      return rows.reduce((sum, row) => {
        if (purposes && !purposes.includes(asPurpose(row.purpose))) return sum;
        return sum + (row.costUsd ?? 0);
      }, 0);
    });
  }

  listModelEvaluations(limit: number) {
    return this.withDb(async (db) => {
      const rows = await db.select().from(modelEvaluations).orderBy(desc(modelEvaluations.createdAt)).limit(limit);
      return rows.map(toEvaluation);
    });
  }

  listVotes(limit: number) {
    return this.withDb(async (db) => {
      const rows = await db.select().from(aiVotes).orderBy(desc(aiVotes.createdAt)).limit(limit);
      return rows.map(toVote);
    });
  }

  listConsensus(limit: number) {
    return this.withDb(async (db) => {
      const rows = await db.select().from(aiConsensus).orderBy(desc(aiConsensus.createdAt)).limit(limit);
      return rows.map(toConsensus);
    });
  }

  recordModelEvaluations(rows: ModelEvaluationDraft[]) {
    return this.withDb(async (db) => {
      if (rows.length === 0) return;
      await db.insert(modelEvaluations).values(rows);
    });
  }

  recordVote(row: AiVoteDraft) {
    return this.withDb(async (db) => {
      const [inserted] = await db.insert(aiVotes).values(row).returning({ id: aiVotes.id });
      if (!inserted) throw new Error("ai vote was not stored");
      return inserted.id;
    });
  }

  recordConsensus(row: AiConsensusDraft) {
    return this.withDb(async (db) => {
      await db.insert(aiConsensus).values(row);
    });
  }

  webSearchCountSince(since: Date) {
    return this.withDb(async (db) => {
      const rows = await db
        .select({ webSearch: aiRequests.webSearch })
        .from(aiRequests)
        .where(gte(aiRequests.createdAt, since));
      return rows.filter((row) => row.webSearch).length;
    });
  }

  listJobRuns(limit: number) {
    return this.withDb(async (db) => {
      const rows = await db.select().from(jobRuns).orderBy(desc(jobRuns.startedAt)).limit(limit);
      return rows.map(toJobRun);
    });
  }

  getJobRun(id: string) {
    return this.withDb(async (db) => {
      const [row] = await db.select().from(jobRuns).where(eq(jobRuns.id, id)).limit(1);
      return row ? toJobRun(row) : null;
    });
  }

  listSettlementCandidates(now: Date) {
    return this.withDb(async (db) => {
      const rows = await db
        .select({ prediction: predictions, event: events })
        .from(predictions)
        .innerJoin(events, eq(predictions.eventId, events.id))
        .where(and(eq(predictions.status, "pending"), eq(events.missingFromScores, true)));

      return rows.flatMap(({ prediction, event }) => {
        if (event.commenceTime.getTime() > now.getTime()) return [];
        return [
          {
            predictionId: prediction.id,
            eventId: event.id,
            sportKey: event.sportKey,
            home: event.home,
            away: event.away,
            commenceTime: event.commenceTime.toISOString(),
            market: prediction.market,
            selection: prediction.selection,
            point: prediction.point,
            price: prediction.price,
          },
        ];
      });
    });
  }

  settlePrediction(input: Parameters<AdminStore["settlePrediction"]>[0]) {
    return this.withDb(async (db) => {
      const [prediction] = await db
        .select()
        .from(predictions)
        .where(eq(predictions.id, input.predictionId))
        .limit(1);
      const [event] = prediction
        ? await db.select().from(events).where(eq(events.id, prediction.eventId)).limit(1)
        : [];
      const decision = decideSettlement({
        prediction: prediction ? { status: prediction.status, price: prediction.price } : null,
        event: event
          ? { missingFromScores: event.missingFromScores, commenceTime: event.commenceTime.toISOString() }
          : null,
        nextStatus: input.status,
        comment: input.comment,
        now: input.now,
      });
      if (!decision.ok || !prediction || !event) return decision;

      await db
        .update(predictions)
        .set({
          status: input.status,
          profitUnits: decision.profitUnits,
          settledAt: input.now,
        })
        .where(eq(predictions.id, prediction.id));
      await db
        .update(events)
        .set({
          status: input.status === "void" ? "void" : "completed",
          completedAt: input.now,
        })
        .where(eq(events.id, event.id));
      await db.insert(auditLog).values({
        actor: input.actor,
        action: "prediction.settle",
        entity: prediction.id,
        payload: {
          status: input.status,
          comment: decision.comment,
          profitUnits: decision.profitUnits,
          eventId: event.id,
        },
      });
      return { ok: true as const, profitUnits: decision.profitUnits };
    });
  }

  recordApiUsage(row: UsageDraft) {
    return this.withDb(async (db) => {
      await db.insert(apiUsage).values({
        endpoint: row.endpoint,
        params: row.params,
        cost: row.cost,
        remaining: row.remaining,
        used: row.used,
        source: row.source,
      });
    });
  }

  recordAiRequest(row: AiRequestDraft) {
    return this.withDb(async (db) => {
      const [inserted] = await db
        .insert(aiRequests)
        .values({
          eventId: row.eventId,
          model: row.model,
          promptVersion: row.promptVersion,
          tokensIn: row.tokensIn,
          tokensOut: row.tokensOut,
          costUsd: row.costUsd,
          latencyMs: row.latencyMs,
          rawResponse: row.rawResponse,
          error: row.error,
          webSearch: row.webSearch,
          sources: row.sources,
          purpose: row.purpose,
          source: row.source,
        })
        .returning({ id: aiRequests.id });
      if (!inserted) throw new Error("ai request was not stored");
      return inserted.id;
    });
  }

  recordAudit(input: { actor: string; action: string; entity: string; payload: unknown }) {
    return this.withDb(async (db) => {
      await db.insert(auditLog).values(input);
    });
  }

  reserveTestRun(input: { now: Date; dailyLimit: number; actor: string }) {
    return this.withDb(async (db) => {
      const runs = await db
        .select({ createdAt: apiUsage.createdAt })
        .from(apiUsage)
        .where(and(eq(apiUsage.endpoint, TEST_RUN_ENDPOINT), gte(apiUsage.createdAt, startOfUtcDay(input.now))));
      const lastRunAt = runs.reduce<string | null>((latest, row) => {
        const iso = row.createdAt.toISOString();
        return latest == null || iso > latest ? iso : latest;
      }, null);
      const allowance = testRunAllowance({
        now: input.now,
        lastRunAt,
        runsToday: runs.length,
        dailyLimit: input.dailyLimit,
      });
      if (!allowance.ok) return allowance;

      await db.insert(apiUsage).values({
        endpoint: TEST_RUN_ENDPOINT,
        params: {},
        cost: 0,
        remaining: null,
        used: null,
        source: "test",
        createdAt: input.now,
      });
      await db.insert(auditLog).values({
        actor: input.actor,
        action: "test.run",
        entity: TEST_RUN_ENDPOINT,
        payload: {},
      });
      return { ok: true as const };
    });
  }

  latestRemaining() {
    return this.withDb(async (db) => {
      const [row] = await db
        .select({ remaining: apiUsage.remaining })
        .from(apiUsage)
        .where(isNotNull(apiUsage.remaining))
        .orderBy(desc(apiUsage.createdAt))
        .limit(1);
      return row?.remaining ?? null;
    });
  }

  private async withDb<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    return fn(getDb());
  }
}

async function readStatsEpoch(db: Database): Promise<StatsEpoch> {
  await ensureSettings(db);
  const [settings] = await db
    .select({ startedAt: appSettings.statsEpochStartedAt })
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);
  const rows = await db.select({ publishedAt: predictions.publishedAt }).from(predictions);
  const counts = countEpoch(
    rows.map((row) => row.publishedAt),
    settings?.startedAt ?? null,
  );
  return {
    startedAt: settings?.startedAt?.toISOString() ?? null,
    predictions: counts.included,
    archivedPredictions: counts.archived,
  };
}

async function ensureSettings(db: Database) {
  const settings = defaultSettings(process.env.OPENROUTER_MODEL || undefined);
  let [existing] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (!existing) {
    await db.insert(appSettings).values(toSettingsRow(settings)).onConflictDoNothing();
  } else if (!existing.aiPickConfigured) {
    const seeded = aiPickFromEnv({
      enabled: existing.aiPickEnabled,
      models: threeModels(existing.aiPickModels, settings.aiPick.models),
      researchModel: existing.aiPickResearchModel,
      consensusMode: existing.aiPickConsensusMode === "unanimous" ? "unanimous" : "two_thirds",
      probabilityTolerance: existing.aiPickProbabilityTolerance,
      oddsMin: existing.aiPickOddsMin,
      oddsMax: existing.aiPickOddsMax,
      minEv: existing.aiPickMinEv,
      shortlistSize: existing.aiPickShortlistSize,
      dailyLimit: existing.aiPickDailyLimit,
      monthlyBudgetUsd: existing.aiPickMonthlyBudgetUsd,
    });
    await db
      .update(appSettings)
      .set({
        aiPickModels: [...seeded.models],
        aiPickResearchModel: seeded.researchModel,
        aiPickConfigured: true,
        updatedAt: new Date(),
      })
      .where(eq(appSettings.id, 1));
    existing = {
      ...existing,
      aiPickModels: [...seeded.models],
      aiPickResearchModel: seeded.researchModel,
      aiPickConfigured: true,
    };
  }
  const [sport] = await db.select({ key: sports.key }).from(sports).limit(1);
  if (!sport) {
    await db
      .insert(sports)
      .values(
        settings.leagues.map((league) => ({
          key: league.key,
          group: league.group,
          title: league.title,
          active: true,
          enabledByAdmin: league.enabled,
        })),
      )
      .onConflictDoNothing();
  }

  if (existing) return existing;
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (!row) throw new Error("app_settings row is missing");
  return row;
}

function toSettingsRow(settings: AdminSettings) {
  return {
    id: 1,
    region: settings.region,
    markets: settings.markets,
    thresholds: settings.thresholds,
    llmModel: settings.llmModel,
    promptVersion: settings.promptVersion,
    webSearchEnabled: settings.webSearchEnabled,
    webSearchDailyLimit: settings.webSearchDailyLimit,
    aiPickEnabled: settings.aiPick.enabled,
    aiPickModels: [...settings.aiPick.models],
    aiPickResearchModel: settings.aiPick.researchModel,
    aiPickConsensusMode: settings.aiPick.consensusMode,
    aiPickProbabilityTolerance: settings.aiPick.probabilityTolerance,
    aiPickOddsMin: settings.aiPick.oddsMin,
    aiPickOddsMax: settings.aiPick.oddsMax,
    aiPickMinEv: settings.aiPick.minEv,
    aiPickShortlistSize: settings.aiPick.shortlistSize,
    aiPickDailyLimit: settings.aiPick.dailyLimit,
    aiPickMonthlyBudgetUsd: settings.aiPick.monthlyBudgetUsd,
    aiPickConfigured: true,
    monthlyCreditLimit: settings.monthlyCreditLimit,
    reserveCredits: settings.reserveCredits,
    testRunsPerDay: settings.testRunsPerDay,
    updatedAt: new Date(),
  };
}

function toSettings(
  row: typeof appSettings.$inferSelect,
  sportRows: (typeof sports.$inferSelect)[],
): AdminSettings {
  const defaults = defaultSettings();
  const markets = (row.markets ?? []).filter(isMarket);
  const leagues = sportRows.flatMap((sport): LeagueSetting[] => {
    if (!isSportGroup(sport.group)) return [];
    return [{ key: sport.key, group: sport.group, title: sport.title, enabled: sport.enabledByAdmin }];
  });

  const thresholds = Object.fromEntries(
    SPORT_GROUPS.map((group) => [group, mergeThresholds(row.thresholds?.[group], defaults.thresholds[group])]),
  ) as AdminSettings["thresholds"];

  return hydrateSettings({
    region: row.region || defaults.region,
    markets: markets.length > 0 ? markets : defaults.markets,
    leagues: leagues.length > 0 ? leagues : defaults.leagues,
    thresholds,
    llmModel: row.llmModel || defaults.llmModel,
    promptVersion: row.promptVersion || defaults.promptVersion,
    webSearchEnabled: row.webSearchEnabled,
    webSearchDailyLimit: row.webSearchDailyLimit,
    aiPick: {
      enabled: row.aiPickEnabled,
      models: threeModels(row.aiPickModels, defaults.aiPick.models),
      researchModel: row.aiPickResearchModel ?? defaults.aiPick.researchModel,
      consensusMode: row.aiPickConsensusMode === "unanimous" ? "unanimous" : "two_thirds",
      probabilityTolerance: row.aiPickProbabilityTolerance,
      oddsMin: row.aiPickOddsMin,
      oddsMax: row.aiPickOddsMax,
      minEv: row.aiPickMinEv,
      shortlistSize: row.aiPickShortlistSize,
      dailyLimit: row.aiPickDailyLimit,
      monthlyBudgetUsd: row.aiPickMonthlyBudgetUsd,
    },
    monthlyCreditLimit: row.monthlyCreditLimit,
    reserveCredits: row.reserveCredits,
    testRunsPerDay: row.testRunsPerDay,
  });
}

function mergeThresholds(value: SportThresholds | undefined, fallback: SportThresholds): SportThresholds {
  if (!value) return fallback;
  return {
    evThreshold: value.evThreshold ?? fallback.evThreshold,
    oddsMin: value.oddsMin ?? fallback.oddsMin,
    oddsMax: value.oddsMax ?? fallback.oddsMax,
    minBookmakers: value.minBookmakers ?? fallback.minBookmakers,
    totalsPointMin: value.totalsPointMin ?? fallback.totalsPointMin,
    totalsPointMax: value.totalsPointMax ?? fallback.totalsPointMax,
  };
}

function toUsage(row: typeof apiUsage.$inferSelect): ApiUsageRecord {
  return {
    id: row.id,
    endpoint: row.endpoint,
    params: row.params ?? {},
    cost: row.cost,
    remaining: row.remaining,
    used: row.used,
    source: row.source === "test" ? "test" : "job",
    createdAt: row.createdAt.toISOString(),
  };
}

function toAiRequest(row: typeof aiRequests.$inferSelect): AiRequestRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    model: row.model,
    promptVersion: row.promptVersion,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    costUsd: row.costUsd,
    latencyMs: row.latencyMs,
    rawResponse: row.rawResponse,
    error: row.error,
    webSearch: row.webSearch,
    sources: row.sources ?? [],
    purpose: asPurpose(row.purpose),
    source: row.source === "test" ? "test" : "job",
    createdAt: row.createdAt.toISOString(),
  };
}

function toEvaluation(row: typeof modelEvaluations.$inferSelect): ModelEvaluationRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    home: row.home,
    away: row.away,
    market: row.market,
    outcome: row.outcome,
    point: row.point,
    consensusProb: row.consensusProb,
    bestPrice: row.bestPrice,
    bestBookmaker: row.bestBookmaker,
    ev: row.ev,
    isCandidate: row.isCandidate,
    nearMiss: row.nearMiss,
    aiPickShortlisted: row.aiPickShortlisted,
    source: row.source === "test" ? "test" : "job",
    createdAt: row.createdAt.toISOString(),
  };
}

function toVote(row: typeof aiVotes.$inferSelect): AiVoteRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    aiRequestId: row.aiRequestId,
    model: row.model,
    market: row.market,
    selection: row.selection,
    point: row.point,
    probabilities: row.probabilities,
    confidence: row.confidence,
    reasoningRu: row.reasoningRu,
    reasoningEn: row.reasoningEn,
    source: row.source === "test" ? "test" : "job",
    createdAt: row.createdAt.toISOString(),
  };
}

function toConsensus(row: typeof aiConsensus.$inferSelect): AiConsensusRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    home: row.home,
    away: row.away,
    models: row.models ?? [],
    voteIds: row.voteIds ?? [],
    votesFor: row.votesFor,
    votesTotal: row.votesTotal,
    pAiMean: row.pAiMean,
    pAiMin: row.pAiMin,
    status: row.status === "consensus" ? "consensus" : "no_consensus",
    market: row.market,
    selection: row.selection,
    point: row.point,
    bestPrice: row.bestPrice,
    confidence: row.confidence,
    reasoningRu: row.reasoningRu,
    reasoningEn: row.reasoningEn,
    matchesMarketFavorite: row.matchesMarketFavorite,
    source: row.source === "test" ? "test" : "job",
    createdAt: row.createdAt.toISOString(),
  };
}

function threeModels(value: string[] | null, fallback: [string, string, string]): [string, string, string] {
  if (!value || value.length !== 3) return fallback;
  return [value[0] || fallback[0], value[1] || fallback[1], value[2] || fallback[2]];
}

function asPurpose(value: string): AiPurpose {
  if (value === "vote" || value === "research" || value === "value_check") return value;
  return "value_check";
}

function toJobRun(row: typeof jobRuns.$inferSelect): JobRunRecord {
  return {
    id: row.id,
    job: row.job,
    idempotencyKey: row.idempotencyKey,
    status: isJobStatus(row.status) ? row.status : "failed",
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    error: row.error,
    payload: row.payload,
  };
}

function isMarket(value: string): value is Market {
  return value === "h2h" || value === "totals";
}

function isJobStatus(value: string): value is JobStatus {
  return value === "queued" || value === "running" || value === "succeeded" || value === "failed";
}
