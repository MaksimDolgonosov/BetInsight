import "server-only";
import { Client } from "@upstash/qstash";

const JOBS = new Set([
  "sync-sports",
  "sync-events",
  "plan-day",
  "fetch-odds",
  "evaluate-model",
  "ai-predict",
  "publish",
  "fetch-closing-odds",
  "fetch-scores",
  "settle",
  "daily-report",
  "weekly-report",
]);

export async function enqueueJob(
  job: string,
  payload: unknown,
): Promise<
  | { ok: true; messageId: string }
  | { ok: false; reason: "unknown_job" | "scheduler_unconfigured" | "publish_failed" }
> {
  if (!JOBS.has(job)) return { ok: false, reason: "unknown_job" };
  const token = process.env.QSTASH_TOKEN;
  const base = appBaseUrl();
  if (!token || !base) return { ok: false, reason: "scheduler_unconfigured" };

  try {
    const client = new Client({ token });
    const response = await client.publishJSON({
      url: `${base}/api/jobs/${job}`,
      body: payload ?? {},
      retries: 3,
    });
    const messageId =
      typeof response === "object" && response && "messageId" in response
        ? String(response.messageId)
        : "queued";
    return { ok: true, messageId };
  } catch {
    return { ok: false, reason: "publish_failed" };
  }
}

function appBaseUrl(): string | null {
  const raw = process.env.AUTH_URL || process.env.VERCEL_URL;
  if (!raw) return null;
  const withProtocol = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}
