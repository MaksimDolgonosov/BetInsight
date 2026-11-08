import { isJobName } from "@/server/integrations/qstash/jobs";
import { authorizeJobRequest } from "@/server/integrations/qstash/verify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ job: string }> }) {
  const rawBody = await request.text();
  const auth = await authorizeJobRequest(request, rawBody);
  if (!auth.ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { job } = await context.params;
  if (!isJobName(job)) return Response.json({ error: "unknown_job" }, { status: 404 });

  if (rawBody) {
    try {
      JSON.parse(rawBody);
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }
  }

  return Response.json({ ok: true, job, source: auth.source, status: "received" });
}
