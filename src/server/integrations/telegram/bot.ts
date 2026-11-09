import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { Bot, InlineKeyboard } from "grammy";
import { loadBudget } from "@/server/admin/queries";
import { getDb } from "@/server/db";
import { appSettings, jobRuns } from "@/server/db/schema";
import { summarize } from "@/server/domain/stats/metrics";
import { adminIds } from "@/server/integrations/telegram/alerts";
import {
  deniedMessage,
  kickoffLabel,
  lastMessage,
  needStartMessage,
  pickLine,
  settingsMessage,
  startMessage,
  statsMessage,
  stoppedMessage,
  todayMessage,
  unavailableMessage,
} from "@/server/integrations/telegram/format";
import { asLocale, localeFromLanguage, nextLeagues, parseLeagues, parseQuiet, QUIET_PRESET, type Locale } from "@/server/integrations/telegram/preferences";
import { dayKey } from "@/server/integrations/telegram/quiet";
import { qstashConfigured } from "@/server/integrations/qstash/client";
import { redisConfigured } from "@/server/integrations/redis/client";
import {
  deactivateSubscriber,
  getSubscriber,
  setSubscriberLeagues,
  setSubscriberLocale,
  setSubscriberQuiet,
  upsertSubscriber,
} from "@/server/integrations/telegram/subscribers";
import { enabledLeagues } from "@/server/jobs/persist";
import { loadPublicBoard } from "@/server/stats/load";

let bot: Bot | null = null;

export function getTelegramBot(token: string) {
  if (bot) return bot;
  bot = new Bot(token);
  register(bot);
  return bot;
}

function register(instance: Bot) {
  instance.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private") return;
    await next();
  });
  instance.command("start", (ctx) => reply(ctx, () => onStart(ctx)));
  instance.command("stop", (ctx) => reply(ctx, () => onStop(ctx)));
  instance.command("lang", (ctx) => reply(ctx, () => onLang(ctx)));
  instance.command("today", (ctx) => reply(ctx, () => onToday(ctx)));
  instance.command("stats", (ctx) => reply(ctx, () => onStats(ctx)));
  instance.command("last", (ctx) => reply(ctx, () => onLast(ctx)));
  instance.command("settings", (ctx) => reply(ctx, () => onSettings(ctx)));
  instance.command("budget", (ctx) => reply(ctx, () => onBudget(ctx)));
  instance.command("health", (ctx) => reply(ctx, () => onHealth(ctx)));
  instance.on("callback_query:data", (ctx) => reply(ctx, () => onCallback(ctx)));
  instance.catch((error) => {
    console.error("telegram", error instanceof Error ? error.message : "failed");
  });
}

async function reply(
  ctx: { from?: { language_code?: string }; reply: (text: string, extra?: object) => Promise<unknown> },
  work: () => Promise<void>,
) {
  try {
    await work();
  } catch (error) {
    console.error("telegram command", error instanceof Error ? error.message : "failed");
    await ctx.reply(unavailableMessage(localeFromLanguage(ctx.from?.language_code))).catch(() => undefined);
  }
}

async function onStart(ctx: CommandContext) {
  const from = sender(ctx);
  if (!from) return;
  const locale = localeFromLanguage(from.languageCode);
  await upsertSubscriber({ telegramId: from.id, username: from.username, locale });
  await ctx.reply(startMessage(locale));
}

async function onStop(ctx: CommandContext) {
  const from = sender(ctx);
  if (!from) return;
  const subscriber = await getSubscriber(from.id);
  const locale = asLocale(subscriber?.locale ?? localeFromLanguage(from.languageCode));
  await deactivateSubscriber(from.id);
  await ctx.reply(stoppedMessage(locale));
}

async function onLang(ctx: CommandContext) {
  const subscriber = await requireSubscriber(ctx);
  if (!subscriber) return;
  const argument = ctx.match.trim().toLowerCase();
  const locale: Locale = argument === "ru" || argument === "en" ? argument : subscriber.locale === "ru" ? "en" : "ru";
  await setSubscriberLocale(subscriber.id, locale);
  await ctx.reply(startMessage(locale));
}

