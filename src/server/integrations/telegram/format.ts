import { siteOrigin } from "@/server/site";
import type { Locale } from "@/server/integrations/telegram/preferences";

export type PickCopy = {
  locale: Locale;
  home: string;
  away: string;
  market: string;
  selection: string;
  point: number | null;
  price: number;
};

export type ForecastCopy = PickCopy & {
  league: string;
  commenceTime: string;
  confidence: string | null;
  reasoning: string | null;
  eventId: string;
  origin?: string;
};

export type ResultCopy = PickCopy & {
  status: "won" | "lost" | "void";
  homeScore: number | null;
  awayScore: number | null;
  eventId: string;
  roi: number | null;
  hitRate: number | null;
  decided: number;
  origin?: string;
};

export type ReportCopy = {
  locale: Locale;
  kind: "daily" | "weekly";
  from: string;
  to: string;
  published: number;
  won: number;
  lost: number;
  voided: number;
  roi: number | null;
  hitRate: number | null;
  decided: number;
  origin?: string;
};

const MESSAGE_LIMIT = 3900;

export function forecastMessage(input: ForecastCopy): string {
  const labels = text(input.locale);
  const reasoning = input.reasoning ? shorten(input.reasoning, 500) : "";
  const lines = [
    `<b>${labels.forecast}</b>`,
    escapeHtml(input.league),
    `<b>${escapeHtml(input.home)} — ${escapeHtml(input.away)}</b>`,
    kickoffLabel(input.commenceTime, input.locale),
    "",
    `${pickLine(input)}`,
    input.confidence ? `${labels.confidence}: ${confidenceLabel(input.locale, input.confidence)}` : "",
    reasoning ? `\n${escapeHtml(reasoning)}` : "",
    "",
    eventLink(input.locale, input.eventId, input.origin),
  ];
  return clamp(lines.filter((line) => line !== "").join("\n"));
}

export function resultMessage(input: ResultCopy): string {
  const labels = text(input.locale);
  const score =
    input.homeScore != null && input.awayScore != null ? `${labels.score} ${input.homeScore}:${input.awayScore}` : "";
  const lines = [
    `${statusIcon(input.status)} <b>${statusLabel(input.locale, input.status)}</b>`,
    `<b>${escapeHtml(input.home)} — ${escapeHtml(input.away)}</b>`,
    pickLine(input),
    score,
    "",
    seriesLine(input.locale, input),
    eventLink(input.locale, input.eventId, input.origin),
  ];
  return clamp(lines.filter((line) => line !== "").join("\n"));
}

export function reportMessage(input: ReportCopy): string {
  const labels = text(input.locale);
  const title = input.kind === "daily" ? labels.daily : labels.weekly;
  const period = input.from === input.to ? input.to : `${input.from} — ${input.to}`;
  const lines = [
    `<b>${title}</b>`,
    period,
    "",
    `${labels.published}: ${input.published}`,
    `${labels.settled}: ${statusIcon("won")} ${input.won} · ${statusIcon("lost")} ${input.lost} · ${statusIcon("void")} ${input.voided}`,
    seriesLine(input.locale, input),
    "",
    `<a href="${escapeHtml(input.origin ?? siteOrigin())}/${input.locale}">${labels.site}</a>`,
  ];
  return clamp(lines.join("\n"));
}

export function startMessage(locale: Locale): string {
  return text(locale).start;
}

export function stoppedMessage(locale: Locale): string {
  return text(locale).stopped;
}

export function needStartMessage(locale: Locale): string {
  return text(locale).needStart;
}

export function deniedMessage(locale: Locale): string {
  return text(locale).denied;
}

export function todayMessage(locale: Locale, rows: { home: string; away: string; when: string; line: string }[]): string {
  const labels = text(locale);
  if (rows.length === 0) return labels.todayEmpty;
  const body = rows.map((row) => `<b>${escapeHtml(row.home)} — ${escapeHtml(row.away)}</b>\n${escapeHtml(row.when)}\n${row.line}`).join("\n\n");
  return clamp(`<b>${labels.today}</b>\n\n${body}`);
}

