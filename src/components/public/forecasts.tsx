import { Countdown } from "@/components/public/countdown";
import { isUpcomingKickoff } from "@/components/public/kickoff";
import { ForecastFilters } from "@/components/public/forecast-filters";
import { sportMark } from "@/components/public/marks";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { Link } from "@/i18n/navigation";
import { filterChoices } from "@/server/domain/stats/metrics";
import type { PublicPick } from "@/server/domain/stats/metrics";
import { loadPublicBoard } from "@/server/stats/load";
import { Check, Undo2, X } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

export async function Forecasts({
  locale,
  query,
}: {
  locale: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("public.forecasts");
  const home = await getTranslations("public.home");
  const markets = await getTranslations("public.markets");
  const selections = await getTranslations("public.selections");
  const confidence = await getTranslations("public.confidence");
  const status = await getTranslations("public.status");
  const format = await getFormatter();
  const board = await loadPublicBoard();
  const filter = parseForecastFilter(query);
  const options = filterChoices({ leagues: [], models: [], promptVersions: [], picks: board.picks });
  const rows = board.picks.filter((pick) => matches(pick, filter));
  const upcoming = rows
    .filter((pick) => isUpcomingKickoff(pick))
    .sort((left, right) => (left.commenceTime ?? "").localeCompare(right.commenceTime ?? ""));
  const archive = rows
    .filter((pick) => pick.status !== "pending")
    .filter((pick) => !filter.result || pick.status === filter.result)
    .sort((left, right) => (right.settledAt ?? right.publishedAt).localeCompare(left.settledAt ?? left.publishedAt));
  const path = forecastPath(filter);

  return (
    <div className="bi-stats min-h-screen">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col">
        <SiteHeader locale={locale} active="forecasts" path={path} />
        <main className="flex flex-col gap-10 px-4 py-8 lg:px-16 lg:pt-10 lg:pb-16">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <h1 className="font-display text-[40px] font-semibold tracking-[-1.8px] lg:text-[48px]">{t("title")}</h1>
              <p className="max-w-[640px] text-[15px] text-[var(--bi-text-3)]">{t("description")}</p>
            </div>
            <ForecastFilters
              locale={locale}
              league={filter.league}
              market={filter.market}
              result={filter.result}
              from={filter.from}
              to={filter.to}
              labels={{ league: t("league"), market: t("market"), result: t("result"), from: t("from"), to: t("to") }}
              leagues={[["", t("all")], ...options.leagues.map((item) => [item.value, item.label] as [string, string])]}
              markets={[["", t("all")], ...options.markets.map((item) => [item, label(markets, item)] as [string, string])]}
              results={[["", t("all")], ["won", status("won")], ["lost", status("lost")], ["void", status("void")]]}
            />
          </div>

          {!board.available ? <p className="text-sm text-[var(--bi-text-3)]">{home("unavailable")}</p> : null}

          {filter.result ? null : <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-[26px] font-semibold">{t("upcoming")}</h2>
              <p className="text-[14px] text-[var(--bi-text-3)]">{t("upcomingHint")}</p>
            </div>
            <div className="overflow-hidden rounded-[20px] border border-[var(--bi-border)] bg-[var(--bi-surface)]">
              <Header labels={[t("colStart"), t("colMatch"), t("colPick"), t("colPrice"), home("colConfidence")]} />
              {upcoming.length === 0 ? <p className="px-6 py-5 text-[14px] text-[var(--bi-text-3)]">{t("emptyUpcoming")}</p> : upcoming.map((pick) => (
                <Link key={pick.id} href={`/events/${pick.eventId}`} className="flex flex-col gap-3 border-t border-[var(--bi-border)] px-6 py-[18px] lg:flex-row lg:items-center lg:gap-4">
                  <div className="flex w-full flex-col gap-1 lg:w-[130px]">
                    {pick.commenceTime ? <Countdown at={pick.commenceTime} started={home("started")} /> : null}
                    <span className="text-[12px] text-[var(--bi-text-3)]">{pick.commenceTime ? when(pick.commenceTime, format, home) : "—"}</span>
                  </div>
                  <Match pick={pick} />
                  <Pick pick={pick} home={home} selections={selections} />
                  <Price pick={pick} format={format} />
                  <span className={`inline-flex w-fit rounded-full px-2 py-1 text-[12px] font-semibold ${confidenceClass(pick.confidence)}`}>
                    {pick.confidence ? label(confidence, pick.confidence) : "—"}
                  </span>
                </Link>
              ))}
            </div>
          </section>}

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-[26px] font-semibold">{t("archive")}</h2>
              <p className="text-[14px] text-[var(--bi-text-3)]">{t("archiveHint")}</p>
            </div>
            <div className="overflow-hidden rounded-[20px] border border-[var(--bi-border)] bg-[var(--bi-surface)]">
              <Header labels={[t("colStart"), t("colMatch"), t("colPick"), t("colResult"), t("colProfit")]} />
              {archive.length === 0 ? <p className="px-6 py-5 text-[14px] text-[var(--bi-text-3)]">{t("emptyArchive")}</p> : archive.map((pick) => (
                <Link key={pick.id} href={`/events/${pick.eventId}`} className="flex flex-col gap-3 border-t border-[var(--bi-border)] px-6 py-[18px] lg:flex-row lg:items-center lg:gap-4">
                  <span className="w-full text-[13px] text-[var(--bi-text-2)] lg:w-[130px]">{pick.commenceTime ? when(pick.commenceTime, format, home) : "—"}</span>
                  <Match pick={pick} />
                  <Pick pick={pick} home={home} selections={selections} />
                  <span className="inline-flex w-[140px] items-center gap-2 text-[14px] font-medium">
                    <ResultIcon status={pick.status} />
                    {status(pick.status)}
                  </span>
                  <span className={`w-[90px] font-stat text-[15px] font-semibold ${pick.status === "won" ? "text-[var(--bi-win)]" : pick.status === "lost" ? "text-[var(--bi-loss)]" : "text-[var(--bi-text-2)]"}`}>
                    {signedNumber(format, pick.profitUnits ?? 0, 2)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </main>
        <SiteFooter locale={locale} />
      </div>
    </div>
  );
}

function Header({ labels }: { labels: string[] }) {
  const widths = ["lg:w-[130px]", "lg:flex-1", "lg:w-[180px]", "lg:w-[140px]", "lg:w-[120px]"];
  return (
    <div className="hidden items-center gap-4 px-6 py-3.5 font-stat text-[11px] tracking-[0.04em] text-[var(--bi-text-3)] uppercase lg:flex">
      {labels.map((label, index) => (
        <span key={label} className={widths[index]}>{label}</span>
      ))}
    </div>
  );
}

function Match({ pick }: { pick: PublicPick }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[12px] text-[var(--bi-text-3)]">{sportMark(pick.sportKey)} {pick.league}</span>
      <span className="truncate text-[15px] font-semibold">{pick.home} — {pick.away}</span>
    </div>
  );
}

function Pick({
  pick,
  home,
  selections,
}: {
  pick: PublicPick;
  home: Awaited<ReturnType<typeof getTranslations>>;
  selections: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <div className="flex w-full items-center gap-2.5 lg:w-[180px]">
      <span className="rounded-md bg-[var(--bi-surface-2)] px-2 py-1 font-stat text-[13px] font-semibold">{pickCode(pick, home)}</span>
      <span className="truncate text-[13px] text-[var(--bi-text-2)]">{pickName(pick, selections)}</span>
    </div>
  );
}

function Price({ pick, format }: { pick: PublicPick; format: Awaited<ReturnType<typeof getFormatter>> }) {
  return (
    <div className="flex w-[140px] flex-col gap-1">
      <span className="text-[17px] font-semibold">{format.number(pick.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      <span className="text-[11px] text-[var(--bi-text-3)]">{pick.bookmaker}</span>
    </div>
  );
}

function ResultIcon({ status }: { status: PublicPick["status"] }) {
  const className = status === "won" ? "bg-[#3ddc971f] text-[var(--bi-win)]" : status === "lost" ? "bg-[#ff5d5d1f] text-[var(--bi-loss)]" : "bg-[var(--bi-surface-2)] text-[var(--bi-text-2)]";
  return (
    <span className={`flex size-7 items-center justify-center rounded-full ${className}`}>
      {status === "won" ? <Check className="size-3.5" /> : status === "lost" ? <X className="size-3.5" /> : <Undo2 className="size-3.5" />}
    </span>
  );
}

type ForecastFilter = { league: string; market: string; result: string; from: string; to: string };

function parseForecastFilter(query: Record<string, string | string[] | undefined>): ForecastFilter {
  const result = one(query, "result");
  return {
    league: one(query, "league") ?? "",
    market: one(query, "market") ?? "",
    result: result === "won" || result === "lost" || result === "void" ? result : "",
    from: date(one(query, "from")),
    to: date(one(query, "to")),
  };
}

function matches(pick: PublicPick, filter: ForecastFilter) {
  if (filter.league && pick.sportKey !== filter.league) return false;
  if (filter.market && pick.market !== filter.market) return false;
  const day = (pick.commenceTime ?? pick.publishedAt).slice(0, 10);
  if (filter.from && day < filter.from) return false;
  if (filter.to && day > filter.to) return false;
  return true;
}

function forecastPath(filter: ForecastFilter) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `/forecasts?${text}` : "/forecasts";
}

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  const text = Array.isArray(value) ? value[0] : value;
  return text?.trim() || undefined;
}

function date(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function when(iso: string, format: Awaited<ReturnType<typeof getFormatter>>, t: Awaited<ReturnType<typeof getTranslations>>) {
  const date = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day = date.toDateString() === now.toDateString() ? t("today") : date.toDateString() === tomorrow.toDateString() ? t("tomorrow") : format.dateTime(date, { day: "numeric", month: "short" });
  return `${day}, ${format.dateTime(date, { hour: "2-digit", minute: "2-digit" })}`;
}

function pickCode(pick: PublicPick, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (pick.market === "spreads") return t(pick.selection === "away" ? "codeSpreadAway" : "codeSpreadHome", { point: signedPoint(pick.point) });
  if (pick.market === "totals") return t(pick.selection === "over" ? "codeOver" : "codeUnder", { point: pick.point ?? "" });
  if (pick.selection === "home") return t("codeHome");
  if (pick.selection === "away") return t("codeAway");
  return t("codeDraw");
}

function pickName(pick: PublicPick, selections: Awaited<ReturnType<typeof getTranslations>>) {
  if (pick.selection === "home") return pick.home;
  if (pick.selection === "away") return pick.away;
  return label(selections, pick.selection);
}

function confidenceClass(value: string | null) {
  if (value === "high") return "bg-[#c8ff2e1a] text-[var(--bi-accent)]";
  if (value === "medium") return "bg-[#a394ff1a] text-[var(--bi-ai)]";
  return "bg-[var(--bi-surface-2)] text-[var(--bi-text-2)]";
}

function signedPoint(point: number | null) {
  if (point == null || !Number.isFinite(point)) return "";
  return point > 0 ? `+${point}` : String(point);
}

function label(messages: Awaited<ReturnType<typeof getTranslations>>, key: string) {
  return messages.has(key) ? messages(key) : key;
}

function signedNumber(format: Awaited<ReturnType<typeof getFormatter>>, value: number, digits: number) {
  return format.number(value, { maximumFractionDigits: digits, minimumFractionDigits: digits, signDisplay: "exceptZero" });
}
