import "server-only";
import { appBaseUrl } from "@/server/integrations/qstash/enqueue";
import { getQstashClient } from "@/server/integrations/qstash/client";

const DATA_SCHEDULES = [
  { job: "sync-sports", cron: "CRON_TZ=Europe/Moscow 0 4 * * 1" },
  { job: "sync-events", cron: "CRON_TZ=Europe/Moscow 0 */6 * * *" },
  { job: "plan-day", cron: "CRON_TZ=Europe/Moscow 0 6 * * *" },
  { job: "daily-report", cron: "CRON_TZ=Europe/Moscow 0 23 * * *" },
  { job: "weekly-report", cron: "CRON_TZ=Europe/Moscow 0 10 * * 1" },
] as const;

export async function ensureDataSchedules(): Promise<"registered" | "skipped"> {
  if (process.env.VERCEL_ENV !== "production") return "skipped";
  const base = appBaseUrl();
  const client = getQstashClient();
  if (!client || !base?.startsWith("https://")) return "skipped";

  const existing = await client.schedules.list();
  for (const item of DATA_SCHEDULES) {
    const destination = `${base}/api/jobs/${item.job}`;
    const found = existing.find((schedule) => schedule.destination === destination);
    if (found?.cron === item.cron) continue;
    if (found) await client.schedules.delete(found.scheduleId);
    await client.schedules.create({
      destination,
      cron: item.cron,
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      retries: 3,
    });
  }
  return "registered";
}
