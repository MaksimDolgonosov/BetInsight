import { Panel, Stat } from "@/components/admin/panel";
import { loadTracks } from "@/server/admin/queries";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminTracksPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.tracks");
  const markets = await getTranslations("admin.markets");
  const selections = await getTranslations("admin.selections");
  const confidence = await getTranslations("admin.confidence");
  const sources = await getTranslations("admin.sources");
  const format = await getFormatter();
  const data = await loadTracks();
  const candidates = data.evaluations.filter((row) => row.isCandidate);
  const nearMisses = data.evaluations.filter((row) => row.nearMiss);
  const meanEv = nearMisses.length === 0 ? null : nearMisses.reduce((sum, row) => sum + row.ev, 0) / nearMisses.length;
  const decided = data.consensus.filter((row) => row.matchesMarketFavorite != null);
  const favoriteShare = decided.length === 0 ? null : decided.filter((row) => row.matchesMarketFavorite).length / decided.length;
  const votesById = new Map(data.votes.map((vote) => [vote.id, vote]));
  const paused = data.aiPickSpend >= data.settings.aiPick.monthlyBudgetUsd;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("description")}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label={t("track")} value={data.settings.aiPick.enabled ? t("enabled") : t("disabled")} />
        <Stat
          label={t("spend")}
          value={format.number(data.aiPickSpend, { style: "currency", currency: "USD" })}
          hint={t("budget", { value: format.number(data.settings.aiPick.monthlyBudgetUsd, { style: "currency", currency: "USD" }) })}
        />
        <Stat label={t("candidateCount")} value={format.number(candidates.length)} />
        <Stat label={t("nearMissCount")} value={format.number(nearMisses.length)} hint={meanEv == null ? t("noNearMiss") : t("meanEv", { value: format.number(meanEv, { style: "percent", maximumFractionDigits: 1 }) })} />
        <Stat label={t("favoriteShare")} value={favoriteShare == null ? "—" : format.number(favoriteShare, { style: "percent", maximumFractionDigits: 0 })} />
      </div>
      {paused && data.settings.aiPick.enabled ? <p className="text-sm text-destructive">{t("paused")}</p> : null}
      {decided.length >= 5 && favoriteShare != null && favoriteShare > 0.9 ? (
        <p className="text-sm text-destructive">{t("favoriteWarning")}</p>
      ) : null}
      <Panel title={t("modelsTitle")} description={data.settings.aiPick.models.join(" · ")}>
        <p className="text-sm text-muted-foreground">
          {t("research")}: {data.settings.aiPick.researchModel || t("researchFallback")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.settings.aiPick.consensusMode === "unanimous" ? t("unanimous") : t("twoThirds")}
          {" · "}
          {t("dailyLimit", { count: data.settings.aiPick.dailyLimit })}
        </p>
      </Panel>
      <Panel title={t("candidateTitle")} description={t("candidateDescription")}>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyCandidates")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 font-medium">{t("event")}</th>
                  <th className="px-2 py-2 font-medium">{t("pick")}</th>
                  <th className="px-2 py-2 font-medium">EV</th>
                  <th className="px-2 py-2 font-medium">{t("price")}</th>
                  <th className="px-2 py-2 font-medium">{t("source")}</th>
                </tr>
              </thead>
              <tbody>
                {candidates.slice(0, 50).map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-2 py-3">{row.home} — {row.away}</td>
                    <td className="px-2 py-3">
                      {label(markets, row.market)} · {label(selections, row.outcome)}
                      {row.point != null ? ` ${row.point}` : ""}
                    </td>
                    <td className="px-2 py-3">{format.number(row.ev, { style: "percent", maximumFractionDigits: 1 })}</td>
                    <td className="px-2 py-3">{format.number(row.bestPrice, { maximumFractionDigits: 2 })} · {row.bestBookmaker}</td>
                    <td className="px-2 py-3">{sources(row.source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title={t("savedTitle")} description={t("savedDescription")}>
        {data.predictions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptySaved")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 font-medium">{t("event")}</th>
                  <th className="px-2 py-2 font-medium">{t("pick")}</th>
                  <th className="px-2 py-2 font-medium">{t("price")}</th>
                  <th className="px-2 py-2 font-medium">{t("source")}</th>
                </tr>
              </thead>
              <tbody>
                {data.predictions.map((row) => {
                  const reasoning = locale === "ru" ? row.reasoningRu : row.reasoningEn;
                  return (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-2 py-3">
                      {row.home} — {row.away}
                      {reasoning ? <span className="mt-1 block text-muted-foreground">{reasoning}</span> : null}
                    </td>
                    <td className="px-2 py-3">
                      {label(markets, row.market)} · {label(selections, row.selection)}
                      {row.point != null ? ` ${row.point}` : ""}
                    </td>
                    <td className="px-2 py-3">{format.number(row.price, { maximumFractionDigits: 2 })} · {row.bookmaker}</td>
                    <td className="px-2 py-3">
                      {row.confidence ? confidence(row.confidence as "low" | "medium" | "high") : t("aiPickTrack")}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title={t("nearMissTitle")} description={t("nearMissDescription")}>
        {nearMisses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyNearMiss")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 font-medium">{t("event")}</th>
                  <th className="px-2 py-2 font-medium">{t("pick")}</th>
                  <th className="px-2 py-2 font-medium">EV</th>
                  <th className="px-2 py-2 font-medium">{t("price")}</th>
                  <th className="px-2 py-2 font-medium">{t("source")}</th>
                </tr>
              </thead>
              <tbody>
                {nearMisses.slice(0, 50).map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-2 py-3">{row.home} — {row.away}</td>
                    <td className="px-2 py-3">
                      {label(markets, row.market)} · {label(selections, row.outcome)}
                      {row.point != null ? ` ${row.point}` : ""}
                    </td>
                    <td className="px-2 py-3">{format.number(row.ev, { style: "percent", maximumFractionDigits: 1 })}</td>
                    <td className="px-2 py-3">{format.number(row.bestPrice, { maximumFractionDigits: 2 })} · {row.bestBookmaker}</td>
                    <td className="px-2 py-3">{sources(row.source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title={t("votesTitle")} description={t("votesDescription")}>
        {data.consensus.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyVotes")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {data.consensus.map((row) => {
              const reasoning = locale === "ru" ? row.reasoningRu : row.reasoningEn;
              return (
                <article key={row.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">{row.home} — {row.away}</h3>
                    <span className="text-xs text-muted-foreground">
                      {row.status === "consensus" ? t("consensus") : t("noConsensus")} · {sources(row.source)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("votesCount", { votesFor: row.votesFor, votesTotal: row.votesTotal })}
                    {row.pAiMean != null ? ` · ${format.number(row.pAiMean, { style: "percent", maximumFractionDigits: 1 })}` : ""}
                    {row.selection ? ` · ${label(markets, row.market)} ${label(selections, row.selection)}` : ""}
                    {row.confidence ? ` · ${confidence(row.confidence as "low" | "medium" | "high")}` : ""}
                  </p>
                  {reasoning ? <p className="mt-2 text-sm">{reasoning}</p> : null}
                  <ul className="mt-3 flex flex-col gap-2 text-sm">
                    {row.voteIds.map((id) => {
                      const vote = votesById.get(id);
                      if (!vote) return null;
                      const text = locale === "ru" ? vote.reasoningRu : vote.reasoningEn;
                      return (
                        <li key={id} className="rounded-md bg-muted/40 px-3 py-2">
                          <span className="font-medium">{vote.model}</span>
                          {" · "}
                          {label(selections, vote.selection)}
                          {vote.point != null ? ` ${vote.point}` : ""}
                          {" · "}
                          {confidence(vote.confidence as "low" | "medium" | "high")}
                          {text ? <span className="mt-1 block text-muted-foreground">{text}</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function label(messages: { (key: string): string; has: (key: string) => boolean }, key: string | null) {
  if (!key) return "—";
  return messages.has(key) ? messages(key) : key;
}
