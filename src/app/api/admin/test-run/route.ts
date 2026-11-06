import { auth } from "@/server/auth";
import { startTestRun } from "@/server/admin/test-run";
import { MARKETS } from "@/server/domain/settings";
import type { TestTrack } from "@/server/admin/test-events";
import { z } from "zod";

export const maxDuration = 300;

const bodySchema = z.object({
  sportKey: z.string().regex(/^[a-z0-9_]{3,80}$/),
  markets: z.array(z.enum(MARKETS)).min(1),
  tracks: z.array(z.enum(["value", "ai_pick"])).min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!sameOrigin(request)) {
    return Response.json({ error: "csrf" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const result = await startTestRun({
    sportKey: parsed.data.sportKey,
    markets: parsed.data.markets,
    tracks: parsed.data.tracks as TestTrack[],
    actor: session.user.email ?? "admin",
  });
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return new Response(result.stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
