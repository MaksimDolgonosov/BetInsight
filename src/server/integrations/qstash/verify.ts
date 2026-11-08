import { Receiver } from "@upstash/qstash";
import { timingSafeEqual } from "node:crypto";

export type JobAuth =
  | { ok: true; source: "qstash" | "cron" }
  | { ok: false; reason: "unauthorized" };

export async function authorizeJobRequest(request: Request, rawBody: string): Promise<JobAuth> {
  if (cronAuthorized(request)) return { ok: true, source: "cron" };

  const signature = request.headers.get("upstash-signature");
  if (!signature) return { ok: false, reason: "unauthorized" };

  try {
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    });
    const valid = await receiver.verify({
      signature,
      body: rawBody,
      clockTolerance: 5,
      upstashRegion: request.headers.get("upstash-region") ?? undefined,
    });
    return valid ? { ok: true, source: "qstash" } : { ok: false, reason: "unauthorized" };
  } catch {
    return { ok: false, reason: "unauthorized" };
  }
}

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  const left = Buffer.from(token);
  const right = Buffer.from(secret);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
