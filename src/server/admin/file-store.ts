import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { defaultSettings, hydrateSettings, type AdminSettings } from "@/server/domain/settings";
import { countEpoch } from "@/server/domain/stats/epoch";
import { decideSettlement } from "@/server/domain/settlement/profit";
import { startOfUtcDay } from "@/server/budget/budget";
import { groupModelSpend } from "@/server/admin/llm-spend";
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
  type JobRunRecord,
  type JobStatus,
  type ModelEvaluationDraft,
  type ModelEvaluationRecord,
  type SettlementCandidate,
  type StatsEpoch,
  type UsageDraft,
} from "@/server/admin/types";

type StoredEvent = {
  id: string;
  sportKey: string;
  home: string;
  away: string;
  commenceTime: string;
  status: string;
  missingFromScores: boolean;
};

type StoredPrediction = {
  id: string;
  eventId: string;
  market: string;
  selection: string;
  point: number | null;
  price: number;
  status: string;
  profitUnits: number | null;
  settledAt: string | null;
  publishedAt?: string | null;
};

type FileState = {
  settings: AdminSettings;
  apiUsage: ApiUsageRecord[];
  aiRequests: AiRequestRecord[];
  modelEvaluations: ModelEvaluationRecord[];
  aiVotes: AiVoteRecord[];
  aiConsensus: AiConsensusRecord[];
  jobRuns: JobRunRecord[];
  audit: { id: string; actor: string; action: string; entity: string; payload: unknown; createdAt: string }[];
  events: StoredEvent[];
  predictions: StoredPrediction[];
  statsEpochStartedAt: string | null;
};

function emptyState(): FileState {
  return {
    settings: defaultSettings(process.env.OPENROUTER_MODEL || undefined),
    apiUsage: [],
    aiRequests: [],
    modelEvaluations: [],
    aiVotes: [],
    aiConsensus: [],
    jobRuns: [],
    audit: [],
    events: [],
    predictions: [],
    statsEpochStartedAt: null,
  };
}