export function statsMessage(
  locale: Locale,
  input: { roi: number | null; hitRate: number | null; decided: number; won: number; lost: number; voided: number; pending: number },
): string {
  const labels = text(locale);
  return [
    `<b>${labels.stats}</b>`,
    seriesLine(locale, input),
    `${statusIcon("won")} ${input.won} · ${statusIcon("lost")} ${input.lost} · ${statusIcon("void")} ${input.voided} · ${labels.pending} ${input.pending}`,
  ].join("\n");
}

export function lastMessage(
  locale: Locale,
  rows: { home: string; away: string; status: "won" | "lost" | "void"; line: string }[],
): string {
  const labels = text(locale);
  if (rows.length === 0) return labels.lastEmpty;
  const body = rows.map((row) => `${statusIcon(row.status)} <b>${escapeHtml(row.home)} — ${escapeHtml(row.away)}</b>\n${row.line}`).join("\n\n");
  return clamp(`<b>${labels.last}</b>\n\n${body}`);
}

export function settingsMessage(input: {
  locale: Locale;
  quiet: { start: string; end: string } | null;
  leagues: string[] | null;
  options: { key: string; title: string }[];
}): string {
  const labels = text(input.locale);
  const quiet = input.quiet ? `${input.quiet.start}–${input.quiet.end}` : labels.quietOff;
  const leagueLine =
    input.leagues == null
      ? labels.allLeagues
      : input.options
          .filter((option) => input.leagues?.includes(option.key))
          .map((option) => option.title)
          .join(", ") || labels.noLeagues;
  return [`<b>${labels.settings}</b>`, `${labels.language}: ${input.locale === "ru" ? "Русский" : "English"}`, `${labels.quiet}: ${escapeHtml(quiet)}`, `${labels.leagues}: ${escapeHtml(leagueLine)}`].join("\n");
}

export function unavailableMessage(locale: Locale): string {
  return text(locale).unavailable;
}

export function pickLine(input: PickCopy): string {
  return `${escapeHtml(selectionLabel(input))} · ${formatPrice(input.locale, input.price)}`;
}

export function kickoffLabel(iso: string, locale: Locale): string {
  const timeZone = locale === "ru" ? "Europe/Moscow" : "UTC";
  const parts = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    timeZone,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = value("hour") === "24" ? "00" : value("hour");
  return `${value("day")} ${value("month")}, ${hour}:${value("minute")} ${locale === "ru" ? "МСК" : "UTC"}`;
}

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function selectionLabel(input: PickCopy): string {
  const point = input.point == null ? "" : ` ${formatPoint(input.point)}`;
  if (input.selection === "over") return `${input.locale === "ru" ? "ТБ" : "Over"}${point}`;
  if (input.selection === "under") return `${input.locale === "ru" ? "ТМ" : "Under"}${point}`;
  if (input.selection === "draw") return input.locale === "ru" ? "Ничья" : "Draw";
  if (input.selection === "home") return `${input.locale === "ru" ? "П1" : "1"} ${input.home}`;
  if (input.selection === "away") return `${input.locale === "ru" ? "П2" : "2"} ${input.away}`;
  return input.selection;
}

function seriesLine(locale: Locale, input: { roi: number | null; hitRate: number | null; decided: number }): string {
  const labels = text(locale);
  return `${labels.series}: ROI ${formatPercent(locale, input.roi, true)} · ${labels.hitRate} ${formatPercent(locale, input.hitRate, false)} · ${input.decided}`;
}

function eventLink(locale: Locale, eventId: string, origin = siteOrigin()) {
  const href = `${origin}/${locale}/events/${encodeURIComponent(eventId)}`;
  return `<a href="${escapeHtml(href)}">${text(locale).event}</a>`;
}

function statusIcon(status: "won" | "lost" | "void") {
  if (status === "won") return "✅";
  if (status === "lost") return "❌";
  return "↩️";
}

