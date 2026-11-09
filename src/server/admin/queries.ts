import "server-only";
import { inStatsEpoch } from "@/server/domain/stats/epoch";
import { budgetSnapshot, creditParts, creditsByDay, monthCreditBars, startOfUtcDay, startOfUtcMonth } from "@/server/budget/budget";
import { getAdminStore } from "@/server/admin/store";
import { canSpend } from "@/server/budget/budget";
import { oddsApiMode } from "@/server/integrations/odds-api/client";
import { qstashConfigured } from "@/server/integrations/qstash/client";
import { redisConfigured } from "@/server/integrations/redis/client";
import { listActiveTennisLeagues } from "@/server/integrations/odds-api/tennis";
import { listSavedPredictions } from "@/server/jobs/ai-store";

export async function loadOverview() {
  const now = new Date();
  const store = getAdminStore();
  const settings = await store.getSettings();
  const usage = await store.listApiUsageSince(startOfUtcMonth(now));
  const jobs = await store.listJobRuns(6);
  const used = usage.reduce((sum, row) => sum + row.cost, 0);
  const apiRemaining = await store.latestRemaining();
  const snapshot = budgetSnapshot({
    monthlyLimit: settings.monthlyCreditLimit,
    reserveCredits: settings.reserveCredits,
    used,
    apiRemaining,
    now,
  });

  return {
    mode: store.mode,
    settings,
    snapshot,
    credits: creditParts({
      monthlyLimit: settings.monthlyCreditLimit,
      reserveCredits: settings.reserveCredits,
      used,
      apiRemaining,
    }),
    bars: monthCreditBars(usage, now),
    todaySpent: spentSince(usage, startOfUtcDay(now)),
    llmSpend: await store.aiSpendSince(startOfUtcMonth(now)),
    aiPickSpend: await store.aiSpendSince(startOfUtcMonth(now), ["research", "vote"]),
    modelSpend: await store.aiSpendByModel(startOfUtcMonth(now)),
    jobs,
    failedJobs: jobs.filter((job) => job.status === "failed").length,
    lastRemaining: apiRemaining,
    integrations: integrationStatus(),
    statsEpoch: await store.getStatsEpoch(),
  };
}

export async function loadBudget() {
  const now = new Date();
  const store = getAdminStore();
  const settings = await store.getSettings();
  const monthUsage = await store.listApiUsageSince(startOfUtcMonth(now));
  const used = monthUsage.reduce((sum, row) => sum + row.cost, 0);
  const apiRemaining = await store.latestRemaining();
  const snapshot = budgetSnapshot({
    monthlyLimit: settings.monthlyCreditLimit,
    reserveCredits: settings.reserveCredits,
    used,
    apiRemaining,
    now,
  });

  return {
    mode: store.mode,
    settings,
    snapshot,
    credits: creditParts({
      monthlyLimit: settings.monthlyCreditLimit,
      reserveCredits: settings.reserveCredits,
      used,
      apiRemaining,
    }),
    bars: monthCreditBars(monthUsage, now),
    todaySpent: spentSince(monthUsage, startOfUtcDay(now)),
    series: creditsByDay(monthUsage, now),
    usage: await store.listApiUsage(50),
    aiRequests: await store.listAiRequests(50),
    llmSpend: await store.aiSpendSince(startOfUtcMonth(now)),
    aiPickSpend: await store.aiSpendSince(startOfUtcMonth(now), ["research", "vote"]),
    modelSpend: await store.aiSpendByModel(startOfUtcMonth(now)),
    lastRemaining: apiRemaining,
  };
}

export async function loadJobs() {
  const store = getAdminStore();
  return { mode: store.mode, jobs: await store.listJobRuns(100) };
}

export async function loadSettlement() {
  const store = getAdminStore();
  return {
    mode: store.mode,
    candidates: await store.listSettlementCandidates(new Date()),
  };
}

export async function loadTestPage() {
  const now = new Date();
  const store = getAdminStore();
  const settings = await store.getSettings();
  const usage = await store.listApiUsageSince(startOfUtcMonth(now));
  const apiRemaining = await store.latestRemaining();
  const snapshot = budgetSnapshot({
    monthlyLimit: settings.monthlyCreditLimit,
    reserveCredits: settings.reserveCredits,
    used: usage.reduce((sum, row) => sum + row.cost, 0),
    apiRemaining,
    now,
  });
  const enabled = settings.leagues.filter((league) => league.enabled);
  const tennis = await listActiveTennisLeagues();
  const leagues = [...enabled];
  for (const league of tennis) {
    if (!leagues.some((item) => item.key === league.key)) leagues.push(league);
  }

  return {
    mode: store.mode,
    region: settings.region,
    markets: settings.markets,
    leagues,
    mocked: oddsApiMode() === "mock",
    remaining: snapshot.remaining,
    reserve: snapshot.reserveCredits,
    lastRemaining: await store.latestRemaining(),
    aiPickEnabled: settings.aiPick.enabled,
    canRunFull: canSpend(snapshot, settings.markets.length, "other").ok,
  };
}

export async function loadTracks() {
  const now = new Date();
  const store = getAdminStore();
  const settings = await store.getSettings();
  const epoch = await store.getStatsEpoch();
  const evaluations = (await store.listModelEvaluations(200)).filter((row) =>
    inStatsEpoch(row.createdAt, epoch.startedAt),
  );
  const votes = (await store.listVotes(200)).filter((row) => inStatsEpoch(row.createdAt, epoch.startedAt));
  const consensus = (await store.listConsensus(40)).filter((row) => inStatsEpoch(row.createdAt, epoch.startedAt));
  const predictions = process.env.DATABASE_URL
    ? (await listSavedPredictions(50)).filter((row) => row.track === "ai_pick" && inStatsEpoch(row.publishedAt, epoch.startedAt))
    : [];
  return {
    mode: store.mode,
    settings,
    evaluations,
    votes,
    consensus,
    predictions,
    aiPickSpend: await store.aiSpendSince(startOfUtcMonth(now), ["research", "vote"]),
  };
}

function spentSince(rows: { createdAt: string; cost: number }[], since: Date) {
  const start = since.getTime();
  return rows.reduce((sum, row) => (new Date(row.createdAt).getTime() >= start ? sum + row.cost : sum), 0);
}

function integrationStatus() {
  return {
    odds: Boolean(process.env.ODDS_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    qstash: qstashConfigured(),
    redis: redisConfigured(),
    postgres: Boolean(process.env.DATABASE_URL),
  };
}