export class FileAdminStore implements AdminStore {
  readonly mode = "file" as const;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath = path.join(process.cwd(), "data", "admin-state.json")) {}

  getSettings() {
    return this.read((state) => hydrateSettings(state.settings));
  }

  getStatsEpoch() {
    return this.read((state) => statsEpoch(state));
  }

  resetStatsEpoch(input: { actor: string; now: Date }) {
    return this.update((state) => {
      const before = statsEpoch(state);
      state.statsEpochStartedAt = input.now.toISOString();
      pushAudit(state, input.actor, "stats.reset", "app_settings", {
        startedAt: state.statsEpochStartedAt,
        previousStartedAt: before.startedAt,
        archivedPredictions: before.predictions,
      });
      return statsEpoch(state);
    });
  }

  saveSettings(settings: AdminSettings, actor: string) {
    return this.update((state) => {
      state.settings = settings;
      pushAudit(state, actor, "settings.update", "app_settings", settings);
    });
  }

  listApiUsage(limit: number) {
    return this.read((state) => newest(state.apiUsage).slice(0, limit));
  }

  listApiUsageSince(since: Date) {
    return this.read((state) =>
      newest(state.apiUsage).filter((row) => row.createdAt >= since.toISOString()),
    );
  }

  listAiRequests(limit: number) {
    return this.read((state) => newest(state.aiRequests).slice(0, limit));
  }

  aiSpendSince(since: Date, purposes?: AiPurpose[]) {
    return this.read((state) =>
      state.aiRequests
        .filter((row) => row.createdAt >= since.toISOString())
        .filter((row) => !purposes || purposes.includes(row.purpose))
        .reduce((sum, row) => sum + (row.costUsd ?? 0), 0),
    );
  }

  aiSpendByModel(since: Date) {
    return this.read((state) =>
      groupModelSpend(
        state.aiRequests
          .filter((row) => row.createdAt >= since.toISOString())
          .map((row) => ({ model: row.model, costUsd: row.costUsd })),
      ),
    );
  }

  listModelEvaluations(limit: number) {
    return this.read((state) => newest(state.modelEvaluations).slice(0, limit));
  }

  listVotes(limit: number) {
    return this.read((state) => newest(state.aiVotes).slice(0, limit));
  }

  listConsensus(limit: number) {
    return this.read((state) => newest(state.aiConsensus).slice(0, limit));
  }

  recordModelEvaluations(rows: ModelEvaluationDraft[]) {
    return this.update((state) => {
      for (const row of rows) {
        state.modelEvaluations.push({ ...row, id: randomUUID(), createdAt: new Date().toISOString() });
      }
    });
  }

  recordVote(row: AiVoteDraft) {
    return this.update((state) => {
      const id = randomUUID();
      state.aiVotes.push({ ...row, id, createdAt: new Date().toISOString() });
      return id;
    });
  }

  recordConsensus(row: AiConsensusDraft) {
    return this.update((state) => {
      state.aiConsensus.push({ ...row, id: randomUUID(), createdAt: new Date().toISOString() });
    });
  }

  webSearchCountSince(since: Date) {
    return this.read(
      (state) => state.aiRequests.filter((row) => row.webSearch && row.createdAt >= since.toISOString()).length,
    );
  }

  listJobRuns(limit: number) {
    return this.read((state) => newest(state.jobRuns).slice(0, limit));
  }

  getJobRun(id: string) {
    return this.read((state) => state.jobRuns.find((job) => job.id === id) ?? null);
  }

  listSettlementCandidates(now: Date) {
    return this.read((state) => candidates(state, now));
  }

  settlePrediction(input: Parameters<AdminStore["settlePrediction"]>[0]) {
    return this.update((state) => {
      const prediction = state.predictions.find((item) => item.id === input.predictionId) ?? null;
      const event = prediction
        ? (state.events.find((item) => item.id === prediction.eventId) ?? null)
        : null;
      const decision = decideSettlement({
        prediction,
        event,
        nextStatus: input.status,
        comment: input.comment,
        now: input.now,
      });
      if (!decision.ok || !prediction || !event) return decision;

      prediction.status = input.status;
      prediction.profitUnits = decision.profitUnits;
      prediction.settledAt = input.now.toISOString();
      event.status = input.status === "void" ? "void" : "completed";
      pushAudit(state, input.actor, "prediction.settle", prediction.id, {
        status: input.status,
        comment: decision.comment,
        profitUnits: decision.profitUnits,
        eventId: event.id,
      });
      return { ok: true as const, profitUnits: decision.profitUnits };
    });
  }

  recordApiUsage(row: UsageDraft) {
    return this.update((state) => {
      state.apiUsage.push({ ...row, id: randomUUID(), createdAt: new Date().toISOString() });
    });
  }

  recordAiRequest(row: AiRequestDraft) {
    return this.update((state) => {
      const id = randomUUID();
      state.aiRequests.push({ ...row, id, createdAt: new Date().toISOString() });
      return id;
    });
  }

  recordAudit(input: { actor: string; action: string; entity: string; payload: unknown }) {
    return this.update((state) => {
      pushAudit(state, input.actor, input.action, input.entity, input.payload);
    });
  }

  reserveTestRun(input: { now: Date; dailyLimit: number; actor: string }) {
    return this.update((state) => {
      const day = startOfUtcDay(input.now).toISOString();
      const runs = state.apiUsage.filter(
        (row) => row.endpoint === TEST_RUN_ENDPOINT && row.createdAt >= day,
      );
      const lastRunAt = runs.reduce<string | null>(
        (latest, row) => (latest == null || row.createdAt > latest ? row.createdAt : latest),
        null,
      );
      const allowance = testRunAllowance({
        now: input.now,
        lastRunAt,
        runsToday: runs.length,
        dailyLimit: input.dailyLimit,
      });
      if (!allowance.ok) return allowance;
      state.apiUsage.push({
        id: randomUUID(),
        endpoint: TEST_RUN_ENDPOINT,
        params: {},
        cost: 0,
        remaining: null,
        used: null,
        source: "test",
        createdAt: input.now.toISOString(),
      });
      pushAudit(state, input.actor, "test.run", TEST_RUN_ENDPOINT, {});
      return { ok: true as const };
    });
  }

  latestRemaining() {
    return this.read((state) => {
      const row = newest(state.apiUsage).find((item) => item.remaining != null);
      return row?.remaining ?? null;
    });
  }

  private read<T>(fn: (state: FileState) => T): Promise<T> {
    return this.enqueue(async () => fn(await this.load()));
  }

  private update<T>(fn: (state: FileState) => T): Promise<T> {
    return this.enqueue(async () => {
      const state = await this.load();
      const result = fn(state);
      await this.persist(state);
      return result;
    });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async load(): Promise<FileState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<FileState>;
      if (!parsed.settings || !Array.isArray(parsed.apiUsage)) return emptyState();
      return {
        settings: parsed.settings,
        apiUsage: parsed.apiUsage,
        aiRequests: (parsed.aiRequests ?? []).map(normalizeAiRequest),
        modelEvaluations: parsed.modelEvaluations ?? [],
        aiVotes: parsed.aiVotes ?? [],
        aiConsensus: parsed.aiConsensus ?? [],
        jobRuns: parsed.jobRuns ?? [],
        audit: parsed.audit ?? [],
        events: parsed.events ?? [],
        predictions: parsed.predictions ?? [],
        statsEpochStartedAt: parsed.statsEpochStartedAt ?? null,
      };
    } catch (error) {
      if (isMissingFile(error)) return emptyState();
      throw error;
    }
  }

  private async persist(state: FileState) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2));
  }
}

