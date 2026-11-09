import "server-only";
import { getQstashClient } from "@/server/integrations/qstash/client";
import { isJobName } from "@/server/integrations/qstash/jobs";

export async function enqueueJob(
  job: string,
  payload: unknown,
  options?: { notBefore?: Date; deduplicationId?: string },
): Promise<
  | { ok: true; messageId: string }
  | { ok: false; reason: "unknown_job" | "scheduler_unconfigured" | "publish_failed" }
> {
  if (!isJobName(job)) return { ok: false, reason: "unknown_job" };
  const client = getQstashClient();
  const base = appBaseUrl();
  if (!client || !base) return { ok: false, reason: "scheduler_unconfigured" };
  const notBefore =
    options?.notBefore && options.notBefore.getTime() > Date.now() + 15_000
      ? Math.floor(options.notBefore.getTime() / 1000)
      : undefined;

  try {
    const response = await client.publishJSON({
      url: `${base}/api/jobs/${job}`,
      body: payload ?? {},
      retries: 3,
      notBefore,
      deduplicationId: options?.deduplicationId,
    });
    const messageId =
      typeof response === "object" && response && "messageId" in response
        ? String(response.messageId)
        : "queued";
    return { ok: true, messageId };
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
    if (status === 409) return { ok: true, messageId: "duplicate" };
    return { ok: false, reason: "publish_failed" };
  }
}

export function appBaseUrl(): string | null {
  const raw = process.env.AUTH_URL || process.env.VERCEL_URL;
  if (!raw) return null;
  const withProtocol = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}
