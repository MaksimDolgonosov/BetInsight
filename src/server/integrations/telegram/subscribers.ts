import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { tgSubscribers } from "@/server/db/schema";
import type { Locale } from "@/server/integrations/telegram/preferences";

export async function getSubscriber(telegramId: string) {
  const [row] = await getDb().select().from(tgSubscribers).where(eq(tgSubscribers.telegramId, telegramId)).limit(1);
  return row ?? null;
}

export async function listActiveSubscribers() {
  return getDb().select().from(tgSubscribers).where(eq(tgSubscribers.active, true));
}

export async function upsertSubscriber(input: { telegramId: string; username: string | null; locale: Locale }) {
  await getDb()
    .insert(tgSubscribers)
    .values({
      telegramId: input.telegramId,
      username: input.username,
      locale: input.locale,
      active: true,
    })
    .onConflictDoUpdate({
      target: tgSubscribers.telegramId,
      set: { username: input.username, locale: input.locale, active: true },
    });
}

export async function deactivateSubscriber(telegramId: string) {
  await getDb().update(tgSubscribers).set({ active: false }).where(eq(tgSubscribers.telegramId, telegramId));
}

export async function setSubscriberLocale(telegramId: string, locale: Locale) {
  await getDb().update(tgSubscribers).set({ locale }).where(eq(tgSubscribers.telegramId, telegramId));
}

export async function setSubscriberQuiet(telegramId: string, quietHours: { start: string; end: string } | null) {
  await getDb().update(tgSubscribers).set({ quietHours }).where(eq(tgSubscribers.telegramId, telegramId));
}

export async function setSubscriberLeagues(telegramId: string, leagues: string[] | null) {
  await getDb().update(tgSubscribers).set({ leagues }).where(eq(tgSubscribers.telegramId, telegramId));
}
