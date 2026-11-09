import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { tgMessages } from "@/server/db/schema";
import { sendTelegramMessage, telegramDeliveryEnabled } from "@/server/integrations/telegram/client";

export function adminIds(): string[] {
  return (process.env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function alertAdmins(text: string, dedupe: string) {
  if (!telegramDeliveryEnabled()) return;
  for (const chatId of adminIds()) {
    const key = `${dedupe}:${chatId}`;
    const [existing] = await getDb().select({ id: tgMessages.id }).from(tgMessages).where(eq(tgMessages.dedupe, key)).limit(1);
    if (existing) continue;
    const sent = await sendTelegramMessage(chatId, text);
    if (!sent.ok) continue;
    await getDb()
      .insert(tgMessages)
      .values({ chatId, locale: "ru", messageId: sent.messageId, type: "alert", dedupe: key })
      .onConflictDoNothing();
  }
}

export async function alertBudget(reason: "reserve" | "insufficient", now: Date) {
  const day = now.toISOString().slice(0, 10);
  const text =
    reason === "reserve"
      ? "Месячный бюджет кредитов: остался только резерв. Новые запросы, кроме счетов матчей, пропускаются."
      : "Месячный бюджет кредитов исчерпан. Запросы пропускаются.";
  await alertAdmins(text, `alert:budget:${day}`);
}
