import "server-only";
import { z } from "zod";
import { getAdminStore } from "@/server/admin/store";
import { startOfUtcDay, startOfUtcMonth } from "@/server/budget/budget";
import { decideConsensus, marketFavoriteKey, outcomeKey, type ModelVoteInput, type PickRef } from "@/server/domain/predictions/ai-pick";
import { decideAiPickPublication, predictionHash, samePoint, type CandidateQuote } from "@/server/domain/predictions/publish";
import { isSportGroup, MARKETS, type Market } from "@/server/domain/settings";
import { appBaseUrl, enqueueJob } from "@/server/integrations/qstash/enqueue";
import { VOTE_PROMPT_VERSION } from "@/server/integrations/openrouter/prompt";
import { generateResearch } from "@/server/integrations/openrouter/research";
import { generateVote } from "@/server/integrations/openrouter/vote";
import type { ModelRow } from "@/server/jobs/evaluate";
import { JobInputError } from "@/server/jobs/errors";
import {
  consensusExists,
  countTrackPredictions,
  latestJobEvaluations,
  latestResearchText,
  loadEvent,
  mskDayRange,
  otherTrackAgrees,
  predictionExists,
  saveConsensus,
  savePrediction,
  votedModels,
  votesForEvent,
} from "@/server/jobs/ai-store";
import { enabledLeagues, loadLatestOdds } from "@/server/jobs/persist";
import { runJob, type JobOutcome } from "@/server/jobs/runner";

const eventSchema = z.object({
  eventId: z.string().min(3).max(80),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const voteSchema = eventSchema.extend({
  model: z.string().min(3).max(160),
});

const consensusSchema = eventSchema.extend({
  deadline: z.string().datetime().optional(),
});

const MARKET_SET = new Set<Market>(MARKETS);
const SELECTIONS = new Set(["home", "draw", "away", "over", "under"]);
const CONFIDENCE = new Set(["low", "medium", "high"]);

export async function scheduleModelFollowups(input: { rows: ModelRow[]; day: string; now: Date; aiPickEnabled: boolean }) {
  if (!input.aiPickEnabled) return;
  const pickIds = unique(input.rows.filter((row) => row.aiPickShortlisted).map((row) => row.eventId));
  for (const eventId of pickIds) {
    await deliverJob("ai-research", { eventId, day: input.day }, () => runAiResearch({ eventId, day: input.day }, input.now));
  }
}

export async function runAiPredict(payload: unknown, now: Date): Promise<JobOutcome> {
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) throw new JobInputError("invalid_payload");
  const { eventId, day } = parsed.data;
  return runJob({
    job: "ai-predict",
    idempotencyKey: `ai-predict:${eventId}:${day}`,
    payload,
    now,
    work: () => predictValue(),
  });
}

export async function runAiResearch(payload: unknown, now: Date): Promise<JobOutcome> {
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) throw new JobInputError("invalid_payload");
  const { eventId, day } = parsed.data;
  return runJob({
    job: "ai-research",
    idempotencyKey: `ai-research:${eventId}:${day}`,
    payload,
    now,
    work: () => researchEvent(eventId, day, now),
  });
}

export async function runAiVote(payload: unknown, now: Date): Promise<JobOutcome> {
  const parsed = voteSchema.safeParse(payload);
  if (!parsed.success) throw new JobInputError("invalid_payload");
  const { eventId, day, model } = parsed.data;
  return runJob({
    job: "ai-vote",
    idempotencyKey: `ai-vote:${eventId}:${day}:${model}`,
    payload,
    now,
    work: () => voteEvent(eventId, day, model, now),
  });
}

export async function runAiConsensus(payload: unknown, now: Date): Promise<JobOutcome> {
  const parsed = consensusSchema.safeParse(payload);
  if (!parsed.success) throw new JobInputError("invalid_payload");
  const { eventId, day } = parsed.data;
  return runJob({
    job: "ai-consensus",
    idempotencyKey: `ai-consensus:${eventId}:${day}`,
    payload,
    now,
    work: () => consensusEvent(eventId, day, now),
  });
}

async function predictValue(): Promise<JobOutcome> {
  return { status: "skipped", detail: { reason: "track_removed" } };
}

