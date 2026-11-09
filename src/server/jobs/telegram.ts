import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { events, predictions, sports, tgMessages } from "@/server/db/schema";
import { summarize, type PublicPick } from "@/server/domain/stats/metrics";
import { planBatches } from "@/server/integrations/telegram/batches";
import { sendTelegramMessage, telegramDeliveryEnabled, telegramSkipReason } from "@/server/integrations/telegram/client";
import { forecastMessage, reportMessage, resultMessage, type ForecastCopy, type ResultCopy } from "@/server/integrations/telegram/format";
import { asLocale, parseLeagues, parseQuiet, type Locale } from "@/server/integrations/telegram/preferences";
import { dayKey, onCalendarDay, quietUntil, shiftDay } from "@/server/integrations/telegram/quiet";
import { deactivateSubscriber, getSubscriber, listActiveSubscribers } from "@/server/integrations/telegram/subscribers";
import { enqueueJob } from "@/server/integrations/qstash/enqueue";
import { JobInputError } from "@/server/jobs/errors";
import { runJob, type JobOutcome } from "@/server/jobs/runner";
import { refreshPublicBoard } from "@/server/stats/refresh";
import { loadPublicBoard } from "@/server/stats/load";

const ZONE = "Europe/Moscow";
const chatIdsSchema = z.array(z.string().min(1).max(80)).min(1).max(25);
const eventSchema = z.object({
  kind: z.enum(["forecast", "result"]),
  eventId: z.string().min(1).max(200),
  chatIds: chatIdsSchema.optional(),
});
const reportSchema = z.object({
  kind: z.enum(["daily", "weekly"]),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  chatIds: chatIdsSchema.optional(),
});

type DeliveryPayload = z.infer<typeof eventSchema> | z.infer<typeof reportSchema>;

type PickRow = {
  predictionId: string;
  eventId: string;
  sportKey: string;
  league: string;
  home: string;
  away: string;
  commenceTime: Date;
  market: string;
  selection: string;
  point: number | null;
  price: number;
  confidence: string | null;
  reasoningRu: string | null;
  reasoningEn: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
};

export async function queuePublish(payload: { kind: "forecast" | "result"; eventId: string }) {
  const queued = await enqueueJob("publish", payload, { deduplicationId: queueId(payload) });
  if (queued.ok) return;
  if (queued.reason !== "scheduler_unconfigured") throw new Error(queued.reason);
  await runPublish(payload);
}

export async function runPublish(payload: unknown, now = new Date()): Promise<JobOutcome> {
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) throw new JobInputError("invalid_payload");
  return runTelegramJob("publish", parsed.data, now);
}

export async function runDailyReport(payload: unknown, now = new Date()): Promise<JobOutcome> {
  return runTelegramJob("daily-report", reportPayload(payload, "daily", now), now);
}

export async function runWeeklyReport(payload: unknown, now = new Date()): Promise<JobOutcome> {
  return runTelegramJob("weekly-report", reportPayload(payload, "weekly", now), now);
}

function reportPayload(payload: unknown, kind: "daily" | "weekly", now: Date): z.infer<typeof reportSchema> {
  const source = payload && typeof payload === "object" ? payload : {};
  const day = "day" in source && typeof source.day === "string" ? source.day : dayKey(now, ZONE);
  const parsed = reportSchema.safeParse({
    kind,
    day,
    ...("chatIds" in source ? { chatIds: source.chatIds } : {}),
  });
  if (!parsed.success) throw new JobInputError("invalid_payload");
  return parsed.data;
}

async function runTelegramJob(job: "publish" | "daily-report" | "weekly-report", payload: DeliveryPayload, now: Date) {
  if (!telegramDeliveryEnabled()) return { status: "skipped" as const, detail: { reason: telegramSkipReason() } };
  return runJob({
    job,
    idempotencyKey: deliveryKey(payload),
    payload,
    now,
    work: () => deliver(job, payload, now),
  });
}

