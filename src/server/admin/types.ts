import type { AdminSettings } from "@/server/domain/settings";
import type { SettlementError, SettlementStatus } from "@/server/domain/settlement/profit";

export const TEST_RUN_ENDPOINT = "admin-test";

export type ApiUsageRecord = {
  id: string;
  endpoint: string;
  params: Record<string, unknown>;
  cost: number;
  remaining: number | null;
  used: number | null;
  source: "job" | "test";
  createdAt: string;
};

export type AiRequestRecord = {
  id: string;
  eventId: string | null;
  model: string;
  promptVersion: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  latencyMs: number | null;
  rawResponse: unknown;
  error: string | null;
  source: "job" | "test";
  createdAt: string;
};

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type JobRunRecord = {
  id: string;
  job: string;
  idempotencyKey: string;
  status: JobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  payload: unknown;
};

export type SettlementCandidate = {
  predictionId: string;
  eventId: string;
  sportKey: string;
  home: string;
  away: string;
  commenceTime: string;
  market: string;
  selection: string;
  point: number | null;
  price: number;
};

export type UsageDraft = Omit<ApiUsageRecord, "id" | "createdAt">;
export type AiRequestDraft = Omit<AiRequestRecord, "id" | "createdAt">;

export interface AdminStore {
  readonly mode: "postgres" | "file";
  getSettings(): Promise<AdminSettings>;
  saveSettings(settings: AdminSettings, actor: string): Promise<void>;
  listApiUsage(limit: number): Promise<ApiUsageRecord[]>;
  listApiUsageSince(since: Date): Promise<ApiUsageRecord[]>;
  listAiRequests(limit: number): Promise<AiRequestRecord[]>;
  aiSpendSince(since: Date): Promise<number>;
  listJobRuns(limit: number): Promise<JobRunRecord[]>;
  getJobRun(id: string): Promise<JobRunRecord | null>;
  listSettlementCandidates(now: Date): Promise<SettlementCandidate[]>;
  settlePrediction(input: {
    predictionId: string;
    status: SettlementStatus;
    comment: string;
    actor: string;
    now: Date;
  }): Promise<{ ok: true; profitUnits: number } | { ok: false; error: SettlementError }>;
  recordApiUsage(row: UsageDraft): Promise<void>;
  recordAiRequest(row: AiRequestDraft): Promise<void>;
  recordAudit(input: { actor: string; action: string; entity: string; payload: unknown }): Promise<void>;
  reserveTestRun(input: {
    now: Date;
    dailyLimit: number;
    actor: string;
  }): Promise<{ ok: true } | { ok: false; reason: "interval" | "daily" }>;
  latestRemaining(): Promise<number | null>;
}
