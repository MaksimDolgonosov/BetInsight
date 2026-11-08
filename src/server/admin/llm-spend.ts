export type ModelSpend = {
  model: string;
  costUsd: number;
};

export function groupModelSpend(rows: { model: string; costUsd: number | null }[]): ModelSpend[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.model, (totals.get(row.model) ?? 0) + (row.costUsd ?? 0));
  }
  return [...totals.entries()]
    .map(([model, costUsd]) => ({ model, costUsd }))
    .sort((a, b) => b.costUsd - a.costUsd || a.model.localeCompare(b.model));
}
