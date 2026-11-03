import "server-only";
import { budgetSnapshot, creditsByDay, startOfUtcMonth } from "@/server/budget/budget";
import { getAdminStore } from "@/server/admin/store";
import { canSpend } from "@/server/budget/budget";
import { oddsApiMode } from "@/server/integrations/odds-api/client";

export async function loadOverview() {
  const now = new Date();
  const store = getAdminStore();
  const settings = await store.getSettings();
  const usage = await store.listApiUsageSince(startOfUtcMonth(now));
  const jobs = await store.listJobRuns(6);
  const used = usage.reduce((sum, row) => sum + row.cost, 0);
  const snapshot = budgetSnapshot({
    monthlyLimit: settings.monthlyCreditLimit,
    reserveCredits: settings.reserveCredits,
    used,
    now,
  });

  return {
    mode: store.mode,
    settings,
    snapshot,
    llmSpend: await store.aiSpendSince(startOfUtcMonth(now)),
    jobs,
    failedJobs: jobs.filter((job) => job.status === "failed").length,
    lastRemaining: await store.latestRemaining(),
    integrations: integrationStatus(),
  };
}

export async function loadBudget() {
  const now = new Date();
  const store = getAdminStore();
  const settings = await store.getSettings();
  const monthUsage = await store.listApiUsageSince(startOfUtcMonth(now));
  const snapshot = budgetSnapshot({
    monthlyLimit: settings.monthlyCreditLimit,
    reserveCredits: settings.reserveCredits,
    used: monthUsage.reduce((sum, row) => sum + row.cost, 0),
    now,
  });

  return {
    mode: store.mode,
    snapshot,
    series: creditsByDay(monthUsage, now),
    usage: await store.listApiUsage(50),
    aiRequests: await store.listAiRequests(50),
    llmSpend: await store.aiSpendSince(startOfUtcMonth(now)),
    lastRemaining: await store.latestRemaining(),
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
  const snapshot = budgetSnapshot({
    monthlyLimit: settings.monthlyCreditLimit,
    reserveCredits: settings.reserveCredits,
    used: usage.reduce((sum, row) => sum + row.cost, 0),
    now,
  });
  const enabled = settings.leagues.filter((league) => league.enabled);

  return {
    mode: store.mode,
    region: settings.region,
    markets: settings.markets,
    leagues: enabled,
    mocked: oddsApiMode() === "mock",
    remaining: snapshot.remaining,
    reserve: snapshot.reserveCredits,
    lastRemaining: await store.latestRemaining(),
    canRunFull: canSpend(snapshot, settings.markets.length, "other").ok,
  };
}

function integrationStatus() {
  return {
    odds: Boolean(process.env.ODDS_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    qstash: Boolean(process.env.QSTASH_TOKEN),
    redis: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    postgres: Boolean(process.env.DATABASE_URL),
  };
}