async function onToday(ctx: CommandContext) {
  const subscriber = await requireSubscriber(ctx);
  if (!subscriber) return;
  const board = await loadPublicBoard();
  if (!board.available) {
    await ctx.reply(unavailableMessage(subscriber.locale));
    return;
  }
  const zone = subscriber.locale === "ru" ? "Europe/Moscow" : "UTC";
  const today = dayKey(new Date(), zone);
  const rows = board.picks
    .filter((pick) => pick.commenceTime && dayKey(new Date(pick.commenceTime), zone) === today)
    .sort((left, right) => (left.commenceTime ?? "").localeCompare(right.commenceTime ?? ""))
    .map((pick) => ({
      home: pick.home,
      away: pick.away,
      when: kickoffLabel(pick.commenceTime ?? new Date().toISOString(), subscriber.locale),
      line: pickLine({ ...pick, locale: subscriber.locale }),
    }));
  await ctx.reply(todayMessage(subscriber.locale, rows), { parse_mode: "HTML" });
}

async function onStats(ctx: CommandContext) {
  const subscriber = await requireSubscriber(ctx);
  if (!subscriber) return;
  const board = await loadPublicBoard();
  if (!board.available) {
    await ctx.reply(unavailableMessage(subscriber.locale));
    return;
  }
  const block = summarize({ picks: board.picks, baselines: board.baselines, votes: board.votes }).aiPick;
  await ctx.reply(
    statsMessage(subscriber.locale, {
      roi: block.roi,
      hitRate: block.hitRate,
      decided: block.decided,
      won: block.won,
      lost: block.lost,
      voided: block.void,
      pending: block.pending,
    }),
    { parse_mode: "HTML" },
  );
}

async function onLast(ctx: CommandContext) {
  const subscriber = await requireSubscriber(ctx);
  if (!subscriber) return;
  const board = await loadPublicBoard();
  if (!board.available) {
    await ctx.reply(unavailableMessage(subscriber.locale));
    return;
  }
  const rows = board.picks
    .filter((pick) => pick.status !== "pending")
    .sort((left, right) => (right.settledAt ?? "").localeCompare(left.settledAt ?? ""))
    .slice(0, 10)
    .flatMap((pick) =>
      pick.status === "won" || pick.status === "lost" || pick.status === "void"
        ? [{ home: pick.home, away: pick.away, status: pick.status, line: pickLine({ ...pick, locale: subscriber.locale }) }]
        : [],
    );
  await ctx.reply(lastMessage(subscriber.locale, rows), { parse_mode: "HTML" });
}

async function onSettings(ctx: CommandContext) {
  const subscriber = await requireSubscriber(ctx);
  if (!subscriber) return;
  await sendSettings(ctx, subscriber.id);
}

async function onCallback(ctx: CallbackContext) {
  const from = sender(ctx);
  if (!from) return;
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();
  const subscriber = await getSubscriber(from.id);
  if (!subscriber?.active) {
    await ctx.reply(needStartMessage(localeFromLanguage(from.languageCode)));
    return;
  }
  if (data === "set:lang:ru" || data === "set:lang:en") await setSubscriberLocale(from.id, data.endsWith("en") ? "en" : "ru");
  if (data === "set:quiet:off") await setSubscriberQuiet(from.id, null);
  if (data === "set:quiet:2308") await setSubscriberQuiet(from.id, QUIET_PRESET);
  if (data === "set:league:all" || data.startsWith("set:league:")) {
    const options = await leagueOptions();
    const key = data === "set:league:all" ? "all" : data.slice("set:league:".length);
    await setSubscriberLeagues(from.id, nextLeagues(parseLeagues(subscriber.leagues), key, options.map((item) => item.key)));
  }
  await sendSettings(ctx, from.id, true);
}

async function onBudget(ctx: CommandContext) {
  const from = sender(ctx);
  if (!from) return;
  const locale = asLocale((await getSubscriber(from.id))?.locale ?? localeFromLanguage(from.languageCode));
  if (!adminIds().includes(from.id)) {
    await ctx.reply(deniedMessage(locale));
    return;
  }
  const budget = await loadBudget();
  await ctx.reply(
    [
      `Остаток: ${budget.snapshot.remaining}`,
      `Резерв: ${budget.snapshot.reserveCredits}`,
      `Лимит месяца: ${budget.snapshot.monthlyLimit}`,
      `Потрачено: ${budget.snapshot.used}`,
    ].join("\n"),
  );
}

