const ORDER = ["home", "draw", "away", "over", "under"];

export type QuoteRow = {
  bookmaker: string;
  selection: string;
  price: number;
};

export type QuoteTable = {
  selections: string[];
  rows: { bookmaker: string; prices: Record<string, number | null>; margin: number | null }[];
};

export function averageBookPrice(quotes: QuoteRow[]): number | null {
  const byBookmaker = new Map<string, number>();
  for (const quote of quotes) {
    if (!(quote.price > 1)) continue;
    const current = byBookmaker.get(quote.bookmaker);
    if (current == null || quote.price > current) byBookmaker.set(quote.bookmaker, quote.price);
  }
  if (byBookmaker.size === 0) return null;
  const prices = [...byBookmaker.values()];
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

export function latestBefore<T extends { fetchedAt: Date }>(rows: T[], at: Date): T[] {
  const prior = rows.filter((row) => row.fetchedAt.getTime() <= at.getTime());
  const pool = prior.length > 0 ? prior : rows;
  if (pool.length === 0) return [];
  const latest = Math.max(...pool.map((row) => row.fetchedAt.getTime()));
  return pool.filter((row) => latest - row.fetchedAt.getTime() < 5000);
}

export function quoteTable(quotes: QuoteRow[]): QuoteTable {
  const byBookmaker = new Map<string, Map<string, number>>();
  for (const quote of quotes) {
    if (!(quote.price > 1)) continue;
    const book = byBookmaker.get(quote.bookmaker) ?? new Map<string, number>();
    const current = book.get(quote.selection);
    if (current == null || quote.price > current) book.set(quote.selection, quote.price);
    byBookmaker.set(quote.bookmaker, book);
  }

  const known = new Set([...byBookmaker.values()].flatMap((book) => [...book.keys()]));
  const selections = [
    ...ORDER.filter((selection) => known.has(selection)),
    ...[...known].filter((selection) => !ORDER.includes(selection)).sort(),
  ];

  const rows = [...byBookmaker.entries()]
    .map(([bookmaker, book]) => {
      const prices = Object.fromEntries(selections.map((selection) => [selection, book.get(selection) ?? null]));
      const complete = selections.length >= 2 && selections.every((selection) => {
        const price = prices[selection];
        return price != null && price > 1;
      });
      const margin = complete ? selections.reduce((sum, selection) => sum + 1 / (prices[selection] as number), 0) - 1 : null;
      return { bookmaker, prices, margin };
    })
    .sort((left, right) => left.bookmaker.localeCompare(right.bookmaker));

  return { selections, rows };
}
