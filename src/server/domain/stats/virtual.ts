export type VirtualVote = {
  market: string;
  selection: string;
  point: number | null;
};

export type VirtualSample = {
  status: "won" | "lost" | "void" | "pending";
  price: number;
  profitUnits: number;
};

export type VirtualMetrics = {
  count: number;
  won: number;
  lost: number;
  void: number;
  pending: number;
  decided: number;
  hitRate: number | null;
  profit: number | null;
  roi: number | null;
};

export function leadingVirtualPick(votes: readonly VirtualVote[]): VirtualVote | null {
  const groups = new Map<string, { vote: VirtualVote; count: number }>();
  for (const vote of votes) {
    const key = `${vote.market}:${vote.selection}:${vote.point ?? ""}`;
    const current = groups.get(key);
    if (current) current.count += 1;
    else groups.set(key, { vote, count: 1 });
  }
  const ranked = [...groups.values()].sort((left, right) => right.count - left.count);
  const leader = ranked[0];
  if (!leader || (ranked[1] != null && ranked[1].count === leader.count)) return null;
  return leader.vote;
}

export function summarizeVirtual(rows: readonly VirtualSample[]): VirtualMetrics {
  const won = rows.filter((row) => row.status === "won").length;
  const lost = rows.filter((row) => row.status === "lost").length;
  const voided = rows.filter((row) => row.status === "void").length;
  const pending = rows.filter((row) => row.status === "pending").length;
  const decided = won + lost;
  const profit = rows.reduce((sum, row) => sum + (row.status === "pending" ? 0 : row.profitUnits), 0);
  return {
    count: rows.length,
    won,
    lost,
    void: voided,
    pending,
    decided,
    hitRate: decided === 0 ? null : round(won / decided),
    profit: decided === 0 ? null : round(profit),
    roi: decided === 0 ? null : round(profit / decided),
  };
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
