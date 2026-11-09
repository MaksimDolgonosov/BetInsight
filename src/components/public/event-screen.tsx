import { CopyHash } from "@/components/public/copy-hash";
import { KickoffClock } from "@/components/public/kickoff-clock";
import { sportMark, teamMark } from "@/components/public/marks";
import { ReasoningTabs } from "@/components/public/reasoning-tabs";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { Link } from "@/i18n/navigation";
import type { MarketQuote, PublicEvent } from "@/server/stats/load";
import { ChevronRight, Sparkles } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

export async function EventScreen({ locale, event }: { locale: string; event: PublicEvent }) {
  const t = await getTranslations("public.event");
  const home = await getTranslations("public.home");
  const markets = await getTranslations("public.markets");
  const selections = await getTranslations("public.selections");
  const confidence = await getTranslations("public.confidence");
  const status = await getTranslations("public.status");
  const format = await getFormatter();
  const pick = event.pick;
  const implied = pick.price > 1 ? 1 / pick.price : null;
  const consensus = event.focus?.consensusProb ?? pick.modelProb;
  const profit = pick.price - 1;
  const started = pick.commenceTime ? new Date(pick.commenceTime).getTime() <= Date.now() : false;
  const score = pick.homeScore != null && pick.awayScore != null ? `${pick.homeScore}:${pick.awayScore}` : null;

  return (
    <div className="bi-stats min-h-screen">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col">
        <SiteHeader locale={locale} active="forecasts" path={`/events/${pick.eventId}`} />
        <main className="flex flex-col gap-8 px-4 py-8 lg:px-16 lg:pt-8 lg:pb-16">
          <nav className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--bi-text-3)]">
            <Link href="/forecasts" className="text-[var(--bi-text-2)]">{t("crumbForecasts")}</Link>
            <ChevronRight className="size-3.5" />
            <span>{pick.league}</span>
            <ChevronRight className="size-3.5" />
            <span className="text-[var(--bi-text)]">{pick.home} — {pick.away}</span>
          </nav>

          <section className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
            <Team name={pick.home} role={t("home")} mark={teamMark(pick.home)} align="end" tone="home" />
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-[12px] text-[var(--bi-text-3)]">{sportMark(pick.sportKey)} {pick.league}</p>
              {started && score ? (
                <p className="font-stat text-[40px] font-semibold tracking-[-1px] lg:text-[56px]">{score}</p>
              ) : pick.commenceTime ? (
                <KickoffClock at={pick.commenceTime} started={home("started")} dayUnit={t("dayUnit")} hourUnit={t("hourUnit")} />
              ) : null}
              <p className="text-[13px] text-[var(--bi-text-2)]">
                {started ? status(pick.status) : pick.commenceTime ? t("until", { when: when(pick.commenceTime, format, home) }) : "—"}
              </p>
            </div>
            <Team name={pick.away} role={t("away")} mark={teamMark(pick.away)} align="start" tone="away" />
          </section>

          <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <article className="flex flex-col gap-6 rounded-[24px] border border-[var(--bi-border)] bg-[var(--bi-surface)] p-6 lg:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c8ff2e1a] px-2.5 py-1 text-[12px] font-semibold text-[var(--bi-accent)]">
                  <Sparkles className="size-3.5" />
                  {t("aiPick")}
                </span>
                <span className="text-[12px] text-[var(--bi-text-3)]">{t("locked", { when: when(pick.publishedAt, format, home) })}</span>
              </div>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-2">
                  <h1 className="font-display text-[32px] leading-none font-semibold tracking-[-1px] lg:text-[40px]">{pickTitle(pick, t)}</h1>
                  <p className="text-[14px] text-[var(--bi-text-2)]">
                    {t("stake", { market: label(markets, pick.market), profit: signedNumber(format, profit, 2) })}
                  </p>
                </div>
                <div className="flex w-fit flex-col gap-1 rounded-[16px] bg-[var(--bi-accent)] px-5 py-3 text-[var(--bi-ink)]">
                  <span className="font-stat text-[40px] leading-none font-semibold">{format.number(pick.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-[12px]">{t("bestPrice", { bookmaker: pick.bookmaker })}</span>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label={t("consensus")} value={percent(format, consensus)} />
                <Stat label={t("aiProbability")} value={percent(format, pick.aiProb)} />
                <Stat label={t("ev")} value={signedPercent(format, pick.ev ?? null)} accent />
                <Stat label={t("confidence")} value={pick.confidence ? label(confidence, pick.confidence) : "—"} />
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-[14px] font-medium">{t("probability", { pick: pickTitle(pick, t) })}</p>
                <Bar label={t("inPrice", { price: format.number(pick.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })} value={implied} format={format} />
                <Bar label={t("noMargin")} value={consensus} format={format} />
                <Bar label={t("aiEstimate")} value={pick.aiProb} format={format} />
              </div>
              <div className="flex flex-col gap-3 border-t border-[var(--bi-border)] pt-5">
                <h2 className="text-[14px] font-semibold">{t("reasoning")}</h2>
                <ReasoningTabs locale={locale} ru={pick.reasoningRu} en={pick.reasoningEn} empty={t("reasoningEmpty")} />
                <div className="flex flex-wrap gap-2">
                  {pick.llmModel ? <Meta>{pick.llmModel}</Meta> : null}
                  {pick.promptVersion ? <Meta>{t("prompt", { version: pick.promptVersion })}</Meta> : null}
                  <Meta>{t("published", { when: when(pick.publishedAt, format, home) })}</Meta>
                  {pick.status !== "pending" ? <Meta>{t("result", { status: status(pick.status), profit: signedNumber(format, pick.profitUnits ?? 0, 2) })}</Meta> : null}
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-[var(--bi-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[12px] text-[var(--bi-text-3)]">{t("hash")}</p>
                  <p className="truncate font-stat text-[12px] text-[var(--bi-text-2)]">{pick.hash}</p>
                </div>
                <CopyHash value={pick.hash} label={t("copy")} copied={t("copied")} />
              </div>
            </article>

            <aside className="flex flex-col gap-4">
              <article className="flex flex-col gap-4 rounded-[24px] border border-[var(--bi-border)] bg-[var(--bi-surface)] p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-[18px] font-semibold">{t("odds")}</h2>
                  <span className="rounded-full bg-[var(--bi-surface-2)] px-2.5 py-1 text-[12px] text-[var(--bi-text-2)]">{label(markets, pick.market)}</span>
                </div>
                {event.table.rows.length === 0 ? <p className="text-[13px] text-[var(--bi-text-3)]">{t("oddsEmpty")}</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[320px] text-left">
                      <thead>
                        <tr className="font-stat text-[11px] tracking-[0.04em] text-[var(--bi-text-3)] uppercase">
                          <th className="py-2 font-medium">{t("bookmaker")}</th>
                          {event.table.selections.map((selection) => (
                            <th key={selection} className="py-2 text-right font-medium">{label(selections, selection)}</th>
                          ))}
                          <th className="py-2 text-right font-medium">{t("margin")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {event.table.rows.map((row) => (
                          <tr key={row.bookmaker} className="border-t border-[var(--bi-border)]">
                            <td className="py-2.5 text-[14px]">{row.bookmaker}</td>
                            {event.table.selections.map((selection) => {
                              const price = row.prices[selection];
                              const best = price != null && price === pick.price && row.bookmaker === pick.bookmaker && selection === pick.selection;
                              return (
                                <td key={selection} className={`py-2.5 text-right font-stat text-[14px] ${best ? "font-semibold text-[var(--bi-accent)]" : ""}`}>
                                  {price == null ? "—" : format.number(price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              );
                            })}
                            <td className="py-2.5 text-right font-stat text-[14px] text-[var(--bi-text-2)]">{percent(format, row.margin)}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-[var(--bi-border)]">
                          <td className="py-2.5 text-[13px] text-[var(--bi-text-2)]">{t("consensusRow")}</td>
                          {event.table.selections.map((selection) => (
                            <td key={selection} className="py-2.5 text-right font-stat text-[14px]">{percent(format, quoteFor(event.line, selection)?.consensusProb ?? null)}</td>
                          ))}
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-[12px] text-[var(--bi-text-3)]">
                  {event.snapshotAt
                    ? t("snapshot", { when: when(event.snapshotAt, format, home), count: format.number(event.bookmakers), region: event.region })
                    : t("snapshotMissing")}
                </p>
              </article>

              {event.other ? (
                <article className="flex flex-col gap-3 rounded-[24px] border border-[var(--bi-border)] bg-[var(--bi-surface)] p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[14px] font-semibold">{event.other.market === "h2h" ? t("otherH2h") : t("otherTotal", { point: event.other.point ?? "" })}</h2>
                    <span className="rounded-full bg-[var(--bi-surface-2)] px-2 py-1 font-stat text-[12px] text-[var(--bi-text-2)]">{t("aiSkip")}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {event.other.quotes.map((quote) => (
                      <span key={`${quote.selection}-${quote.point ?? ""}`} className="rounded-full bg-[var(--bi-bg)] px-2.5 py-1 font-stat text-[12px]">
                        {quote.market === "totals" ? home(quote.selection === "over" ? "codeOver" : "codeUnder", { point: quote.point ?? "" }) : home(quote.selection === "home" ? "codeHome" : quote.selection === "away" ? "codeAway" : "codeDraw")} {percent(format, quote.consensusProb)}
                      </span>
                    ))}
                  </div>
                  <p className="text-[13px] leading-5 text-[var(--bi-text-3)]">{event.other.skipped ? t("otherBelow") : t("otherShortlisted")}</p>
                </article>
              ) : null}
            </aside>
          </section>
        </main>
        <SiteFooter locale={locale} />
      </div>
    </div>
  );
}

function Team({ name, role, mark, align, tone }: { name: string; role: string; mark: string; align: "start" | "end"; tone: "home" | "away" }) {
  return (
    <div className={`flex items-center gap-4 ${align === "end" ? "lg:flex-row-reverse lg:text-right" : ""}`}>
      <span className={`flex size-14 shrink-0 items-center justify-center rounded-full font-display text-[16px] font-semibold text-white ${tone === "home" ? "bg-[#ff5d5d]" : "bg-[#3d7eff]"}`}>{mark}</span>
      <span className="flex flex-col gap-1">
        <span className="font-display text-[32px] leading-none font-semibold tracking-[-1px] lg:text-[44px]">{name}</span>
        <span className="text-[13px] text-[var(--bi-text-3)]">{role}</span>
      </span>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-[var(--bi-text-3)]">{label}</span>
      <span className={`font-display text-[24px] leading-none font-semibold ${accent ? "text-[var(--bi-win)]" : ""}`}>{value}</span>
    </div>
  );
}

function Bar({ label, value, format }: { label: string; value: number | null; format: Awaited<ReturnType<typeof getFormatter>> }) {
  const width = value == null ? 0 : Math.max(0, Math.min(100, value * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="text-[var(--bi-text-2)]">{label}</span>
        <span className="font-stat">{percent(format, value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
        <div className="h-full rounded-full bg-[var(--bi-accent)]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Meta({ children }: { children: string }) {
  return <span className="rounded-full bg-[var(--bi-bg)] px-2.5 py-1 font-stat text-[12px] text-[var(--bi-text-2)]">{children}</span>;
}

function quoteFor(quotes: MarketQuote[], selection: string) {
  return quotes.find((quote) => quote.selection === selection) ?? null;
}

function pickTitle(pick: PublicEvent["pick"], t: Awaited<ReturnType<typeof getTranslations>>) {
  if (pick.market === "totals") return t(pick.selection === "over" ? "totalOver" : "totalUnder", { point: pick.point ?? "" });
  if (pick.selection === "home") return t("homeWin", { team: pick.home });
  if (pick.selection === "away") return t("awayWin", { team: pick.away });
  return t("draw");
}

function when(iso: string, format: Awaited<ReturnType<typeof getFormatter>>, t: Awaited<ReturnType<typeof getTranslations>>) {
  const date = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day = date.toDateString() === now.toDateString() ? t("today") : date.toDateString() === tomorrow.toDateString() ? t("tomorrow") : format.dateTime(date, { day: "numeric", month: "short" });
  return `${day}, ${format.dateTime(date, { hour: "2-digit", minute: "2-digit" })}`;
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