function statusLabel(locale: Locale, status: "won" | "lost" | "void") {
  const labels = text(locale);
  if (status === "won") return labels.won;
  if (status === "lost") return labels.lost;
  return labels.voided;
}

function confidenceLabel(locale: Locale, confidence: string) {
  const labels = text(locale).levels;
  if (confidence === "high" || confidence === "medium" || confidence === "low") return labels[confidence];
  return confidence;
}

function formatPrice(locale: Locale, price: number) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function formatPoint(point: number) {
  return Number.isInteger(point) ? String(point) : String(point);
}

function formatPercent(locale: Locale, value: number | null, signed: boolean) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: signed ? "exceptZero" : "never",
  }).format(value);
}

function shorten(value: string, limit: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  const base = space > limit * 0.6 ? cut.slice(0, space) : cut;
  return `${base}…`;
}

function clamp(value: string) {
  if (value.length <= MESSAGE_LIMIT) return value;
  return `${value.slice(0, MESSAGE_LIMIT - 1)}…`;
}

function text(locale: Locale) {
  if (locale === "ru") {
    return {
      forecast: "Прогноз",
      confidence: "Уверенность",
      event: "Матч на сайте",
      score: "Счёт",
      series: "Серия",
      hitRate: "проходимость",
      won: "Зашёл",
      lost: "Не зашёл",
      voided: "Возврат",
      daily: "Итог дня",
      weekly: "Итог недели",
      published: "Опубликовано",
      settled: "Рассчитано",
      site: "Открыть BetInsight",
      start:
        "BetInsight присылает прогноз до начала матча и результат после финального свистка.\n\n18+. Материалы носят информационный характер и не являются призывом делать ставки.\n\n/today — на сегодня\n/stats — серия\n/last — последние результаты\n/settings — лиги, язык и тихие часы\n/stop — отписка",
      stopped: "Рассылка остановлена. /start снова включит сообщения.",
      needStart: "Нажмите /start, чтобы получать прогнозы.",
      denied: "Эта команда только для администратора.",
      today: "На сегодня",
      todayEmpty: "На сегодня опубликованных прогнозов нет.",
      stats: "Статистика серии",
      pending: "ждут",
      last: "Последние результаты",
      lastEmpty: "В этой серии ещё нет рассчитанных прогнозов.",
      settings: "Настройки",
      language: "Язык",
      quiet: "Тихие часы",
      quietOff: "выключены",
      leagues: "Лиги",
      allLeagues: "все",
      noLeagues: "ни одной",
      unavailable: "Сводка сейчас недоступна. Попробуйте чуть позже.",
      levels: { high: "высокая", medium: "средняя", low: "низкая" },
    };
  }
  return {
    forecast: "Forecast",
    confidence: "Confidence",
    event: "Match page",
    score: "Score",
    series: "Series",
    hitRate: "hit rate",
    won: "Won",
    lost: "Lost",
    voided: "Void",
    daily: "Daily summary",
    weekly: "Weekly summary",
    published: "Published",
    settled: "Settled",
    site: "Open BetInsight",
    start:
      "BetInsight sends the forecast before kickoff and the result after the final whistle.\n\n18+. The material is informational and is not a call to place a bet.\n\n/today — today's picks\n/stats — the series\n/last — recent results\n/settings — leagues, language and quiet hours\n/stop — unsubscribe",
    stopped: "Messages are paused. /start turns them back on.",
    needStart: "Send /start to receive forecasts.",
    denied: "This command is only for an administrator.",
    today: "Today",
    todayEmpty: "There are no published forecasts for today.",
    stats: "Series stats",
    pending: "pending",
    last: "Recent results",
    lastEmpty: "This series has no settled forecasts yet.",
    settings: "Settings",
    language: "Language",
    quiet: "Quiet hours",
    quietOff: "off",
    leagues: "Leagues",
    allLeagues: "all",
    noLeagues: "none",
    unavailable: "The summary is unavailable right now. Try again in a moment.",
    levels: { high: "high", medium: "medium", low: "low" },
  };
}