async function researchEvent(eventId: string, day: string, now: Date): Promise<JobOutcome> {
  const settings = await getAdminStore().getSettings();
  if (!settings.aiPick.enabled) return { status: "skipped", detail: { reason: "ai_pick_disabled" } };
  const context = await eventContext(eventId);
  if (!context) return { status: "skipped", detail: { reason: "event_missing" } };
  const shortlist = context.evaluations.filter((row) => row.aiPickShortlisted);
  if (shortlist.length < 2) return { status: "skipped", detail: { reason: "no_shortlist" } };
  if (now.getTime() >= context.event.commenceTime.getTime()) return { status: "skipped", detail: { reason: "too_late" } };
  const spent = await getAdminStore().aiSpendSince(startOfUtcMonth(now), ["research", "vote"]);
  if (spent >= settings.aiPick.monthlyBudgetUsd) return { status: "skipped", detail: { reason: "ai_pick_budget" } };
  if (!process.env.OPENROUTER_API_KEY) return { status: "skipped", detail: { reason: "missing_openrouter_key" } };

  const searches = await getAdminStore().webSearchCountSince(startOfUtcDay(now));
  const model = settings.aiPick.researchModel || settings.aiPick.models[0];
  const research = await generateResearch({
    model,
    webSearch: settings.webSearchEnabled && searches < settings.webSearchDailyLimit,
    payload: {
      sportGroup: context.group,
      event: eventBrief(context.event),
      shortlist,
    },
  });
  await getAdminStore().recordAiRequest({
    eventId,
    model: research.model,
    promptVersion: research.promptVersion,
    tokensIn: research.tokensIn,
    tokensOut: research.tokensOut,
    costUsd: research.costUsd,
    latencyMs: research.latencyMs,
    rawResponse: { content: research.text },
    error: research.error,
    webSearch: research.webSearch,
    sources: research.sources,
    purpose: "research",
    source: "job",
  });

  for (const voter of settings.aiPick.models) {
    await deliverJob("ai-vote", { eventId, day, model: voter }, () => runAiVote({ eventId, day, model: voter }, now));
  }
  await deliverJob(
    "ai-consensus",
    { eventId, day, deadline: new Date(now.getTime() + 10 * 60 * 1000).toISOString() },
    () => Promise.resolve(),
    { notBefore: new Date(now.getTime() + 10 * 60 * 1000), deduplicationId: `ai-consensus-${eventId}-${day}` },
  );
  return { status: "done", detail: { votes: settings.aiPick.models.length, costUsd: research.costUsd } };
}

async function voteEvent(eventId: string, day: string, model: string, now: Date): Promise<JobOutcome> {
  const settings = await getAdminStore().getSettings();
  const context = await eventContext(eventId);
  if (!context) return { status: "skipped", detail: { reason: "event_missing" } };
  const shortlist = context.evaluations.filter((row) => row.aiPickShortlisted).flatMap(asPick);
  if (shortlist.length < 2) return { status: "skipped", detail: { reason: "no_shortlist" } };
  if (now.getTime() >= context.event.commenceTime.getTime()) return { status: "skipped", detail: { reason: "too_late" } };
  if (!process.env.OPENROUTER_API_KEY) return { status: "skipped", detail: { reason: "missing_openrouter_key" } };

  const { start } = mskDayRange(day);
  const research = await latestResearchText(eventId, start);
  const output = await generateVote({
    model,
    webSearch: false,
    allowed: shortlist,
    payload: {
      sportGroup: context.group,
      event: eventBrief(context.event),
      shortlist,
      research: research || null,
    },
  });
  const requestId = await getAdminStore().recordAiRequest({
    eventId,
    model,
    promptVersion: output.promptVersion,
    tokensIn: output.tokensIn,
    tokensOut: output.tokensOut,
    costUsd: output.costUsd,
    latencyMs: output.latencyMs,
    rawResponse: { content: output.raw, servedModel: output.model },
    error: output.validationError,
    webSearch: false,
    sources: output.sources,
    purpose: "vote",
    source: "job",
  });
  if (output.parsed) {
    await getAdminStore().recordVote({
      eventId,
      aiRequestId: requestId,
      model: output.model,
      market: output.parsed.pick.market,
      selection: output.parsed.pick.selection,
      point: output.parsed.pick.point,
      probabilities: output.parsed.probabilities,
      confidence: output.parsed.confidence,
      reasoningRu: output.parsed.reasoning.ru,
      reasoningEn: output.parsed.reasoning.en,
      source: "job",
    });
  }

  const answered = await votedModels(eventId, start);
  if (settings.aiPick.models.every((item) => answered.includes(item))) {
    await deliverJob("ai-consensus", { eventId, day }, () => runAiConsensus({ eventId, day }, now), {
      deduplicationId: `ai-consensus-${eventId}-${day}`,
    });
  }
  return { status: "done", detail: { parsed: Boolean(output.parsed), costUsd: output.costUsd } };
}