async function deliver(job: "publish" | "daily-report" | "weekly-report", payload: DeliveryPayload, now: Date): Promise<JobOutcome> {
  if (payload.chatIds) return deliverBatch(payload);
  if (payload.kind === "forecast" || payload.kind === "result") refreshPublicBoard();
  const built = await buildMessages(payload);
  if (!built) return { status: "skipped", detail: { reason: "nothing_to_send" } };

  const counts = emptyCounts();
  let retry = false;
  for (const target of channelTargets()) {
    const outcome = await sendOnce({
      chatId: target.chatId,
      locale: target.locale,
      type: payload.kind,
      predictionId: built.predictionId,
      dedupe: messageDedupe(payload.kind, target.chatId, built.id),
      text: built.text(target.locale),
      deactivateOnBlock: false,
    });
    counts[outcome] += 1;
    if (outcome === "retry") retry = true;
  }

  const recipients = await recipientsFor(payload, built.sportKey, now);
  const batches = planBatches(recipients, 25, now);
  for (const batch of batches) {
    const body = { ...payload, chatIds: batch.items.map((item) => item.chatId) };
    const queued = await enqueueJob(job, body, { notBefore: batch.notBefore ?? undefined, deduplicationId: queueId(body) });
    if (queued.ok) {
      counts.queued += 1;
      continue;
    }
    if (queued.reason !== "scheduler_unconfigured") throw new Error(queued.reason);
    if (batch.notBefore && batch.notBefore.getTime() > Date.now() + 15_000) {
      counts.delayed += 1;
      continue;
    }
    await runTelegramJob(job, body, new Date());
    counts.inline += 1;
  }

  if (retry) throw new Error("telegram_retry");
  return { status: "done", detail: counts };
}

async function deliverBatch(payload: DeliveryPayload): Promise<JobOutcome> {
  const built = await buildMessages(payload);
  if (!built) return { status: "skipped", detail: { reason: "nothing_to_send" } };
  const counts = emptyCounts();
  let retry = false;
  for (const chatId of payload.chatIds ?? []) {
    const subscriber = await getSubscriber(chatId);
    const locale = asLocale(subscriber?.locale);
    if (!subscriber?.active) continue;
    if (built.sportKey && !allowsLeague(parseLeagues(subscriber.leagues), built.sportKey)) continue;
    const outcome = await sendOnce({
      chatId,
      locale,
      type: payload.kind,
      predictionId: built.predictionId,
      dedupe: messageDedupe(payload.kind, chatId, built.id),
      text: built.text(locale),
      deactivateOnBlock: true,
    });
    counts[outcome] += 1;
    if (outcome === "retry") retry = true;
  }
  if (retry) throw new Error("telegram_retry");
  return { status: "done", detail: counts };
}

async function sendOnce(input: {
  chatId: string;
  locale: Locale;
  type: string;
  predictionId: string | null;
  dedupe: string;
  text: string;
  deactivateOnBlock: boolean;
}) {
  const [existing] = await getDb().select({ id: tgMessages.id }).from(tgMessages).where(eq(tgMessages.dedupe, input.dedupe)).limit(1);
  if (existing) return "duplicate" as const;
  const sent = await sendTelegramMessage(input.chatId, input.text);
  if (!sent.ok) {
    if (sent.blocked && input.deactivateOnBlock) await deactivateSubscriber(input.chatId);
    return sent.blocked ? ("blocked" as const) : sent.retry ? ("retry" as const) : ("failed" as const);
  }
  await getDb()
    .insert(tgMessages)
    .values({
      predictionId: input.predictionId,
      chatId: input.chatId,
      locale: input.locale,
      messageId: sent.messageId,
      type: input.type,
      dedupe: input.dedupe,
    })
    .onConflictDoNothing();
  return "sent" as const;
}

async function buildMessages(payload: DeliveryPayload) {
  if ("eventId" in payload) {
    const row = await loadPick(payload.eventId);
    if (!row) return null;
    if (payload.kind === "result" && row.status !== "won" && row.status !== "lost" && row.status !== "void") return null;
    const series = await seriesSnapshot();
    return {
      id: row.predictionId,
      predictionId: row.predictionId,
      sportKey: row.sportKey,
      text: (locale: Locale) => (payload.kind === "forecast" ? forecastText(row, locale) : resultText(row, locale, series)),
    };
  }
  const range = payload.kind === "daily" ? { from: payload.day, to: payload.day } : { from: shiftDay(payload.day, -6), to: payload.day };
  const board = await loadPublicBoard();
  const picks = board.available ? board.picks : [];
  const settled = picks.filter((pick) => onCalendarDay(pick.settledAt, range.from, range.to, ZONE));
  const series = metricsOf(picks);
  return {
    id: payload.day,
    predictionId: null,
    sportKey: null,
    text: (locale: Locale) =>
      reportMessage({
        locale,
        kind: payload.kind,
        from: range.from,
        to: range.to,
        published: picks.filter((pick) => onCalendarDay(pick.publishedAt, range.from, range.to, ZONE)).length,
        won: settled.filter((pick) => pick.status === "won").length,
        lost: settled.filter((pick) => pick.status === "lost").length,
        voided: settled.filter((pick) => pick.status === "void").length,
        ...series,
      }),
  };
}

