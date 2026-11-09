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