async function consensusEvent(eventId: string, day: string, now: Date): Promise<JobOutcome> {
  const settings = await getAdminStore().getSettings();
  const context = await eventContext(eventId);
  if (!context) return { status: "skipped", detail: { reason: "event_missing" } };
  const { start, end } = mskDayRange(day);
  if (await consensusExists(eventId, start)) {
    if (await predictionExists(eventId, "ai_pick")) await publishForecast(eventId);
    return { status: "skipped", detail: { reason: "already_saved" } };
  }

  const stored = await votesForEvent(eventId, start);
  const votes = stored.flatMap(asVote);
  const shortlist = context.evaluations.filter((row) => row.aiPickShortlisted).map(asQuote);
  const decision = decideConsensus({
    votes,
    modelCount: settings.aiPick.models.length,
    mode: settings.aiPick.consensusMode,
    prices: shortlist.map((row) => ({ key: outcomeKey({ market: row.market as Market, selection: row.outcome as PickRef["selection"], point: row.point }), price: row.bestPrice })),
    tolerance: settings.aiPick.probabilityTolerance,
    marketFavoriteKey: marketFavoriteKey(
      context.evaluations.flatMap((row) => {
        const pick = asPick(row)[0];
        return pick ? [{ ...pick, consensusProb: row.consensusProb }] : [];
      }),
    ),
  });
  const quote = shortlist.find((row) => decision.pick && row.market === decision.pick.market && row.outcome === decision.pick.selection && samePoint(row.point, decision.pick.point)) ?? null;
  const publication = decideAiPickPublication({
    now,
    commenceTime: context.event.commenceTime,
    publishedToday: await countTrackPredictions("ai_pick", start, end),
    dailyLimit: settings.aiPick.dailyLimit,
    quote,
    decision,
  });
  const saved = publication.action === "skip"
    ? publication.reason
    : await predictionExists(eventId, "ai_pick")
      ? "already_saved"
      : await storePick({
          event: context.event,
          track: "ai_pick",
          pick: publication.pick,
          model: decision.reasoningModel ?? settings.aiPick.models[0],
          promptVersion: VOTE_PROMPT_VERSION,
          now,
        });
  if (saved === "saved" || saved === "duplicate" || saved === "already_saved") await publishForecast(eventId);
  await saveConsensus({
    eventId,
    home: context.event.home,
    away: context.event.away,
    models: [...settings.aiPick.models],
    voteIds: stored.map((row) => row.id),
    votesFor: decision.votesFor,
    votesTotal: decision.votesTotal,
    pAiMean: decision.pAiMean,
    pAiMin: decision.pAiMin,
    status: decision.status,
    market: decision.pick?.market ?? null,
    selection: decision.pick?.selection ?? null,
    point: decision.pick?.point ?? null,
    bestPrice: decision.bestPrice,
    confidence: decision.confidence,
    reasoningRu: decision.reasoning?.ru ?? null,
    reasoningEn: decision.reasoning?.en ?? null,
    matchesMarketFavorite: decision.matchesMarketFavorite,
    predictionId: null,
    source: "job",
  });
  return { status: "done", detail: { consensus: decision.status, saved } };
}