async function onHealth(ctx: CommandContext) {
  const from = sender(ctx);
  if (!from) return;
  const locale = asLocale((await getSubscriber(from.id))?.locale ?? localeFromLanguage(from.languageCode));
  if (!adminIds().includes(from.id)) {
    await ctx.reply(deniedMessage(locale));
    return;
  }
  let database = "ок";
  try {
    await getDb().select({ id: appSettings.id }).from(appSettings).limit(1);
  } catch {
    database = "недоступна";
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const failed = await getDb()
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(and(eq(jobRuns.status, "failed"), gte(jobRuns.finishedAt, since)));
  await ctx.reply(
    [
      `База: ${database}`,
      `QStash: ${qstashConfigured() ? "настроен" : "нет"}`,
      `Redis: ${redisConfigured() ? "настроен" : "нет"}`,
      `Ошибок задач за сутки: ${failed.length}`,
    ].join("\n"),
  );
}

async function sendSettings(ctx: { reply: (text: string, extra?: object) => Promise<unknown>; editMessageText?: (text: string, extra?: object) => Promise<unknown> }, telegramId: string, edit = false) {
  const subscriber = await getSubscriber(telegramId);
  if (!subscriber) return;
  const locale = asLocale(subscriber.locale);
  const options = await leagueOptions();
  const leagues = parseLeagues(subscriber.leagues);
  const quiet = parseQuiet(subscriber.quietHours);
  const message = settingsMessage({ locale, quiet, leagues, options });
  const keyboard = settingsKeyboard(locale, quiet != null, leagues, options);
  if (edit && ctx.editMessageText) {
    try {
      await ctx.editMessageText(message, { parse_mode: "HTML", reply_markup: keyboard });
      return;
    } catch (error) {
      const description = error instanceof Error ? error.message : "";
      if (description.includes("message is not modified")) return;
    }
  }
  await ctx.reply(message, { parse_mode: "HTML", reply_markup: keyboard });
}

function settingsKeyboard(
  locale: Locale,
  quietOn: boolean,
  leagues: string[] | null,
  options: { key: string; title: string }[],
) {
  const keyboard = new InlineKeyboard()
    .text(locale === "ru" ? "Русский" : "Russian", "set:lang:ru")
    .text("English", "set:lang:en")
    .row()
    .text(
      quietOn ? (locale === "ru" ? "Тихие часы: выкл" : "Quiet hours: off") : locale === "ru" ? "Тихие 23:00–08:00" : "Quiet 23:00–08:00",
      quietOn ? "set:quiet:off" : "set:quiet:2308",
    )
    .row()
    .text(leagues == null ? `✓ ${locale === "ru" ? "Все лиги" : "All leagues"}` : locale === "ru" ? "Все лиги" : "All leagues", "set:league:all");
  for (const option of options) {
    const data = `set:league:${option.key}`;
    if (data.length > 64) continue;
    const on = leagues == null || leagues.includes(option.key);
    keyboard.row().text(`${on ? "✓" : "·"} ${option.title}`.slice(0, 60), data);
  }
  return keyboard;
}

async function leagueOptions() {
  const rows = await enabledLeagues();
  return rows.map((row) => ({ key: row.key, title: row.title }));
}

async function requireSubscriber(ctx: CommandContext) {
  const from = sender(ctx);
  if (!from) return null;
  const subscriber = await getSubscriber(from.id);
  if (!subscriber?.active) {
    await ctx.reply(needStartMessage(localeFromLanguage(from.languageCode)));
    return null;
  }
  return { id: from.id, locale: asLocale(subscriber.locale), leagues: subscriber.leagues };
}

type Sender = { id: string; username: string | null; languageCode?: string };

function sender(ctx: { from?: { id: number; username?: string; language_code?: string } }): Sender | null {
  if (!ctx.from) return null;
  return { id: String(ctx.from.id), username: ctx.from.username ?? null, languageCode: ctx.from.language_code };
}

type CommandContext = {
  match: string;
  from?: { id: number; username?: string; language_code?: string };
  reply: (text: string, extra?: object) => Promise<unknown>;
};

type CallbackContext = {
  from?: { id: number; username?: string; language_code?: string };
  callbackQuery: { data: string };
  reply: (text: string, extra?: object) => Promise<unknown>;
  editMessageText: (text: string, extra?: object) => Promise<unknown>;
  answerCallbackQuery: () => Promise<unknown>;
};
