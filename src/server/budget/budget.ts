export type BudgetSnapshot = {
  monthlyLimit: number;
  reserveCredits: number;
  used: number;
  remaining: number;
  daysElapsed: number;
  daysLeft: number;
  dailyLimit: number;
  projectedRemaining: number;
};

export function daysInUtcMonth(now: Date): number {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function budgetSnapshot(input: {
  monthlyLimit: number;
  reserveCredits: number;
  used: number;
  now: Date;
}): BudgetSnapshot {
  const remaining = Math.max(0, input.monthlyLimit - input.used);
  const daysInMonth = daysInUtcMonth(input.now);
  const daysElapsed = input.now.getUTCDate();
  const daysLeft = Math.max(1, daysInMonth - daysElapsed + 1);
  const futureDays = daysInMonth - daysElapsed;
  const average = daysElapsed === 0 ? 0 : input.used / daysElapsed;

  return {
    monthlyLimit: input.monthlyLimit,
    reserveCredits: input.reserveCredits,
    used: input.used,
    remaining,
    daysElapsed,
    daysLeft,
    dailyLimit: remaining / daysLeft,
    projectedRemaining: remaining - average * futureDays,
  };
}

export function canSpend(
  snapshot: Pick<BudgetSnapshot, "remaining" | "reserveCredits">,
  cost: number,
  task: "scores" | "other",
): { ok: true } | { ok: false; reason: "reserve" | "insufficient" } {
  if (!Number.isFinite(cost) || cost < 0) {
    return { ok: false, reason: "insufficient" };
  }
  if (snapshot.remaining < cost) {
    return { ok: false, reason: "insufficient" };
  }
  if (task !== "scores" && snapshot.remaining - cost < snapshot.reserveCredits) {
    return { ok: false, reason: "reserve" };
  }
  return { ok: true };
}

export function creditsByDay(
  rows: { createdAt: string; cost: number }[],
  now: Date,
): { day: string; credits: number }[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const through = now.getUTCDate();
  const totals = Array.from({ length: through }, () => 0);

  for (const row of rows) {
    const date = new Date(row.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month) continue;
    const index = date.getUTCDate() - 1;
    if (index >= 0 && index < totals.length) {
      totals[index] += row.cost;
    }
  }

  return totals.map((credits, index) => ({
    day: String(index + 1).padStart(2, "0"),
    credits,
  }));
}
