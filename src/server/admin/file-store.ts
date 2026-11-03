import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { defaultSettings, type AdminSettings } from "@/server/domain/settings";
import { decideSettlement } from "@/server/domain/settlement/profit";
import { startOfUtcDay } from "@/server/budget/budget";
import { testRunAllowance } from "@/server/admin/rate-limit";
import {
  TEST_RUN_ENDPOINT,
  type AdminStore,
  type AiRequestDraft,
  type AiRequestRecord,
  type ApiUsageRecord,
  type JobRunRecord,
  type JobStatus,
  type SettlementCandidate,
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
};

type FileState = {
  settings: AdminSettings;
  apiUsage: ApiUsageRecord[];
  aiRequests: AiRequestRecord[];
  jobRuns: JobRunRecord[];
  audit: { id: string; actor: string; action: string; entity: string; payload: unknown; createdAt: string }[];
  events: StoredEvent[];
  predictions: StoredPrediction[];
};

function emptyState(): FileState {
  return {
    settings: defaultSettings(process.env.OPENROUTER_MODEL || undefined),
    apiUsage: [],
    aiRequests: [],
    jobRuns: [],
    audit: [],
    events: [],
    predictions: [],
  };
}

export class FileAdminStore implements AdminStore {
  readonly mode = "file" as const;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath = path.join(process.cwd(), "data", "admin-state.json")) {}

  getSettings() {
    return this.read((state) => state.settings);
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

  aiSpendSince(since: Date) {
    return this.read((state) =>
      state.aiRequests
        .filter((row) => row.createdAt >= since.toISOString())
        .reduce((sum, row) => sum + (row.costUsd ?? 0), 0),
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
      state.aiRequests.push({ ...row, id: randomUUID(), createdAt: new Date().toISOString() });
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
      const parsed = JSON.parse(raw) as FileState;
      if (!parsed.settings || !Array.isArray(parsed.apiUsage)) return emptyState();
      return parsed;
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

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error != null && "code" in error && error.code === "ENOENT";
}

export function isJobStatus(value: string): value is JobStatus {
  return value === "queued" || value === "running" || value === "succeeded" || value === "failed";
}
