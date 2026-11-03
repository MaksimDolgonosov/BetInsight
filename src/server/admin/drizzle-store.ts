import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { getDb } from "@/server/db";
import { aiRequests, apiUsage, appSettings, auditLog, events, jobRuns, predictions, sports } from "@/server/db/schema";
import { startOfUtcDay } from "@/server/budget/budget";
import {
  defaultSettings,
  type AdminSettings,
  type LeagueSetting,
  type Market,
  type SportGroup,
  type SportThresholds,
} from "@/server/domain/settings";
import { decideSettlement } from "@/server/domain/settlement/profit";
import { testRunAllowance } from "@/server/admin/rate-limit";
import {
  TEST_RUN_ENDPOINT,
  type AdminStore,
  type AiRequestDraft,
  type AiRequestRecord,
  type ApiUsageRecord,
  type JobRunRecord,
  type JobStatus,
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

  aiSpendSince(since: Date) {
    return this.withDb(async (db) => {
      const rows = await db
        .select({ costUsd: aiRequests.costUsd })
        .from(aiRequests)
        .where(gte(aiRequests.createdAt, since));
      return rows.reduce((sum, row) => sum + (row.costUsd ?? 0), 0);
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
      await db.insert(aiRequests).values({
        eventId: row.eventId,
        model: row.model,
        promptVersion: row.promptVersion,
        tokensIn: row.tokensIn,
        tokensOut: row.tokensOut,
        costUsd: row.costUsd,
        latencyMs: row.latencyMs,
        rawResponse: row.rawResponse,
        error: row.error,
        source: row.source,
      });
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

async function ensureSettings(db: Database) {
  const settings = defaultSettings(process.env.OPENROUTER_MODEL || undefined);
  const [existing] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (!existing) {
    await db.insert(appSettings).values(toSettingsRow(settings)).onConflictDoNothing();
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

  return {
    region: row.region || defaults.region,
    markets: markets.length > 0 ? markets : defaults.markets,
    leagues: leagues.length > 0 ? leagues : defaults.leagues,
    thresholds: {
      soccer: mergeThresholds(row.thresholds?.soccer, defaults.thresholds.soccer),
      basketball: mergeThresholds(row.thresholds?.basketball, defaults.thresholds.basketball),
    },
    llmModel: row.llmModel || defaults.llmModel,
    promptVersion: row.promptVersion || defaults.promptVersion,
    webSearchEnabled: row.webSearchEnabled,
    monthlyCreditLimit: row.monthlyCreditLimit,
    reserveCredits: row.reserveCredits,
    testRunsPerDay: row.testRunsPerDay,
  };
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
    source: row.source === "test" ? "test" : "job",
    createdAt: row.createdAt.toISOString(),
  };
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

function isSportGroup(value: string): value is SportGroup {
  return value === "soccer" || value === "basketball";
}

function isJobStatus(value: string): value is JobStatus {
  return value === "queued" || value === "running" || value === "succeeded" || value === "failed";
}
