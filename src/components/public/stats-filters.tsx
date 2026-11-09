"use client";

import { ChevronDown, Download } from "lucide-react";

export function StatsFilters({
  locale,
  period,
  league,
  market,
  model,
  slice,
  csv,
  labels,
  periods,
  leagues,
  markets,
  models,
}: {
  locale: string;
  period: string;
  league: string;
  market: string;
  model: string;
  slice: string;
  csv: string;
  labels: { period: string; league: string; market: string; model: string; csv: string };
  periods: [string, string][];
  leagues: [string, string][];
  markets: [string, string][];
  models: [string, string][];
}) {
  return (
    <form
      action={`/${locale}/stats`}
      className="flex flex-wrap items-center justify-end gap-2.5"
      onSubmit={(event) => {
        for (const field of event.currentTarget.querySelectorAll("select, input")) {
          if ((field instanceof HTMLSelectElement || field instanceof HTMLInputElement) && !field.value) field.disabled = true;
        }
      }}
    >
      {slice ? <input type="hidden" name="slice" value={slice} /> : null}
      <Filter name="period" label={labels.period} value={period} options={periods} />
      <Filter name="league" label={labels.league} value={league} options={leagues} />
      <Filter name="market" label={labels.market} value={market} options={markets} />
      <Filter name="model" label={labels.model} value={model} options={models} />
      <a href={csv} className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--bi-text)] px-3.5 py-[9px] text-[13px] font-semibold text-[var(--bi-ink)]">
        <Download className="size-[15px]" />
        {labels.csv}
      </a>
    </form>
  );
}

function Filter({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
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
