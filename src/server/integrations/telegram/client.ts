import "server-only";
import { deliveryFailure } from "@/server/integrations/telegram/policy";

export type SendResult =
  | { ok: true; messageId: number }
  | { ok: false; blocked: boolean; retry: boolean; reason: string };

export function telegramDeliveryEnabled() {
  if (process.env.VERCEL_ENV === "preview") return false;
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function telegramSkipReason(): "preview" | "unconfigured" {
  return process.env.VERCEL_ENV === "preview" ? "preview" : "unconfigured";
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<SendResult> {
  if (process.env.VERCEL_ENV === "preview") return { ok: false, blocked: false, retry: false, reason: "preview" };
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, blocked: false, retry: false, reason: "unconfigured" };

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch {
    return { ok: false, blocked: false, retry: true, reason: "network" };
  }

  if (!response.ok) {
    const failure = deliveryFailure(response.status);
    return { ok: false, blocked: failure.blocked, retry: failure.retry, reason: `http_${response.status}` };
  }

  const body = (await response.json()) as { ok?: boolean; result?: { message_id?: number } };
  if (!body.ok || typeof body.result?.message_id !== "number") {
    return { ok: false, blocked: false, retry: true, reason: "bad_response" };
  }
  return { ok: true, messageId: body.result.message_id };
}
