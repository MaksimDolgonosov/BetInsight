import { Countdown } from "@/components/public/countdown";
import { isUpcomingKickoff } from "@/components/public/kickoff";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { Link } from "@/i18n/navigation";
import { summarize, type PublicPick } from "@/server/domain/stats/metrics";
import type { PublicBoard } from "@/server/stats/load";
import { ArrowRight, Check, Hash, Lock, Send, ShieldCheck, Sparkles, Undo2, X } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

export async function HomeScreen({ locale, board, range }: { locale: string; board: PublicBoard; range: "30" | "90" | "all" }) {
  const t = await getTranslations("public.home");
  const stats = await getTranslations("public.stats");
  const selections = await getTranslations("public.selections");
  const confidence = await getTranslations("public.confidence");
  const format = await getFormatter();
  const summary = summarize(board);
  const block = summary.aiPick.count > 0 ? summary.aiPick : summary.combined;
  const bank = sample(windowed(block.bank, range), 48);
  const upcoming = board.picks
    .filter((pick) => isUpcomingKickoff(pick))
    .sort((left, right) => (left.commenceTime ?? "").localeCompare(right.commenceTime ?? ""))
    .slice(0, 5);
  const settled = board.picks
    .filter((pick) => pick.status !== "pending")
    .sort((left, right) => (right.settledAt ?? right.publishedAt).localeCompare(left.settledAt ?? left.publishedAt));
  const recent = settled.slice(0, 5);
  const form = settled.slice(0, 16).reverse();
  const since = board.epochStartedAt ? format.dateTime(new Date(board.epochStartedAt), { day: "numeric", month: "long" }) : null;

  return (
    <div className="bi-stats min-h-screen">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col">
        <SiteHeader locale={locale} active="home" path={range === "all" ? "/" : `/?range=${range}`} />

        <section className="flex flex-col gap-10 px-4 pt-10 pb-12 lg:flex-row lg:items-stretch lg:gap-14 lg:px-16 lg:pt-14 lg:pb-12">
          <div className="flex w-full flex-col gap-8 lg:w-[470px] lg:shrink-0">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-[#c8ff2e10] px-3 py-1.5 text-[12px] font-medium text-[var(--bi-accent)]">
              <span className="size-[7px] rounded-full bg-[var(--bi-accent)]" />
              {since ? t("live", { date: since }) : t("liveQuiet")}
            </p>
            <div className="flex flex-col gap-1.5">
              <p className="text-[15px] text-[var(--bi-text-2)]">{since ? t("roiSince", { date: since }) : t("roiSeries")}</p>
              <p className={`font-display leading-none font-semibold tracking-[-4px] ${block.roi == null ? "text-[64px] text-[var(--bi-text)]" : block.roi < 0 ? "text-[88px] text-[var(--bi-loss)] lg:text-[132px]" : "text-[88px] text-[var(--bi-accent)] lg:text-[132px]"}`}>
                {signedPercent(format, block.roi)}
              </p>
              <p className="max-w-[470px] text-[15px] text-[var(--bi-text-2)]">
                {block.decided === 0
                  ? t("roiCaptionEmpty")
                  : t("roiCaption", { profit: signedNumber(format, block.profit, 1), count: format.number(block.count) })}
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-[var(--bi-border)]">
              <Mini label={stats("hitRate")} value={percent(format, block.hitRate)} hint={block.hitRateLow == null || block.hitRateHigh == null ? "—" : stats("ciShort", { low: points(format, block.hitRateLow), high: `${points(format, block.hitRateHigh)}%` })} />
              <Mini label={t("forecasts")} value={format.number(block.count)} hint={t("record", { won: block.won, lost: block.lost, void: block.void })} edge />
              <Mini label={t("avgPrice")} value={block.averagePrice == null ? "—" : format.number(block.averagePrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hint={block.roi == null ? "—" : t("yieldLine", { value: signedPercent(format, block.yield) })} top />
              <Mini label={t("drawdown")} value={block.decided === 0 ? "—" : t("drawdownUnits", { value: signedNumber(format, -block.maxDrawdown, 1) })} hint={block.longestLoss > 0 ? t("lossStreak", { count: block.longestLoss }) : t("noDrawdown")} edge top />
            </div>
          </div>

          <article className="flex min-w-0 flex-1 flex-col gap-6 rounded-[24px] border border-[var(--bi-border)] bg-[var(--bi-surface)] p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-[18px] font-semibold">{t("bankTitle")}</h2>
                <p className="text-[13px] text-[var(--bi-text-3)]">{t("bankHint")}</p>
              </div>
              <div className="flex items-center rounded-[10px] bg-[var(--bi-bg)] p-1 text-[12px] font-semibold">
                <RangeLink href={rangeHref("30")} active={range === "30"}>{t("range30")}</RangeLink>
                <RangeLink href={rangeHref("90")} active={range === "90"}>{t("range90")}</RangeLink>
                <RangeLink href={rangeHref("all")} active={range === "all"}>{t("rangeAll")}</RangeLink>
              </div>
            </div>
            <BankBars points={bank} />
            <div className="flex justify-between font-stat text-[11px] text-[var(--bi-text-3)] uppercase">
              {axisLabels(bank, board.epochStartedAt, t("today"), format).map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Baseline title={stats("aiAndModel")} value={signedPercent(format, block.roi)} color="text-[var(--bi-accent)]" />
              <Baseline title={stats("mathOnly")} value={signedPercent(format, summary.model.roi)} color="text-[var(--bi-ai)]" />
              <Baseline title={stats("alwaysFavorite")} value={signedPercent(format, summary.favorite.roi)} color="text-[var(--bi-loss)]" />
            </div>
          </article>
        </section>

        {!board.available ? <p className="px-4 text-sm text-[var(--bi-text-3)] lg:px-16">{t("unavailable")}</p> : null}

        <section className="px-4 lg:px-16">
          <div className="grid border-y border-[var(--bi-border)] sm:grid-cols-2 xl:grid-cols-4">
            <Trust icon={<Lock className="size-[17px]" />} title={t("trustBefore")} hint={t("trustBeforeHint")} />
            <Trust icon={<ShieldCheck className="size-[17px]" />} title={t("trustLocked")} hint={t("trustLockedHint")} />
            <Trust icon={<Hash className="size-[17px]" />} title={t("trustHash")} hint={t("trustHashHint")} />
            <Trust icon={<Send className="size-[17px]" />} title={t("trustChannel")} hint={t("trustChannelHint")} />
          </div>
        </section>

        <section className="flex flex-col gap-10 px-4 py-12 lg:flex-row lg:px-16 lg:pt-12 lg:pb-16">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-[26px] font-semibold">{t("upcoming")}</h2>
                <p className="text-[14px] text-[var(--bi-text-3)]">{t("upcomingHint")}</p>
              </div>
              <Link href="/forecasts" className="inline-flex items-center gap-1.5 text-[14px] font-medium">
                {t("allForecasts")}
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="overflow-hidden rounded-[20px] border border-[var(--bi-border)] bg-[var(--bi-surface)]">
              <div className="hidden items-center gap-4 px-6 py-3.5 font-stat text-[11px] tracking-[0.04em] text-[var(--bi-text-3)] uppercase lg:flex">
                <span className="w-[110px]">{t("colStart")}</span>
                <span className="min-w-0 flex-1">{t("colMatch")}</span>
                <span className="w-[160px]">{t("colPick")}</span>
                <span className="w-20">{t("colPrice")}</span>
                <span className="w-16">{t("colEv")}</span>
                <span className="w-[112px]">{t("colConfidence")}</span>
              </div>
              {upcoming.length === 0 ? <p className="px-6 py-5 text-[14px] text-[var(--bi-text-3)]">{t("emptyUpcoming")}</p> : upcoming.map((pick, index) => (
                <Link key={pick.id} href={`/events/${pick.eventId}`} className={`flex flex-col gap-3 px-6 py-[18px] lg:flex-row lg:items-center lg:gap-4 ${index === 0 ? "bg-[#c8ff2e08]" : ""}`}>
                  <div className="flex w-full flex-col gap-1 lg:w-[110px]">
                    {pick.commenceTime ? <Countdown at={pick.commenceTime} started={t("started")} /> : null}
                    <span className="text-[12px] text-[var(--bi-text-3)]">{pick.commenceTime ? when(pick.commenceTime, format, t) : "—"}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[12px] text-[var(--bi-text-3)]">{sportMark(pick.sportKey)} {pick.league}</span>
                    <span className="truncate text-[15px] font-semibold">{pick.home} — {pick.away}</span>
                  </div>
                  <div className="flex w-full items-center gap-2.5 lg:w-[160px]">
                    <span className="rounded-md bg-[var(--bi-surface-2)] px-2 py-1 font-stat text-[13px] font-semibold">{pickCode(pick, t)}</span>
                    <span className="truncate text-[13px] text-[var(--bi-text-2)]">{pickName(pick, selections)}</span>
                  </div>
                  <div className="flex w-20 flex-col gap-1">
                    <span className="text-[17px] font-semibold">{format.number(pick.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[11px] text-[var(--bi-text-3)]">{pick.bookmaker}</span>
                  </div>
                  <span className="w-16 text-[14px] font-semibold text-[var(--bi-win)]">{pick.ev == null ? "—" : signedPercent(format, pick.ev)}</span>
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-semibold ${confidenceClass(pick.confidence)}`}>
                    <Sparkles className="size-3.5" />
                    {pick.confidence ? label(confidence, pick.confidence) : "—"}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <aside className="flex w-full flex-col gap-5 lg:w-[340px] lg:shrink-0">
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-[26px] font-semibold">{t("recent")}</h2>
              <p className="text-[14px] text-[var(--bi-text-3)]">{t("recentHint")}</p>
            </div>
            {form.length > 0 ? (
              <div className="flex h-7 gap-1">
                {form.map((pick) => (
                  <span key={pick.id} className={`h-full min-w-0 flex-1 rounded-[4px] ${pick.status === "won" ? "bg-[var(--bi-win)]" : pick.status === "lost" ? "bg-[var(--bi-loss)]" : "bg-[var(--bi-text-3)]"}`} />
                ))}
              </div>
            ) : null}
            {recent.length === 0 ? <p className="text-[14px] text-[var(--bi-text-3)]">{t("emptyRecent")}</p> : recent.map((pick) => (
              <Link key={pick.id} href={`/events/${pick.eventId}`} className="flex items-center gap-3.5 py-3.5">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${pick.status === "won" ? "bg-[#3ddc971f] text-[var(--bi-win)]" : pick.status === "lost" ? "bg-[#ff5d5d1f] text-[var(--bi-loss)]" : "bg-[var(--bi-surface-2)] text-[var(--bi-text-2)]"}`}>
                  {pick.status === "won" ? <Check className="size-4" /> : pick.status === "lost" ? <X className="size-4" /> : <Undo2 className="size-4" />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[14px] font-medium">{pick.home} — {pick.away}</span>
                  <span className="text-[12px] text-[var(--bi-text-3)]">{t("resultLine", { code: pickCode(pick, t), price: format.number(pick.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), score: scoreOf(pick, t) })}</span>
                </div>
                <span className={`font-stat text-[15px] font-semibold ${pick.status === "won" ? "text-[var(--bi-win)]" : pick.status === "lost" ? "text-[var(--bi-loss)]" : "text-[var(--bi-text-2)]"}`}>
                  {signedNumber(format, pick.profitUnits ?? 0, 2)}
                </span>
              </Link>
            ))}
          </aside>
        </section>

        <SiteFooter locale={locale} />
      </div>
    </div>
  );
}

function Mini({ label, value, hint, edge = false, top = false }: { label: string; value: string; hint: string; edge?: boolean; top?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 py-[18px] ${edge ? "border-l border-[var(--bi-border)] pl-5" : "pr-5"} ${top ? "border-t border-[var(--bi-border)]" : ""}`}>
      <span className="text-[13px] text-[var(--bi-text-3)]">{label}</span>
      <span className="font-display text-[30px] leading-none font-semibold tracking-[-1px]">{value}</span>
      <span className="text-[12px] text-[var(--bi-text-2)]">{hint}</span>
    </div>
  );
}

function Baseline({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] text-[var(--bi-text-2)]">{title}</span>
      <span className={`text-[15px] font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function RangeLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link href={href} className={`rounded-[7px] px-3 py-1.5 ${active ? "bg-[var(--bi-surface-2)] text-[var(--bi-text)]" : "text-[var(--bi-text-3)]"}`}>
      {children}
    </Link>
  );
}

function Trust({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-3.5 border-[var(--bi-border)] py-[22px] xl:border-l xl:pr-6 xl:pl-6 xl:first:border-l-0 xl:first:pl-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--bi-border)] bg-[var(--bi-surface)] text-[var(--bi-accent)]">{icon}</span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[14px] font-semibold">{title}</span>
        <span className="text-[12px] text-[var(--bi-text-3)]">{hint}</span>
      </span>
    </div>
  );
}

function BankBars({ points }: { points: { profit: number }[] }) {
  const peak = Math.max(1, ...points.map((point) => Math.abs(point.profit)));
  return (
    <div className="flex h-[250px] items-stretch gap-px">
      {(points.length > 0 ? points : [{ profit: 0 }]).map((point, index) => {
        const up = point.profit > 0 ? (point.profit / peak) * 100 : 0;
        const down = point.profit < 0 ? (Math.abs(point.profit) / peak) * 100 : 0;
        return (
          <div key={index} className="flex h-full min-w-0 flex-1 flex-col">
            <div className="flex h-[80%] items-end">
              <div className="w-full rounded-t-[3px] bg-[#c8ff2e59]" style={{ height: `${up}%` }} />
            </div>
            <div className="h-px bg-[var(--bi-border)]" />
            <div className="flex h-[20%] items-start">
              <div className="w-full rounded-b-[3px] bg-[#ff5d5d59]" style={{ height: `${down}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function rangeHref(range: "30" | "90" | "all") {
  return range === "all" ? "/" : `/?range=${range}`;
}

function windowed(points: { at: string; profit: number }[], range: "30" | "90" | "all") {
  if (range === "all") return points;
  const cutoff = Date.now() - Number(range) * 24 * 60 * 60 * 1000;
  return points.filter((point) => new Date(point.at).getTime() >= cutoff);
}

function sample<T>(items: T[], count: number) {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, index) => items[Math.round((index * (items.length - 1)) / (count - 1))] as T);
}

function axisLabels(points: { at: string }[], epoch: string | null, today: string, format: Awaited<ReturnType<typeof getFormatter>>) {
  const start = new Date(points[0]?.at ?? epoch ?? Date.now());
  const labels: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const end = new Date();
  while (cursor <= end && labels.length < 4) {
    labels.push(format.dateTime(cursor, { day: "2-digit", month: "short" }).replace(".", "").toUpperCase());
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  labels.push(today.toUpperCase());
  return labels;
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

function scoreOf(pick: PublicPick, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (pick.status === "void" || pick.homeScore == null || pick.awayScore == null) return t("postponed");
  return `${pick.homeScore}:${pick.awayScore}`;
}

function confidenceClass(value: string | null) {
  if (value === "high") return "bg-[#c8ff2e1a] text-[var(--bi-accent)]";
  if (value === "medium") return "bg-[#a394ff1a] text-[var(--bi-ai)]";
  return "bg-[var(--bi-surface-2)] text-[var(--bi-text-2)]";
}

function sportMark(sportKey: string) {
  if (sportKey.startsWith("soccer")) return "⚽";
  if (sportKey.startsWith("basketball")) return "🏀";
  if (sportKey.startsWith("tennis")) return "🎾";
  return "•";
}

function label(messages: Awaited<ReturnType<typeof getTranslations>>, key: string) {
  return messages.has(key) ? messages(key) : key;
}

function percent(format: Awaited<ReturnType<typeof getFormatter>>, value: number | null) {
  if (value == null) return "—";
  return format.number(value, { style: "percent", maximumFractionDigits: 1 });
}

function signedPercent(format: Awaited<ReturnType<typeof getFormatter>>, value: number | null) {
  if (value == null) return "—";
  return format.number(value, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
}

function signedNumber(format: Awaited<ReturnType<typeof getFormatter>>, value: number, digits: number) {
  return format.number(value, { maximumFractionDigits: digits, minimumFractionDigits: digits, signDisplay: "exceptZero" });
}

function points(format: Awaited<ReturnType<typeof getFormatter>>, value: number) {
  return format.number(value * 100, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}