function statsEpoch(state: FileState): StatsEpoch {
  const counts = countEpoch(
    state.predictions.map((prediction) => prediction.publishedAt),
    state.statsEpochStartedAt,
  );
  return {
    startedAt: state.statsEpochStartedAt,
    predictions: counts.included,
    archivedPredictions: counts.archived,
  };
}

function newest<T extends { createdAt?: string; startedAt?: string | null; id: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const leftTime = left.createdAt ?? left.startedAt ?? "";
    const rightTime = right.createdAt ?? right.startedAt ?? "";
    return rightTime.localeCompare(leftTime);
  });
}

function pushAudit(state: FileState, actor: string, action: string, entity: string, payload: unknown) {
  state.audit.push({
    id: randomUUID(),
    actor,
    action,
    entity,
    payload,
    createdAt: new Date().toISOString(),
  });
}

function candidates(state: FileState, now: Date): SettlementCandidate[] {
  return state.predictions.flatMap((prediction) => {
    if (prediction.status !== "pending") return [];
    const event = state.events.find((item) => item.id === prediction.eventId);
    if (!event?.missingFromScores) return [];
    if (new Date(event.commenceTime).getTime() > now.getTime()) return [];
    return [
      {
        predictionId: prediction.id,
        eventId: event.id,
        sportKey: event.sportKey,
        home: event.home,
        away: event.away,
        commenceTime: event.commenceTime,
        market: prediction.market,
        selection: prediction.selection,
        point: prediction.point,
        price: prediction.price,
      },
    ];
  });
}

function normalizeAiRequest(row: AiRequestRecord): AiRequestRecord {
  const purpose = row.purpose === "vote" || row.purpose === "research" || row.purpose === "value_check" ? row.purpose : "value_check";
  return {
    ...row,
    webSearch: row.webSearch ?? false,
    sources: row.sources ?? [],
    purpose,
  };
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error != null && "code" in error && error.code === "ENOENT";
}

export function isJobStatus(value: string): value is JobStatus {
  return value === "queued" || value === "running" || value === "succeeded" || value === "failed";
}
