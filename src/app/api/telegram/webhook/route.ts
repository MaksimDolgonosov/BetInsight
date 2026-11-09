import { webhookCallback } from "grammy";
import { getTelegramBot } from "@/server/integrations/telegram/bot";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type WebhookHandler = (request: Request) => Promise<Response>;

let handler: WebhookHandler | null = null;

export function POST(request: Request) {
  if (process.env.VERCEL_ENV === "preview") return new Response(null, { status: 404 });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) return Response.json({ error: "unconfigured" }, { status: 503 });
  handler ??= webhookCallback(getTelegramBot(token), "std/http", { secretToken: secret });
  return handler(request);
}
