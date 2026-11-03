"use client";

import { useMemo, useState } from "react";
import { JsonBlock } from "@/components/admin/json-block";
import { Button } from "@/components/ui/button";
import type { TestStreamEvent } from "@/server/admin/test-events";
import type { Market } from "@/server/domain/settings";
import { useLocale, useTranslations } from "next-intl";

type League = { key: string; title: string };

export function TestRunner({
  leagues,
  markets,
  region,
  mocked,
  remaining,
  reserve,
  lastRemaining,
  timeZone,
}: {
  leagues: League[];
  markets: Market[];
  region: string;
  mocked: boolean;
  remaining: number;
  reserve: number;
  lastRemaining: number | null;
  timeZone: string;
}) {
  const t = useTranslations("admin.test");
  const te = useTranslations("admin.errors");
  const marketLabels = useTranslations("admin.markets");
  const selections = useTranslations("admin.selections");
  const confidence = useTranslations("admin.confidence");
  const locale = useLocale();
  const [sportKey, setSportKey] = useState(leagues[0]?.key ?? "");
  const [selected, setSelected] = useState<Market[]>(markets);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [odds, setOdds] = useState<Extract<TestStreamEvent, { type: "odds" }> | null>(null);
  const [model, setModel] = useState<Extract<TestStreamEvent, { type: "model" }> | null>(null);
  const [predictions, setPredictions] = useState<Extract<TestStreamEvent, { type: "prediction" }>[]>([]);
  const [notes, setNotes] = useState<string[]>([]);

  const cost = mocked ? 0 : selected.length;
  const blocked = !mocked && remaining - cost < reserve;
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }),
    [locale, timeZone],
  );
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);
  const percentFormat = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }), [locale]);
  const usdFormat = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 4 }),
    [locale],
  );

  function toggleMarket(market: Market) {
    setSelected((current) => (current.includes(market) ? current.filter((item) => item !== market) : [...current, market]));
  }

  async function run() {
    setRunning(true);
    setError(null);
    setOdds(null);
    setModel(null);
    setPredictions([]);
    setNotes([]);

    try {
      const response = await fetch("/api/admin/test-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sportKey, markets: selected }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(errorText(te, body?.error));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as TestStreamEvent;
          if (event.type === "odds") setOdds(event);
          if (event.type === "model") setModel(event);
          if (event.type === "prediction") setPredictions((current) => [...current, event]);
          if (event.type === "note") setNotes((current) => [...current, t(event.code)]);
          if (event.type === "error") setError(errorText(te, event.code));
        }
      }
    } catch {
      setError(te("odds_failed"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border bg-card p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("league")}</span>
            <select
              value={sportKey}
              onChange={(event) => setSportKey(event.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
              disabled={leagues.length === 0 || running}
            >
              {leagues.map((league) => (
                <option key={league.key} value={league.key}>
                  {league.title}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("markets")}</span>
            <div className="flex h-9 items-center gap-4">
              {markets.map((market) => (
                <label key={market} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={selected.includes(market)}
                    disabled={running}
                    onChange={() => toggleMarket(market)}
                  />
                  {marketLabels(market)}
                </label>
              ))}
            </div>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label={t("region")} value={region} />
          <Info label={t("expectedCost")} value={t("credits", { count: cost })} />
          <Info label={t("ledgerRemaining")} value={t("credits", { count: remaining })} />
          <Info label={t("apiRemaining")} value={lastRemaining == null ? t("unknownRemaining") : t("credits", { count: lastRemaining })} />
        </dl>
        {mocked ? <p className="mt-3 text-sm text-muted-foreground">{t("mocked")}</p> : null}
        {blocked ? <p className="mt-3 text-sm text-destructive">{te("reserve")}</p> : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <Button className="mt-4" type="button" disabled={running || blocked || !sportKey || selected.length === 0} onClick={run}>
          {running ? t("running") : t("run")}
        </Button>
      </section>

      {odds ? (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6">
          <h2 className="text-base font-semibold">{t("oddsTitle")}</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Info label={t("httpStatus")} value={String(odds.httpStatus)} />
            <Info label={t("latency")} value={t("milliseconds", { count: odds.latencyMs })} />
            <Info label="x-requests-remaining" value={formatHeader(odds.remaining)} />
            <Info label="x-requests-used" value={formatHeader(odds.used)} />
            <Info label="x-requests-last" value={formatHeader(odds.lastCost)} />
          </dl>
          <JsonBlock value={odds.raw} summary={t("rawJson")} copyLabel={t("copy")} copiedLabel={t("copied")} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 font-medium">{t("event")}</th>
                  <th className="px-2 py-2 font-medium">{t("start")}</th>
                  <th className="px-2 py-2 font-medium">{t("bookmakers")}</th>
                  <th className="px-2 py-2 font-medium">{selections("home")}</th>
                  <th className="px-2 py-2 font-medium">{selections("draw")}</th>
                  <th className="px-2 py-2 font-medium">{selections("away")}</th>
                  <th className="px-2 py-2 font-medium">{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {odds.table.map((row) => (
                  <tr key={row.eventId} className="border-b last:border-b-0">
                    <td className="px-2 py-3">{row.home} — {row.away}</td>
                    <td className="px-2 py-3 whitespace-nowrap">{dateFormat.format(new Date(row.commenceTime))}</td>
                    <td className="px-2 py-3">{row.bookmakerCount}</td>
                    <td className="px-2 py-3">{formatPrice(numberFormat, row.bestHome)}</td>
                    <td className="px-2 py-3">{formatPrice(numberFormat, row.bestDraw)}</td>
                    <td className="px-2 py-3">{formatPrice(numberFormat, row.bestAway)}</td>
                    <td className="px-2 py-3">
                      {row.totalPoint == null
                        ? "—"
                        : `${row.totalPoint}: ${formatPrice(numberFormat, row.bestOver)} / ${formatPrice(numberFormat, row.bestUnder)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {model ? (
        <section className="rounded-xl border bg-card p-4 md:p-6">
          <h2 className="text-base font-semibold">{t("modelTitle")}</h2>
          {model.rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("noModelRows")}</p> : null}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 font-medium">{t("event")}</th>
                  <th className="px-2 py-2 font-medium">{t("pick")}</th>
                  <th className="px-2 py-2 font-medium">{t("consensus")}</th>
                  <th className="px-2 py-2 font-medium">{t("bestPrice")}</th>
                  <th className="px-2 py-2 font-medium">EV</th>
                  <th className="px-2 py-2 font-medium">{t("candidate")}</th>
                </tr>
              </thead>
              <tbody>
                {model.rows.map((row) => (
                  <tr key={`${row.eventId}-${row.market}-${row.selection}-${row.point ?? ""}`} className="border-b last:border-b-0">
                    <td className="px-2 py-3">{row.home} — {row.away}</td>
                    <td className="px-2 py-3">
                      {marketLabels(row.market)} · {selections(row.selection)}
                      {row.point != null ? ` ${row.point}` : ""}
                    </td>
                    <td className="px-2 py-3">{percentFormat.format(row.consensusProb)}</td>
                    <td className="px-2 py-3">
                      {numberFormat.format(row.bestPrice)} · {row.bestBookmaker}
                    </td>
                    <td className="px-2 py-3">{percentFormat.format(row.ev)}</td>
                    <td className="px-2 py-3">{row.candidate ? t("yes") : t("no")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {notes.map((note) => (
        <p key={note} className="text-sm text-muted-foreground">{note}</p>
      ))}

      {predictions.map((prediction) => {
        const reasoning = prediction.parsed?.reasoning[locale === "ru" ? "ru" : "en"];
        return (
          <section key={prediction.eventId} className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-6">
            <h2 className="text-base font-semibold">
              {t("aiTitle")}: {prediction.home} — {prediction.away}
            </h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Info label={t("model")} value={prediction.model} />
              <Info label={t("prompt")} value={prediction.promptVersion} />
              <Info label={t("tokens")} value={`${prediction.tokensIn ?? "—"} / ${prediction.tokensOut ?? "—"}`} />
              <Info label={t("cost")} value={prediction.costUsd == null ? "—" : usdFormat.format(prediction.costUsd)} />
              <Info label={t("latency")} value={t("milliseconds", { count: prediction.latencyMs })} />
            </dl>
            {prediction.validationError ? (
              <p className="text-sm text-destructive">
                {t("validationError")}: {prediction.validationError}
              </p>
            ) : null}
            {prediction.parsed ? (
              <div className="text-sm">
                <p>
                  {marketLabels(prediction.parsed.pick.market)} · {selections(prediction.parsed.pick.selection)}
                  {prediction.parsed.pick.point != null ? ` ${prediction.parsed.pick.point}` : ""}
                  {" · "}
                  {percentFormat.format(prediction.parsed.ai_probability)}
                  {" · "}
                  {confidence(prediction.parsed.confidence)}
                  {" · "}
                  {prediction.parsed.skip ? t("skipped") : t("publishedPick")}
                </p>
                {reasoning ? <p className="mt-2 text-muted-foreground">{reasoning}</p> : null}
              </div>
            ) : null}
            <JsonBlock value={prediction.raw} summary={t("rawModel")} copyLabel={t("copy")} copiedLabel={t("copied")} />
          </section>
        );
      })}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function errorText(te: { (key: string): string; has: (key: string) => boolean }, code: string | undefined) {
  if (code && te.has(code)) return te(code);
  return te("odds_failed");
}

function formatHeader(value: number | null) {
  return value == null ? "—" : String(value);
}

function formatPrice(format: Intl.NumberFormat, value: number | null) {
  return value == null ? "—" : format.format(value);
}