function forecastText(row: PickRow, locale: Locale) {
  const copy: ForecastCopy = {
    locale,
    home: row.home,
    away: row.away,
    league: row.league,
    commenceTime: row.commenceTime.toISOString(),
    market: row.market,
    selection: row.selection,
    point: row.point,
    price: row.price,
    confidence: row.confidence,
    reasoning: locale === "ru" ? row.reasoningRu : row.reasoningEn,
    eventId: row.eventId,
  };
  return forecastMessage(copy);
}

function resultText(row: PickRow, locale: Locale, series: SeriesStats) {
  const status = row.status === "won" || row.status === "lost" || row.status === "void" ? row.status : "void";
  const copy: ResultCopy = {
    locale,
    home: row.home,
    away: row.away,
    market: row.market,
    selection: row.selection,
    point: row.point,
    price: row.price,
    status,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    eventId: row.eventId,
    ...series,
  };
  return resultMessage(copy);
}

async function loadPick(eventId: string): Promise<PickRow | null> {
  const [row] = await getDb()
    .select({
      predictionId: predictions.id,
      eventId: predictions.eventId,
      sportKey: events.sportKey,
      league: sports.title,
      home: events.home,
      away: events.away,
      commenceTime: events.commenceTime,
      market: predictions.market,
      selection: predictions.selection,
      point: predictions.point,
      price: predictions.price,
      confidence: predictions.confidence,
      reasoningRu: predictions.reasoningRu,
      reasoningEn: predictions.reasoningEn,
      status: predictions.status,
      homeScore: events.homeScore,
      awayScore: events.awayScore,
    })
    .from(predictions)
    .innerJoin(events, eq(predictions.eventId, events.id))
    .leftJoin(sports, eq(events.sportKey, sports.key))
    .where(and(eq(predictions.eventId, eventId), eq(predictions.track, "ai_pick")))
    .limit(1);
  if (!row) return null;
  return { ...row, league: row.league ?? row.sportKey };
}

async function seriesSnapshot(): Promise<SeriesStats> {
  const board = await loadPublicBoard();
  return metricsOf(board.available ? board.picks : []);
}

function metricsOf(picks: PublicPick[]): SeriesStats {
  const block = summarize({ picks, baselines: [], votes: [] }).aiPick;
  return { roi: block.roi, hitRate: block.hitRate, decided: block.decided };
}

async function recipientsFor(payload: DeliveryPayload, sportKey: string | null, now: Date) {
  const subscribers = await listActiveSubscribers();
  return subscribers.flatMap((subscriber) => {
    const leagues = parseLeagues(subscriber.leagues);
    if (sportKey && !allowsLeague(leagues, sportKey)) return [];
    const locale = asLocale(subscriber.locale);
    const until = quietUntil(now, parseQuiet(subscriber.quietHours), locale === "ru" ? ZONE : "UTC");
    return [{ chatId: subscriber.telegramId, notBefore: until }];
  });
}

function allowsLeague(leagues: string[] | null, sportKey: string) {
  if (leagues == null) return true;
  return leagues.includes(sportKey);
}

function channelTargets(): { chatId: string; locale: Locale }[] {
  const ru = process.env.TELEGRAM_CHANNEL_RU?.trim();
  const en = process.env.TELEGRAM_CHANNEL_EN?.trim();
  return [
    ...(ru ? [{ chatId: ru, locale: "ru" as const }] : []),
    ...(en ? [{ chatId: en, locale: "en" as const }] : []),
  ];
}

function messageDedupe(type: string, chatId: string, id: string) {
  return `${type}:${chatId}:${id}`;
}

function deliveryKey(payload: DeliveryPayload) {
  const id = "eventId" in payload ? payload.eventId : payload.day;
  const scope = payload.chatIds ? payload.chatIds.join(",") : "root";
  return `tg:${payload.kind}:${id}:${scope}`;
}

function queueId(payload: { kind: string; eventId?: string; day?: string; chatIds?: string[] }) {
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
  const id = payload.eventId ?? payload.day ?? "root";
  return `tg-${payload.kind}-${id}-${hash}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 128);
}

function emptyCounts() {
  return { sent: 0, duplicate: 0, blocked: 0, failed: 0, retry: 0, queued: 0, delayed: 0, inline: 0 };
}

type SeriesStats = { roi: number | null; hitRate: number | null; decided: number };