async function storePick(input: {
  event: { id: string; home: string; away: string; commenceTime: Date };
  track: "value" | "ai_pick";
  pick: {
    market: string;
    selection: string;
    point: number | null;
    price: number;
    bookmaker: string;
    modelProb: number;
    aiProb: number;
    ev: number;
    confidence: string;
    reasoningRu: string;
    reasoningEn: string;
  };
  model: string;
  promptVersion: string;
  now: Date;
}): Promise<"saved" | "duplicate" | "too_late"> {
  const publishedAt = input.now.toISOString();
  const tracksAgree = await otherTrackAgrees({
    eventId: input.event.id,
    track: input.track,
    market: input.pick.market,
    selection: input.pick.selection,
    point: input.pick.point,
  });
  return savePrediction({
    eventId: input.event.id,
    track: input.track,
    tracksAgree,
    market: input.pick.market,
    selection: input.pick.selection,
    point: input.pick.point,
    price: input.pick.price,
    bookmaker: input.pick.bookmaker,
    modelProb: input.pick.modelProb,
    aiProb: input.pick.aiProb,
    ev: input.pick.ev,
    confidence: input.pick.confidence,
    reasoningRu: input.pick.reasoningRu,
    reasoningEn: input.pick.reasoningEn,
    llmModel: input.model,
    promptVersion: input.promptVersion,
    publishedAt: input.now,
    hash: predictionHash({
      eventId: input.event.id,
      home: input.event.home,
      away: input.event.away,
      commenceTime: input.event.commenceTime.toISOString(),
      track: input.track,
      market: input.pick.market,
      selection: input.pick.selection,
      point: input.pick.point,
      price: input.pick.price,
      bookmaker: input.pick.bookmaker,
      publishedAt,
    }),
  });
}

async function eventContext(eventId: string) {
  const event = await loadEvent(eventId);
  if (!event) return null;
  const league = (await enabledLeagues()).find((item) => item.key === event.sportKey);
  if (!league || !isSportGroup(league.group)) return null;
  const odds = await loadLatestOdds(event.sportKey);
  const quotes = odds.find((item) => item.id === eventId)?.quotes ?? [];
  const evaluations = await latestJobEvaluations(eventId);
  return { event, group: league.group, quotes, evaluations };
}

function eventBrief(event: { id: string; home: string; away: string; commenceTime: Date }) {
  return { id: event.id, home: event.home, away: event.away, commenceTime: event.commenceTime.toISOString() };
}

function asQuote(row: { market: string; outcome: string; point: number | null; consensusProb: number; bestPrice: number; bestBookmaker: string; ev: number }): CandidateQuote {
  return row;
}

function asPick(row: { market: string; outcome: string; point: number | null }): PickRef[] {
  if (!MARKET_SET.has(row.market as Market) || !SELECTIONS.has(row.outcome)) return [];
  return [{ market: row.market as Market, selection: row.outcome as PickRef["selection"], point: row.point }];
}

function asVote(row: { model: string; market: string; selection: string; point: number | null; probabilities: unknown; confidence: string; reasoningRu: string | null; reasoningEn: string | null }): ModelVoteInput[] {
  const pick = asPick({ market: row.market, outcome: row.selection, point: row.point })[0];
  if (!pick || !CONFIDENCE.has(row.confidence) || !row.reasoningRu || !row.reasoningEn) return [];
  if (!Array.isArray(row.probabilities)) return [];
  const probabilities = row.probabilities.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as { market?: unknown; selection?: unknown; point?: unknown; p?: unknown };
    if (typeof value.market !== "string" || typeof value.selection !== "string" || typeof value.p !== "number") return [];
    const mapped = asPick({ market: value.market, outcome: value.selection, point: typeof value.point === "number" ? value.point : null })[0];
    return mapped ? [{ ...mapped, p: value.p }] : [];
  });
  return [{
    model: row.model,
    pick,
    probabilities,
    confidence: row.confidence as ModelVoteInput["confidence"],
    reasoning: { ru: row.reasoningRu, en: row.reasoningEn },
  }];
}

async function deliverJob(
  job: string,
  payload: unknown,
  run: () => Promise<unknown>,
  options?: { notBefore?: Date; deduplicationId?: string },
) {
  if (appBaseUrl()?.startsWith("https://")) {
    const queued = await enqueueJob(job, payload, options);
    if (queued.ok || queued.reason !== "scheduler_unconfigured") {
      if (!queued.ok) throw new Error(queued.reason);
      return;
    }
  }
  if (options?.notBefore) return;
  await run();
}

async function publishForecast(eventId: string) {
  const { queuePublish } = await import("@/server/jobs/telegram");
  await queuePublish({ kind: "forecast", eventId });
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
