import { alertAdmins } from "@/server/integrations/telegram/alerts";
import { shouldAlertAfterRetries } from "@/server/integrations/telegram/policy";
import { isJobName } from "@/server/integrations/qstash/jobs";
import { authorizeJobRequest } from "@/server/integrations/qstash/verify";
import { JobBusyError, JobInputError } from "@/server/jobs/errors";
import { isDataJob, runDataJob } from "@/server/jobs/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ job: string }> }) {
  const rawBody = await request.text();
  const auth = await authorizeJobRequest(request, rawBody);
  if (!auth.ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { job } = await context.params;
  if (!isJobName(job)) return Response.json({ error: "unknown_job" }, { status: 404 });

  let payload: unknown = {};
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }
  }

  if (!isDataJob(job)) {
    return Response.json({ ok: true, job, source: auth.source, status: "received" });
  }

  try {
    const outcome = await runDataJob(job, payload);
    return Response.json({ ok: true, job, source: auth.source, ...outcome });
  } catch (error) {
    if (!(error instanceof JobInputError) && !(error instanceof JobBusyError)) {
      console.error("job failed", job, error instanceof Error ? error.message : "failed");
    }
    const status = error instanceof JobInputError ? 400 : error instanceof JobBusyError ? 503 : 500;
    if (shouldAlertAfterRetries(status, Number(request.headers.get("upstash-retried") ?? "0"))) {
      try {
        await alertAdmins(`Задача ${job} завершилась ошибкой после повторов.`, `alert:job:${job}:${new Date().toISOString().slice(0, 10)}`);
      } catch (alertError) {
        console.error("job alert", alertError instanceof Error ? alertError.message : "failed");
      }
    }
    if (error instanceof JobInputError) return Response.json({ error: "invalid_payload" }, { status: 400 });
    if (error instanceof JobBusyError) return Response.json({ error: "busy" }, { status: 503 });
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
