"use client";

import { ChevronDown } from "lucide-react";

export function ForecastFilters({
  locale,
  league,
  market,
  result,
  from,
  to,
  labels,
  leagues,
  markets,
  results,
}: {
  locale: string;
  league: string;
  market: string;
  result: string;
  from: string;
  to: string;
  labels: { league: string; market: string; result: string; from: string; to: string };
  leagues: [string, string][];
  markets: [string, string][];
  results: [string, string][];
}) {
  return (
    <form
      action={`/${locale}/forecasts`}
      className="flex flex-wrap items-center gap-2.5"
      onSubmit={(event) => {
        for (const field of event.currentTarget.querySelectorAll("select, input")) {
          if ((field instanceof HTMLSelectElement || field instanceof HTMLInputElement) && !field.value) field.disabled = true;
        }
      }}
    >
      <Select name="league" label={labels.league} value={league} options={leagues} />
      <Select name="market" label={labels.market} value={market} options={markets} />
      <Select name="result" label={labels.result} value={result} options={results} />
      <label className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--bi-border)] bg-[var(--bi-surface)] px-3 py-[9px] text-[13px]">
        <span className="text-[var(--bi-text-3)]">{labels.from}</span>
        <input type="date" name="from" defaultValue={from} onChange={(event) => event.currentTarget.form?.requestSubmit()} className="bg-transparent font-medium text-[var(--bi-text)] outline-none [color-scheme:dark]" />
      </label>
      <label className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--bi-border)] bg-[var(--bi-surface)] px-3 py-[9px] text-[13px]">
        <span className="text-[var(--bi-text-3)]">{labels.to}</span>
        <input type="date" name="to" defaultValue={to} onChange={(event) => event.currentTarget.form?.requestSubmit()} className="bg-transparent font-medium text-[var(--bi-text)] outline-none [color-scheme:dark]" />
      </label>
    </form>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--bi-border)] bg-[var(--bi-surface)] px-3 py-[9px] text-[13px]">
      <span className="text-[var(--bi-text-3)]">{label}</span>
      <select
        name={name}
        defaultValue={value}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="appearance-none bg-transparent font-medium text-[var(--bi-text)] outline-none"
      >
        {options.map(([option, text]) => (
          <option key={`${name}-${option}`} value={option}>
            {text}
          </option>
        ))}
      </select>
      <ChevronDown className="size-3.5 text-[var(--bi-text-3)]" />
    </label>
  );
}
