import type { CreditBar } from "@/server/budget/budget";

export function CreditSpendCard({
  title,
  source,
  remaining,
  ofLimit,
  spent,
  free,
  reserve,
  spentValue,
  freeValue,
  reserveValue,
  bars,
  dailyLabel,
  dailyValue,
  todayLabel,
  todayValue,
  projectedLabel,
  projectedValue,
  note,
}: {
  title: string;
  source: string;
  remaining: string;
  ofLimit: string;
  spent: string;
  free: string;
  reserve: string;
  spentValue: number;
  freeValue: number;
  reserveValue: number;
  bars: CreditBar[];
  dailyLabel: string;
  dailyValue: string;
  todayLabel: string;
  todayValue: string;
  projectedLabel: string;
  projectedValue: string;
  note?: string;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{source}</p>
        </div>
        <p className="flex items-end gap-2">
          <span className="text-4xl font-semibold tracking-tight">{remaining}</span>
          <span className="pb-1 font-mono text-sm text-muted-foreground">{ofLimit}</span>
        </p>
      </div>
      <div className="mt-5 flex h-3.5 gap-0.5">
        <Bar value={share(spentValue, freeValue, reserveValue, spentValue)} color="#C8FF2E" />
        <Bar value={share(spentValue, freeValue, reserveValue, freeValue)} color="#2A2F37" />
        <Bar value={share(spentValue, freeValue, reserveValue, reserveValue)} color="#A394FF" />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <Legend color="#C8FF2E" label={spent} />
        <Legend color="#2A2F37" label={free} />
        <Legend color="#A394FF" label={reserve} />
      </div>
      <CreditDayBars series={bars} />
      <div className="mt-4 grid grid-cols-3 border-t pt-4">
        <Metric label={dailyLabel} value={dailyValue} />
        <Metric label={todayLabel} value={todayValue} className="border-l px-3 text-destructive" />
        <Metric label={projectedLabel} value={projectedValue} className="border-l px-3" />
      </div>
      {note ? <p className="mt-3 text-xs text-muted-foreground">{note}</p> : null}
    </section>
  );
}

export function LlmSpendCard({
  title,
  spent,
  models = [],
  ofBudget,
  valueNote,
  ratio,
}: {
  title: string;
  spent: string;
  models: { name: string; cost: string }[];
  ofBudget: string;
  valueNote: string;
  ratio: number;
}) {
  const width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;

  return (
    <section className="rounded-xl border bg-card p-4 md:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-4 text-4xl font-semibold tracking-tight">{spent}</p>
      {models.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1.5">
          {models.map((item) => (
            <li key={item.name} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-mono text-muted-foreground" title={item.name}>
                {item.name}
              </span>
              <span className="shrink-0 font-mono">{item.cost}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-xs text-muted-foreground">{ofBudget}</p>
      <div className="mt-4 h-2 overflow-hidden rounded bg-muted">
        <div className="h-full rounded bg-[#A394FF]" style={{ width }} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{valueNote}</p>
    </section>
  );
}

function CreditDayBars({ series }: { series: CreditBar[] }) {
  const max = Math.max(1, ...series.map((item) => item.credits));

  return (
    <div className="mt-5 flex h-28 items-end gap-1">
      {series.map((item) => {
        const height = item.state === "future" ? 16 : Math.max(item.credits > 0 ? 6 : 2, (item.credits / max) * 100);
        const tone =
          item.state === "today"
            ? "bg-[#C8FF2E]"
            : item.state === "future"
              ? "border border-[#C8FF2E40] bg-[#C8FF2E10]"
              : "bg-[#C8FF2E80]";
        return (
          <div
            key={item.day}
            title={item.day}
            className={`min-w-0 flex-1 rounded-t-[3px] ${tone}`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  if (value <= 0) return null;
  return <div className="h-full rounded-[4px]" style={{ width: `${value}%`, background: color }} />;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold">{value}</p>
    </div>
  );
}

function share(spent: number, free: number, reserve: number, value: number) {
  const total = spent + free + reserve;
  if (total <= 0 || value <= 0) return 0;
  return (value / total) * 100;
}
