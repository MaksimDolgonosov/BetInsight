export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("batch_size");
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

export function planBatches<T extends { notBefore: Date | null }>(
  rows: T[],
  size: number,
  now: Date,
  gapMs = 20_000,
): { items: T[]; notBefore: Date | null }[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.notBefore ? String(Math.floor(row.notBefore.getTime() / 60_000)) : "now";
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .sort((left, right) => compareBuckets(left[0], right[0]))
    .flatMap(([key, list]) =>
      chunk(list, size).map((items, index) => {
        const base = key === "now" ? now : new Date(Number(key) * 60_000);
        return {
          items,
          notBefore: key === "now" && index === 0 ? null : new Date(base.getTime() + index * gapMs),
        };
      }),
    );
}

function compareBuckets(left: string, right: string) {
  if (left === right) return 0;
  if (left === "now") return -1;
  if (right === "now") return 1;
  return Number(left) - Number(right);
}
