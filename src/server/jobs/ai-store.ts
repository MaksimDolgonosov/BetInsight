import "server-only";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/server/db";
import { aiConsensus, aiRequests, aiVotes, events, modelEvaluations, predictions } from "@/server/db/schema";
import { samePoint, type PredictionTrack } from "@/server/domain/predictions/publish";
import { refreshPublicBoard } from "@/server/stats/refresh";

export function mskDayRange(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00+03:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export async function loadEvent(eventId: string) {
  const [event] = await getDb().select().from(events).where(eq(events.id, eventId)).limit(1);
  return event ?? null;
}

export async function latestJobEvaluations(eventId: string) {
  const rows = await getDb().select().from(modelEvaluations).where(and(eq(modelEvaluations.eventId, eventId), eq(modelEvaluations.source, "job")));
  if (rows.length === 0) return [];
  const latest = Math.max(...rows.map((row) => row.createdAt.getTime()));
  return rows.filter((row) => latest - row.createdAt.getTime() < 5000);
}

export async function predictionExists(eventId: string, track: PredictionTrack): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: predictions.id })
    .from(predictions)
    .where(and(eq(predictions.eventId, eventId), eq(predictions.track, track)))
    .limit(1);
  return Boolean(row);
}

export async function otherTrackAgrees(input: {
  eventId: string;
  track: PredictionTrack;
  market: string;
  selection: string;
  point: number | null;
}): Promise<boolean> {
  const other = input.track === "value" ? "ai_pick" : "value";
  const [row] = await getDb()
    .select()
    .from(predictions)
    .where(and(eq(predictions.eventId, input.eventId), eq(predictions.track, other)))
    .limit(1);
  if (!row) return false;
  return row.market === input.market && row.selection === input.selection && samePoint(row.point, input.point);
}

export async function savePrediction(row: {
  eventId: string;
  track: PredictionTrack;
  tracksAgree: boolean;
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
  llmModel: string;
  promptVersion: string;
  publishedAt: Date;
  hash: string;
}): Promise<"saved" | "duplicate" | "too_late"> {
  const db = getDb();
  try {
    await db.insert(predictions).values({ ...row, status: "pending" });
  } catch (error) {
    const text = errorText(error);
    if (text.includes("commence_time")) return "too_late";
    if (text.includes("predictions_event_track") || text.includes("duplicate key")) return "duplicate";
    throw error;
  }
  if (row.tracksAgree) {
    const other = row.track === "value" ? "ai_pick" : "value";
    await db
      .update(predictions)
      .set({ tracksAgree: true })
      .where(and(eq(predictions.eventId, row.eventId), eq(predictions.track, other)));
  }
  refreshPublicBoard();
  return "saved";
}

export async function countTrackPredictions(track: PredictionTrack, start: Date, end: Date): Promise<number> {
  const rows = await getDb()
    .select({ id: predictions.id })
    .from(predictions)
    .where(and(eq(predictions.track, track), gte(predictions.publishedAt, start), lt(predictions.publishedAt, end)));
  return rows.length;
}

export async function latestResearchText(eventId: string, start: Date): Promise<string> {
  const [row] = await getDb()
    .select()
    .from(aiRequests)
    .where(and(eq(aiRequests.eventId, eventId), eq(aiRequests.purpose, "research"), eq(aiRequests.source, "job"), gte(aiRequests.createdAt, start)))
    .orderBy(desc(aiRequests.createdAt))
    .limit(1);
  if (!row || row.error) return "";
  const content = row.rawResponse;
  if (content && typeof content === "object" && "content" in content && typeof content.content === "string") return content.content;
  return "";
}

export async function votesForEvent(eventId: string, start: Date) {
  return getDb()
    .select()
    .from(aiVotes)
    .where(and(eq(aiVotes.eventId, eventId), eq(aiVotes.source, "job"), gte(aiVotes.createdAt, start)));
}

export async function votedModels(eventId: string, start: Date): Promise<string[]> {
  const rows = await getDb()
    .select({ model: aiRequests.model })
    .from(aiRequests)
    .where(and(eq(aiRequests.eventId, eventId), eq(aiRequests.purpose, "vote"), eq(aiRequests.source, "job"), gte(aiRequests.createdAt, start)));
  return [...new Set(rows.map((row) => row.model))];
}

export async function consensusExists(eventId: string, start: Date): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: aiConsensus.id })
    .from(aiConsensus)
    .where(and(eq(aiConsensus.eventId, eventId), eq(aiConsensus.source, "job"), gte(aiConsensus.createdAt, start)))
    .limit(1);
  return Boolean(row);
}

export async function saveConsensus(row: typeof aiConsensus.$inferInsert) {
  await getDb().insert(aiConsensus).values(row);
}

export async function listSavedPredictions(limit: number) {
  return getDb()
    .select({
      id: predictions.id,
      eventId: predictions.eventId,
      home: events.home,
      away: events.away,
      track: predictions.track,
      tracksAgree: predictions.tracksAgree,
      market: predictions.market,
      selection: predictions.selection,
      point: predictions.point,
      price: predictions.price,
      bookmaker: predictions.bookmaker,
      confidence: predictions.confidence,
      reasoningRu: predictions.reasoningRu,
      reasoningEn: predictions.reasoningEn,
      status: predictions.status,
      publishedAt: predictions.publishedAt,
    })
    .from(predictions)
    .innerJoin(events, eq(predictions.eventId, events.id))
    .orderBy(desc(predictions.publishedAt))
    .limit(limit);
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.message} ${String(error.cause ?? "")}`;
  return String(error);
}
