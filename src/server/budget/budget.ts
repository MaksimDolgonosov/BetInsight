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
  apiRemaining?: number | null;
}): BudgetSnapshot {
  const parts = creditParts(input);
  const remaining = parts.remaining;
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

export type CreditParts = {
  remaining: number;
  spent: number;
  free: number;
  reserve: number;
  fromApi: boolean;
};

export function creditParts(input: {
  monthlyLimit: number;
  reserveCredits: number;
  used: number;
  apiRemaining?: number | null;
}): CreditParts {
  const ledgerRemaining = Math.max(0, input.monthlyLimit - input.used);
  const fromApi = input.apiRemaining != null && Number.isFinite(input.apiRemaining);
  const remaining = fromApi ? Math.max(0, input.apiRemaining) : ledgerRemaining;
  const spent = Math.max(0, input.monthlyLimit - remaining);
  const reserve = Math.min(Math.max(0, input.reserveCredits), remaining);
  const free = Math.max(0, remaining - reserve);
  return { remaining, spent, free, reserve, fromApi };
}

export type CreditBar = {
  day: string;
  credits: number;
  state: "past" | "today" | "future";
};

export function monthCreditBars(
  rows: { createdAt: string; cost: number }[],
  now: Date,
): CreditBar[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = now.getUTCDate();
  const totals = Array.from({ length: daysInUtcMonth(now) }, () => 0);

  for (const row of rows) {
    const date = new Date(row.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month) continue;
    const index = date.getUTCDate() - 1;
    if (index >= 0 && index < totals.length) totals[index] += row.cost;
  }

  return totals.map((credits, index) => {
    const date = index + 1;
    return {
      day: String(date).padStart(2, "0"),
      credits,
      state: date < today ? "past" : date === today ? "today" : "future",
    };
  });
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
