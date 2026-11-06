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

export type AiPurpose = "value_check" | "vote" | "research";

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
  webSearch: boolean;
  sources: string[];
  purpose: AiPurpose;
  source: "job" | "test";
  createdAt: string;
};

export type ModelEvaluationRecord = {
  id: string;
  eventId: string;
  home: string;
  away: string;
  market: string;
  outcome: string;
  point: number | null;
  consensusProb: number;
  bestPrice: number;
  bestBookmaker: string;
  ev: number;
  isCandidate: boolean;
  nearMiss: boolean;
  aiPickShortlisted: boolean;
  source: "job" | "test";
  createdAt: string;
};

export type AiVoteRecord = {
  id: string;
  eventId: string;
  aiRequestId: string | null;
  model: string;
  market: string;
  selection: string;
  point: number | null;
  probabilities: unknown;
  confidence: string;
  reasoningRu: string | null;
  reasoningEn: string | null;
  source: "job" | "test";
  createdAt: string;
};

export type AiConsensusRecord = {
  id: string;
  eventId: string;
  home: string;
  away: string;
  models: string[];
  voteIds: string[];
  votesFor: number;
  votesTotal: number;
  pAiMean: number | null;
  pAiMin: number | null;
  status: "consensus" | "no_consensus";
  market: string | null;
  selection: string | null;
  point: number | null;
  bestPrice: number | null;
  confidence: string | null;
  reasoningRu: string | null;
  reasoningEn: string | null;
  matchesMarketFavorite: boolean | null;
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

export type StatsEpoch = {
  startedAt: string | null;
  predictions: number;
  archivedPredictions: number;
};

export type UsageDraft = Omit<ApiUsageRecord, "id" | "createdAt">;
export type AiRequestDraft = Omit<AiRequestRecord, "id" | "createdAt">;
export type ModelEvaluationDraft = Omit<ModelEvaluationRecord, "id" | "createdAt">;
export type AiVoteDraft = Omit<AiVoteRecord, "id" | "createdAt">;
export type AiConsensusDraft = Omit<AiConsensusRecord, "id" | "createdAt">;

export interface AdminStore {
  readonly mode: "postgres" | "file";
  getSettings(): Promise<AdminSettings>;
  getStatsEpoch(): Promise<StatsEpoch>;
  resetStatsEpoch(input: { actor: string; now: Date }): Promise<StatsEpoch>;
  saveSettings(settings: AdminSettings, actor: string): Promise<void>;
  listApiUsage(limit: number): Promise<ApiUsageRecord[]>;
  listApiUsageSince(since: Date): Promise<ApiUsageRecord[]>;
  listAiRequests(limit: number): Promise<AiRequestRecord[]>;
  aiSpendSince(since: Date, purposes?: AiPurpose[]): Promise<number>;
  listModelEvaluations(limit: number): Promise<ModelEvaluationRecord[]>;
  listVotes(limit: number): Promise<AiVoteRecord[]>;
  listConsensus(limit: number): Promise<AiConsensusRecord[]>;
  recordModelEvaluations(rows: ModelEvaluationDraft[]): Promise<void>;
  recordVote(row: AiVoteDraft): Promise<string>;
  recordConsensus(row: AiConsensusDraft): Promise<void>;
  webSearchCountSince(since: Date): Promise<number>;
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
  recordAiRequest(row: AiRequestDraft): Promise<string>;
  recordAudit(input: { actor: string; action: string; entity: string; payload: unknown }): Promise<void>;
  reserveTestRun(input: {
    now: Date;
    dailyLimit: number;
    actor: string;
  }): Promise<{ ok: true } | { ok: false; reason: "interval" | "daily" }>;
  latestRemaining(): Promise<number | null>;
}
