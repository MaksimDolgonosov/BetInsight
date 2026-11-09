import { SiteHeader } from "@/components/public/site-header";
import { StatsFilters } from "@/components/public/stats-filters";
import { Link } from "@/i18n/navigation";
import { getAdminStore } from "@/server/admin/store";
import { filterChoices, calibrationBands, groupSlices, parseFilter, summarize, withPeriod, type MetricBlock, type PublicPick, type SliceDimension, type StatsFilter } from "@/server/domain/stats/metrics";
import { VOTE_PROMPT_VERSION, promptVersions } from "@/server/integrations/openrouter/prompt";
import { loadPublicBoard } from "@/server/stats/load";
import { Info } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

export async function Statistics({
  locale,
  query,
}: {
  locale: string;
  query: Record<string, string | string[] | undefined>;
}) {
  setRequestLocale(locale);
  const t = await getTranslations("public.stats");
  const markets = await getTranslations("public.markets");
  const confidence = await getTranslations("public.confidence");
  const format = await getFormatter();
  const board = await loadPublicBoard();
  const settings = await getAdminStore().getSettings();
  const filter = parseFilter(withPeriod(query));
  const summary = summarize({ picks: board.picks, baselines: board.baselines, votes: board.votes, filter });
  const options = filterChoices({
    leagues: settings.leagues,
    models: settings.aiPick.models,
    promptVersions: unique([VOTE_PROMPT_VERSION, settings.promptVersion, ...promptVersions()]),
    picks: board.picks,
  });
  const slice = sliceOf(one(query, "slice"));
  const period = periodOf(one(query, "period"));
  const rows = summary.aiPick.count > 0 ? summary.rows.filter((row) => row.track === "ai_pick") : summary.rows;
  const block = summary.aiPick.count > 0 ? summary.aiPick : summary.combined;
  const bands = calibrationBands(rows);
  const slices = groupSlices(rows, slice);
  const prices = rows.filter((row) => row.status === "won" || row.status === "lost").map((row) => row.price);
  const brierMarket = marketBrier(rows);
  const benefit = block.roi != null && summary.model.roi != null ? (block.roi - summary.model.roi) * 100 : null;
  const csv = `/${locale}/stats/csv${queryString({ filter, period, slice })}`;
  const kept = keptQuery({ filter, period, slice });

  return (
    <div className="bi-stats min-h-screen">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col">
        <SiteHeader locale={locale} active="stats" path={statsPath(kept)} />

        <main className="flex flex-col gap-8 px-4 py-8 lg:px-16 lg:pt-10 lg:pb-16">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <h1 className="font-display text-[40px] font-semibold tracking-[-1.8px] lg:text-[48px]">{t("title")}</h1>
              <p className="text-[15px] text-[var(--bi-text-3)]">
                {board.epochStartedAt ? t("subtitle", { date: format.dateTime(new Date(board.epochStartedAt), { day: "2-digit", month: "2-digit", year: "numeric" }) }) : t("subtitleAll")}
              </p>
            </div>
            <StatsFilters
              locale={locale}
              period={period}
              league={filter.league ?? ""}
              market={filter.market ?? ""}
              model={filter.model ?? ""}
              slice={slice === "league" ? "" : slice}
              csv={csv}
              labels={{ period: t("period"), league: t("league"), market: t("market"), model: t("model"), csv: t("csvShort") }}
              periods={[["", t("periodAll")], ["7", t("period7")], ["30", t("period30")], ["90", t("period90")]]}
              leagues={[["", t("all")], ...options.leagues.map((item) => [item.value, item.label] as [string, string])]}
              markets={[["", t("all")], ...options.markets.map((item) => [item, label(markets, item)] as [string, string])]}
              models={[["", t("all")], ...options.models.map((item) => [item, modelName(item)] as [string, string])]}
            />
          </div>

          {!board.available ? <p className="text-sm text-[var(--bi-text-3)]">{t("unavailable")}</p> : null}
          {block.smallSample ? <p className="text-sm text-[var(--bi-text-3)]">{t("sample")}</p> : null}

          <section className="grid overflow-hidden rounded-[24px] border border-[var(--bi-border)] bg-[var(--bi-surface)] sm:grid-cols-2 xl:grid-cols-6">
            <Kpi label={t("roiYield")} value={signedPercent(format, block.roi)} hint={block.decided === 0 ? "—" : t("units", { value: signedNumber(format, block.profit, 1) })} valueClass={block.roi == null ? "text-[var(--bi-text)]" : block.roi < 0 ? "text-[var(--bi-loss)]" : "text-[var(--bi-accent)]"} />
            <Kpi label={t("hitRate")} value={percent(format, block.hitRate)} hint={block.hitRateLow == null || block.hitRateHigh == null ? "—" : t("ciShort", { low: points(format, block.hitRateLow, 1), high: points(format, block.hitRateHigh, 1) })} />
            <Kpi label={t("wl")} value={`${block.won}/${block.lost}/${block.void}`} hint={t("forecastsCount", { count: format.number(block.count) })} />
            <Kpi label={t("avgPrice")} value={block.averagePrice == null ? "—" : format.number(block.averagePrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hint={prices.length === 0 ? "—" : t("priceRange", { min: format.number(Math.min(...prices), { minimumFractionDigits: 2, maximumFractionDigits: 2 }), max: format.number(Math.max(...prices), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })} />
            <Kpi label={t("brier")} value={block.brier == null ? "—" : format.number(block.brier, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} hint={brierMarket == null ? "—" : t("marketBrier", { value: format.number(brierMarket, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) })} />
            <Kpi label={t("clv")} value={signedPercent(format, block.clv)} hint={clvHint(t, block.clv)} valueClass={block.clv == null ? "text-[var(--bi-text)]" : block.clv >= 0 ? "text-[var(--bi-win)]" : "text-[var(--bi-loss)]"} />
          </section>

          <section className="flex gap-[3px] overflow-x-auto">
            <FunnelStage title={t("funnelEvents")} value={format.number(board.funnel.events)} hint={t("funnelEventsHint")} className="min-w-[220px] flex-1 rounded-l-[16px] bg-[var(--bi-surface)] text-[var(--bi-text)]" />
            <FunnelStage title={t("funnelCandidates")} value={format.number(board.funnel.candidates)} hint={t("funnelCandidatesHint")} className="w-[380px] shrink-0 bg-[var(--bi-surface-2)] text-[var(--bi-text)]" />
            <FunnelStage title={t("funnelFiltered")} value={format.number(board.funnel.filtered)} hint={t("funnelFilteredHint")} className="w-[290px] shrink-0 bg-[#a394ff26] text-[var(--bi-ai)]" />
            <FunnelStage title={t("funnelPublished")} value={format.number(block.count)} hint={t("funnelPublishedHint", { roi: signedPercent(format, block.roi) })} className="w-[300px] shrink-0 rounded-r-[16px] bg-[var(--bi-accent)] text-[var(--bi-ink)]" />
          </section>

          <section className="flex flex-col items-start gap-6 xl:flex-row">
            <article className="flex w-full flex-col gap-6 rounded-[24px] border border-[var(--bi-border)] bg-[var(--bi-surface)] p-7 xl:min-w-0 xl:flex-1">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="font-display text-[18px] font-semibold">{t("calibrationTitle")}</h2>
                  <p className="text-[13px] text-[var(--bi-text-3)]">{t("calibrationHint")}</p>
                </div>
                <div className="flex items-center gap-4 text-[12px] text-[var(--bi-text-2)]">
                  <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-[var(--bi-bar)]" />{t("expected")}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-[var(--bi-accent)]" />{t("actual")}</span>
                </div>
              </div>
              <div className="flex h-[230px] items-end gap-5">
                {bands.map((band) => (
                  <div key={band.from} className="flex h-full min-w-0 flex-1 items-end gap-1">
                    <div className="flex h-full min-w-0 flex-1 items-end">
                      <div className="w-full rounded-t-[4px] bg-[var(--bi-bar)]" style={{ height: barHeight(band.predicted) }} />
                    </div>
                    <div className="flex h-full min-w-0 flex-1 items-end">
                      <div className="w-full rounded-t-[4px] bg-[var(--bi-accent)]" style={{ height: barHeight(band.actual) }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-5">
                {bands.map((band) => (
                  <div key={band.from} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
                    <span className="font-stat text-[11px] text-[var(--bi-text-2)]">{points(format, band.from)}–{points(format, band.to)}%</span>
                    <span className="font-stat text-[11px] text-[var(--bi-text-3)]">n={format.number(band.count)}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="flex w-full flex-col gap-[22px] rounded-[24px] border border-[var(--bi-border)] bg-[var(--bi-surface)] p-7 xl:w-[440px] xl:shrink-0">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-[18px] font-semibold">{t("baselinesTitle")}</h2>
                <p className="text-[13px] text-[var(--bi-text-3)]">{t("baselinesHint")}</p>
              </div>
              <BaselineRow title={t("aiAndModel")} count={t("forecastsCount", { count: format.number(block.count) })} roi={block.roi} color="var(--bi-accent)" peak={peakRoi(block, summary.model, summary.favorite)} format={format} />
              <BaselineRow title={t("mathOnly")} count={t("candidatesCount", { count: format.number(summary.model.count) })} roi={summary.model.roi} color="var(--bi-ai)" peak={peakRoi(block, summary.model, summary.favorite)} format={format} />
              <BaselineRow title={t("alwaysFavorite")} count={t("eventsCount", { count: format.number(summary.favorite.count) })} roi={summary.favorite.roi} color="var(--bi-loss)" peak={peakRoi(block, summary.model, summary.favorite)} format={format} />
              <div className="flex items-start gap-2.5 rounded-[12px] bg-[var(--bi-bg)] p-3.5">
                <Info className="mt-0.5 size-[15px] shrink-0 text-[var(--bi-text-3)]" />
                <p className="text-[12px] text-[var(--bi-text-2)]">{t("aiBenefit", { value: benefit == null ? "—" : signedNumber(format, benefit, 1) })}</p>
              </div>
            </article>
          </section>

          <section className="overflow-hidden rounded-[24px] border border-[var(--bi-border)] bg-[var(--bi-surface)]">
            <div className="flex flex-col gap-4 px-7 py-[22px] sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-[18px] font-semibold">{t("slices")}</h2>
              <div className="flex w-fit items-center gap-0.5 rounded-[9px] border border-[var(--bi-border)] bg-[var(--bi-bg)] p-[3px] text-[12px] font-semibold">
                <SliceTab href={statsPath({ ...kept, slice: "" })} active={slice === "league"}>{t("league")}</SliceTab>
                <SliceTab href={statsPath({ ...kept, slice: "market" })} active={slice === "market"}>{t("market")}</SliceTab>
                <SliceTab href={statsPath({ ...kept, slice: "confidence" })} active={slice === "confidence"}>{t("confidence")}</SliceTab>
                <SliceTab href={statsPath({ ...kept, slice: "prompt" })} active={slice === "prompt"}>{t("colPrompt")}</SliceTab>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="flex items-center gap-4 bg-[var(--bi-bg)] px-7 py-2.5 font-stat text-[11px] font-medium tracking-[0.04em] text-[var(--bi-text-3)] uppercase">
                  <span className="min-w-0 flex-1">{sliceTitle(t, slice)}</span>
                  <span className="w-[90px]">{t("colCount")}</span>
                  <span className="w-[110px]">{t("colHit")}</span>
                  <span className="w-[110px]">{t("colPrice")}</span>
                  <span className="w-[100px]">{t("colRoi")}</span>
                  <span className="w-[360px]">{t("colScale")}</span>
                </div>
                {slices.length === 0 ? (
                  <p className="px-7 py-4 text-[14px] text-[var(--bi-text-3)]">{t("empty")}</p>
                ) : slices.map((item) => (
                  <div key={item.key} className="flex items-center gap-4 px-7 py-4">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                      {slice === "league" && item.sportKey ? `${sportMark(item.sportKey)} ` : ""}
                      {slice === "market" ? label(markets, item.label) : slice === "confidence" ? label(confidence, item.label) : item.label}
                    </span>
                    <span className="w-[90px] font-stat text-[14px] font-medium text-[var(--bi-text-2)]">{format.number(item.metrics.count)}</span>
                    <span className="w-[110px] font-stat text-[14px] font-medium text-[var(--bi-text-2)]">{percent(format, item.metrics.hitRate)}</span>
                    <span className="w-[110px] font-stat text-[14px] font-medium text-[var(--bi-text-2)]">{item.metrics.averagePrice == null ? "—" : format.number(item.metrics.averagePrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className={`w-[100px] font-stat text-[14px] font-semibold ${roiClass(item.metrics.roi)}`}>{signedPercent(format, item.metrics.roi)}</span>
                    <RoiScale roi={item.metrics.roi} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, valueClass = "text-[var(--bi-text)]" }: { label: string; value: string; hint: string; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-2 border-[var(--bi-border)] px-6 py-[22px] xl:border-l xl:first:border-l-0">
      <span className="text-[12px] text-[var(--bi-text-3)]">{label}</span>
      <span className={`font-display text-[30px] leading-none font-semibold tracking-[-1px] ${valueClass}`}>{value}</span>
      <span className="font-stat text-[12px] text-[var(--bi-text-2)]">{hint}</span>
    </div>
  );
}

function FunnelStage({ title, value, hint, className }: { title: string; value: string; hint: string; className: string }) {
  return (
    <div className={`flex h-24 flex-col justify-between px-5 py-4 ${className}`}>
      <span className="text-[13px] font-semibold">{title}</span>
      <div className="flex items-end justify-between gap-3">
        <span className="font-display text-[28px] leading-none font-semibold tracking-[-1px]">{value}</span>
        <span className="font-stat text-[12px]">{hint}</span>
      </div>
    </div>
  );
}

function BaselineRow({
  title,
  count,
  roi,
  color,
  peak,
  format,
}: {
  title: string;
  count: string;
  roi: number | null;
  color: string;
  peak: number;
  format: Awaited<ReturnType<typeof getFormatter>>;
}) {
  const width = roi == null ? 0 : `${Math.min(100, (Math.abs(roi) / peak) * 100)}%`;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-semibold">{title}</span>
          <span className="text-[12px] text-[var(--bi-text-3)]">{count}</span>
        </div>
        <span className="font-display text-[22px] font-semibold tracking-[-0.6px]" style={{ color }}>{signedPercent(format, roi)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-[5px] bg-[var(--bi-surface-2)]">
        <div className="h-full rounded-[5px]" style={{ width, background: color }} />
      </div>
    </div>
  );
}

function SliceTab({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link href={href} className={`rounded-[6px] px-3 py-[5px] ${active ? "bg-[var(--bi-surface-2)] text-[var(--bi-text)]" : "text-[var(--bi-text-3)]"}`}>
      {children}
    </Link>
  );
}

function RoiScale({ roi }: { roi: number | null }) {
  const share = roi == null ? 0 : Math.min(1, Math.abs(roi) / 0.2) * 50;
  const positive = (roi ?? 0) >= 0;
  return (
    <div className="flex h-4 w-[360px] items-stretch gap-0.5">
      <div className="relative h-2 self-center flex-1 overflow-hidden rounded-[4px] bg-[var(--bi-surface-2)]">
        {!positive && share > 0 ? <div className="absolute top-0 right-0 h-full rounded-[4px] bg-[var(--bi-loss)]" style={{ width: `${share * 2}%` }} /> : null}
      </div>
      <div className="w-0.5 self-stretch bg-[var(--bi-text-3)]" />
      <div className="relative h-2 self-center flex-1 overflow-hidden rounded-[4px] bg-[var(--bi-surface-2)]">
        {positive && share > 0 ? <div className="absolute top-0 left-0 h-full rounded-[4px] bg-[var(--bi-accent)]" style={{ width: `${share * 2}%` }} /> : null}
      </div>
    </div>
  );
}

function sliceTitle(t: Awaited<ReturnType<typeof getTranslations>>, slice: SliceDimension) {
  if (slice === "market") return t("colMarket");
  if (slice === "confidence") return t("colConfidence");
  if (slice === "prompt") return t("colPrompt");
  return t("colTournament");
}

function sportMark(sportKey: string) {
  if (sportKey.startsWith("soccer")) return "⚽";
  if (sportKey.startsWith("basketball")) return "🏀";
  if (sportKey.startsWith("tennis")) return "🎾";
  return "•";
}

function modelName(model: string) {
  return model.split("/").at(-1) ?? model;
}

function barHeight(value: number | null) {
  if (value == null || value <= 0) return "0%";
  return `${Math.min(100, (value / 0.75) * 100)}%`;
}

function peakRoi(...blocks: MetricBlock[]) {
  const values = blocks.flatMap((item) => (item.roi == null ? [] : [Math.abs(item.roi)]));
  return Math.max(0.01, ...values);
}

function roiClass(roi: number | null) {
  if (roi == null || roi === 0) return "text-[var(--bi-text-2)]";
  return roi > 0 ? "text-[var(--bi-win)]" : "text-[var(--bi-loss)]";
}

function clvHint(t: Awaited<ReturnType<typeof getTranslations>>, clv: number | null) {
  if (clv == null) return "—";
  if (clv > 0) return t("clvBetter");
  if (clv < 0) return t("clvWorse");
  return t("clvFlat");
}

function marketBrier(rows: PublicPick[]) {
  const decided = rows.filter((row) => (row.status === "won" || row.status === "lost") && row.price > 1);
  if (decided.length === 0) return null;
  const score = decided.reduce((sum, row) => sum + (Math.min(0.99, 1 / row.price) - (row.status === "won" ? 1 : 0)) ** 2, 0);
  return score / decided.length;
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

function points(format: Awaited<ReturnType<typeof getFormatter>>, value: number, digits = 0) {
  return format.number(value * 100, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function label(messages: Awaited<ReturnType<typeof getTranslations>>, key: string) {
  return messages.has(key) ? messages(key) : key;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

function sliceOf(value: string | undefined): SliceDimension {
  if (value === "market" || value === "confidence" || value === "prompt") return value;
  return "league";
}

function periodOf(value: string | undefined) {
  return value === "7" || value === "30" || value === "90" ? value : "";
}

function keptQuery({ filter, period, slice }: { filter: StatsFilter; period: string; slice: SliceDimension }) {
  const params: Record<string, string> = {};
  if (period) params.period = period;
  if (filter.league) params.league = filter.league;
  if (filter.market) params.market = filter.market;
  if (filter.model) params.model = filter.model;
  if (slice !== "league") params.slice = slice;
  return params;
}

function queryString(input: { filter: StatsFilter; period: string; slice: SliceDimension }) {
  const text = new URLSearchParams(keptQuery(input)).toString();
  return text ? `?${text}` : "";
}

function statsPath(query: Record<string, string>) {
  const text = new URLSearchParams(Object.entries(query).filter((entry) => entry[1])).toString();
  return text ? `/stats?${text}` : "/stats";
}
