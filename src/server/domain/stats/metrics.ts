import { MARKETS } from "@/server/domain/settings";

export type StatsTrack = "value" | "ai_pick";
export type PickStatus = "pending" | "won" | "lost" | "void";

export type PublicPick = {
  id: string;
  eventId: string;
  track: StatsTrack;
  sportKey: string;
  league: string;
  home: string;
  away: string;
  market: string;
  selection: string;
  point: number | null;
  price: number;
  bookmaker: string;
  status: PickStatus;
  profitUnits: number | null;
  aiProb: number | null;
  confidence: string | null;
  llmModel: string | null;
  promptVersion: string | null;
  webSearch: boolean;
  publishedAt: string;
  settledAt: string | null;
  hash: string;
  matchesMarketFavorite: boolean | null;
  unanimous: boolean | null;
  closingPrice: number | null;
  commenceTime?: string | null;
  ev?: number | null;
  homeScore?: number | null;
  awayScore?: number | null;
};

export type BaselineBet = {
  eventId: string;
  kind: "favorite" | "model";
  price: number;
  probability: number | null;
  status: Exclude<PickStatus, "pending">;
  profitUnits: number;
  at: string;
};

export type ModelVoteBet = {
  eventId: string;
  model: string;
  price: number;
  probability: number | null;
  status: Exclude<PickStatus, "pending">;
  profitUnits: number;
  at: string;
};

export type StatsFilter = {
  track: "all" | StatsTrack;
  league: string | null;
  market: string | null;
  confidence: string | null;
  model: string | null;
  promptVersion: string | null;
  webSearch: "all" | "yes" | "no";
  from: string | null;
  to: string | null;
};

export type MetricBlock = {
  count: number;
  won: number;
  lost: number;
  void: number;
  pending: number;
  decided: number;
  hitRate: number | null;
  hitRateLow: number | null;
  hitRateHigh: number | null;
  roi: number | null;
  yield: number | null;
  profit: number;
  averagePrice: number | null;
  maxDrawdown: number;
  longestWin: number;
  longestLoss: number;
  brier: number | null;
  clv: number | null;
  smallSample: boolean;
  bank: { at: string; profit: number }[];
  calibration: { from: number; predicted: number; actual: number; count: number }[];
};

export type PublicSummary = {
  filter: StatsFilter;
  combined: MetricBlock;
  value: MetricBlock;
  aiPick: MetricBlock;
  favorite: MetricBlock;
  model: MetricBlock;
  favoriteShare: number | null;
  unanimous: MetricBlock;
  split: MetricBlock;
  models: { model: string; metrics: MetricBlock }[];
  rows: PublicPick[];
};

const EMPTY_FILTER: StatsFilter = {
  track: "all",
  league: null,
  market: null,
  confidence: null,
  model: null,
  promptVersion: null,
  webSearch: "all",
  from: null,
  to: null,
};

export type FilterChoices = {
  leagues: { value: string; label: string }[];
  markets: string[];
  confidence: string[];
  models: string[];
  prompts: string[];
};

const CONFIDENCE = ["low", "medium", "high"];

export function filterChoices(input: {
  leagues: { key: string; title: string; enabled: boolean }[];
  models: string[];
  promptVersions: string[];
  picks: PublicPick[];
}): FilterChoices {
  const leagues = new Map<string, string>();
  for (const league of input.leagues) {
    if (league.enabled) leagues.set(league.key, league.title);
  }
  for (const pick of input.picks) leagues.set(pick.sportKey, pick.league);
  return {
    leagues: [...leagues.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    markets: withExtras(MARKETS, input.picks.map((pick) => pick.market)),
    confidence: withExtras(CONFIDENCE, input.picks.map((pick) => pick.confidence)),
    models: listed([...input.models, ...input.picks.map((pick) => pick.llmModel)]),
    prompts: listed([...input.promptVersions, ...input.picks.map((pick) => pick.promptVersion)]),
  };
}

function listed(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function withExtras(base: readonly string[], extras: (string | null | undefined)[]): string[] {
  const known = new Set(base);
  return [...base, ...listed(extras).filter((value) => !known.has(value))];
}

export function emptyFilter(): StatsFilter {
  return { ...EMPTY_FILTER };
}

export function parseFilter(query: Record<string, string | string[] | undefined>): StatsFilter {
  const track = one(query, "track");
  const webSearch = one(query, "webSearch");
  return {
    track: track === "value" || track === "ai_pick" ? track : "all",
    league: text(one(query, "league")),
    market: text(one(query, "market")),
    confidence: text(one(query, "confidence")),
    model: text(one(query, "model")),
    promptVersion: text(one(query, "promptVersion")),
    webSearch: webSearch === "yes" || webSearch === "no" ? webSearch : "all",
    from: date(one(query, "from")),
    to: date(one(query, "to")),
  };
}

export function filterPicks(picks: PublicPick[], filter: StatsFilter): PublicPick[] {
  return picks.filter((pick) => {
    if (filter.track !== "all" && pick.track !== filter.track) return false;
    if (filter.league && pick.sportKey !== filter.league) return false;
    if (filter.market && pick.market !== filter.market) return false;
    if (filter.confidence && pick.confidence !== filter.confidence) return false;
    if (filter.model && pick.llmModel !== filter.model) return false;
    if (filter.promptVersion && pick.promptVersion !== filter.promptVersion) return false;
    if (filter.webSearch === "yes" && !pick.webSearch) return false;
    if (filter.webSearch === "no" && pick.webSearch) return false;
    const day = pick.publishedAt.slice(0, 10);
    if (filter.from && day < filter.from) return false;
    if (filter.to && day > filter.to) return false;
    return true;
  });
}

export function summarize(input: {
  picks: PublicPick[];
  baselines: BaselineBet[];
  votes: ModelVoteBet[];
  filter?: StatsFilter;
}): PublicSummary {
  const filter = input.filter ?? emptyFilter();
  const rows = filterPicks(input.picks, filter).sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  const eventIds = new Set(rows.map((row) => row.eventId));
  const aiEvents = new Set(rows.filter((row) => row.track === "ai_pick").map((row) => row.eventId));
  const valueRows = rows.filter((row) => row.track === "value");
  const aiRows = rows.filter((row) => row.track === "ai_pick");
  const flagged = aiRows.filter((row) => row.matchesMarketFavorite != null);
  const favoriteShare = flagged.length === 0 ? null : flagged.filter((row) => row.matchesMarketFavorite).length / flagged.length;

  return {
    filter,
    combined: block(rows),
    value: block(valueRows),
    aiPick: block(aiRows),
    favorite: block(uniqueEvents(input.baselines.filter((row) => row.kind === "favorite" && eventIds.has(row.eventId)))),
    model: block(uniqueEvents(input.baselines.filter((row) => row.kind === "model" && eventIds.has(row.eventId)))),
    favoriteShare,
    unanimous: block(aiRows.filter((row) => row.unanimous === true)),
    split: block(aiRows.filter((row) => row.unanimous === false)),
    models: modelBlocks(input.votes.filter((row) => aiEvents.has(row.eventId))),
    rows,
  };
}

export type SliceDimension = "league" | "market" | "confidence" | "prompt";

export type SliceRow = {
  key: string;
  label: string;
  sportKey: string | null;
  metrics: MetricBlock;
};

export function groupSlices(picks: PublicPick[], dimension: SliceDimension): SliceRow[] {
  const groups = new Map<string, { label: string; sportKey: string | null; rows: PublicPick[] }>();
  for (const pick of picks) {
    const key =
      dimension === "league"
        ? pick.sportKey
        : dimension === "market"
          ? pick.market
          : dimension === "confidence"
            ? (pick.confidence ?? "unknown")
            : (pick.promptVersion ?? "unknown");
    const label = dimension === "league" ? pick.league : key === "unknown" ? "—" : key;
    const group = groups.get(key) ?? { label, sportKey: dimension === "league" ? pick.sportKey : null, rows: [] };
    group.rows.push(pick);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ key, label: group.label, sportKey: group.sportKey, metrics: block(group.rows) }))
    .sort((left, right) => right.metrics.count - left.metrics.count || left.label.localeCompare(right.label));
}

export type CalibrationBand = {
  from: number;
  to: number;
  predicted: number | null;
  actual: number | null;
  count: number;
};

export function calibrationBands(picks: PublicPick[]): CalibrationBand[] {
  const decided = picks.flatMap((pick) => {
    if ((pick.status !== "won" && pick.status !== "lost") || pick.aiProb == null) return [];
    return [{ probability: pick.aiProb, won: pick.status === "won" }];
  });
  const occupied = new Set(decided.map((row) => Math.floor(row.probability * 20) / 20));
  const starts = occupied.size === 0 ? [0.4, 0.45, 0.5, 0.55, 0.6, 0.65] : [...occupied].sort((left, right) => left - right);
  return starts.map((from) => {
    const to = Math.round((from + 0.05) * 100) / 100;
    const bucket = decided.filter((row) => row.probability >= from && row.probability < to);
    if (bucket.length === 0) return { from, to, predicted: null, actual: null, count: 0 };
    const predicted = bucket.reduce((sum, row) => sum + row.probability, 0) / bucket.length;
    const actual = bucket.filter((row) => row.won).length / bucket.length;
    return { from, to, predicted: round(predicted), actual: round(actual), count: bucket.length };
  });
}

export function withPeriod(
  query: Record<string, string | string[] | undefined>,
  now = new Date(),
): Record<string, string | string[] | undefined> {
  const period = Array.isArray(query.period) ? query.period[0] : query.period;
  if (period !== "7" && period !== "30" && period !== "90") return query;
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - Number(period));
  return { ...query, from: from.toISOString().slice(0, 10) };
}

export function toCsv(picks: PublicPick[]): string {
  const header = [
    "published_at",
    "settled_at",
    "league",
    "home",
    "away",
    "track",
    "market",
    "selection",
    "point",
    "price",
    "bookmaker",
    "status",
    "profit_units",
    "hash",
  ];
  const lines = picks.map((pick) =>
    [
      pick.publishedAt,
      pick.settledAt ?? "",
      pick.league,
      pick.home,
      pick.away,
      pick.track,
      pick.market,
      pick.selection,
      pick.point ?? "",
      pick.price,
      pick.bookmaker,
      pick.status,
      pick.profitUnits ?? "",
      pick.hash,
    ]
      .map(csvCell)
      .join(","),
  );
  return `\uFEFF${[header.join(","), ...lines].join("\n")}\n`;
}

function block(rows: Array<{
  status: PickStatus;
  profitUnits: number | null;
  price: number;
  probability?: number | null;
  aiProb?: number | null;
  at?: string;
  settledAt?: string | null;
  publishedAt?: string;
  closingPrice?: number | null;
}>): MetricBlock {
  const won = rows.filter((row) => row.status === "won").length;
  const lost = rows.filter((row) => row.status === "lost").length;
  const voided = rows.filter((row) => row.status === "void").length;
  const pending = rows.filter((row) => row.status === "pending").length;
  const decided = won + lost;
  const settled = rows
    .filter((row) => row.status !== "pending")
    .sort((left, right) => stamp(left).localeCompare(stamp(right)));
  const stakes = decided;
  const profit = round(settled.reduce((sum, row) => sum + (row.profitUnits ?? 0), 0));
  const rate = decided === 0 ? null : won / decided;
  const interval = rate == null ? null : wilson(won, decided);
  const prices = rows.filter((row) => row.status === "won" || row.status === "lost");
  const probabilities = prices.flatMap((row) => {
    const probability = row.aiProb ?? row.probability;
    return probability == null ? [] : [{ probability, won: row.status === "won" }];
  });
  const closing = rows.filter((row) => row.status !== "pending" && row.closingPrice != null && row.closingPrice > 1);

  return {
    count: rows.length,
    won,
    lost,
    void: voided,
    pending,
    decided,
    hitRate: rate == null ? null : round(rate),
    hitRateLow: interval ? round(interval.low) : null,
    hitRateHigh: interval ? round(interval.high) : null,
    roi: stakes === 0 ? null : round(profit / stakes),
    yield: stakes === 0 ? null : round(profit / stakes),
    profit,
    averagePrice: prices.length === 0 ? null : round(prices.reduce((sum, row) => sum + row.price, 0) / prices.length),
    maxDrawdown: round(drawdown(settled)),
    longestWin: streak(settled, "won"),
    longestLoss: streak(settled, "lost"),
    brier: probabilities.length === 0 ? null : round(probabilities.reduce((sum, row) => sum + (row.probability - (row.won ? 1 : 0)) ** 2, 0) / probabilities.length),
    clv: closing.length === 0 ? null : round(closing.reduce((sum, row) => sum + (row.price / row.closingPrice! - 1), 0) / closing.length),
    smallSample: decided > 0 && decided < 100,
    bank: bankCurve(settled),
    calibration: calibrate(probabilities),
  };
}

function modelBlocks(votes: ModelVoteBet[]): { model: string; metrics: MetricBlock }[] {
  const groups = new Map<string, ModelVoteBet[]>();
  for (const vote of votes) {
    const rows = groups.get(vote.model) ?? [];
    rows.push(vote);
    groups.set(vote.model, rows);
  }
  return [...groups.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([model, rows]) => ({ model, metrics: block(rows) }));
}

function uniqueEvents<T extends { eventId: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.eventId)) return false;
    seen.add(row.eventId);
    return true;
  });
}

function bankCurve(rows: Array<{ profitUnits: number | null; at?: string; settledAt?: string | null; publishedAt?: string }>): { at: string; profit: number }[] {
  let profit = 0;
  return rows.map((row) => {
    profit = round(profit + (row.profitUnits ?? 0));
    return { at: stamp(row), profit };
  });
}

function drawdown(rows: Array<{ profitUnits: number | null }>): number {
  let bank = 0;
  let peak = 0;
  let worst = 0;
  for (const row of rows) {
    bank += row.profitUnits ?? 0;
    if (bank > peak) peak = bank;
    worst = Math.max(worst, peak - bank);
  }
  return worst;
}

function streak(rows: Array<{ status: PickStatus }>, status: "won" | "lost"): number {
  let best = 0;
  let current = 0;
  for (const row of rows) {
    if (row.status === "void") continue;
    if (row.status === status) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function calibrate(rows: { probability: number; won: boolean }[]): MetricBlock["calibration"] {
  const bins: MetricBlock["calibration"] = [];
  for (let index = 0; index < 10; index += 1) {
    const from = index / 10;
    const to = (index + 1) / 10;
    const bucket = rows.filter((row) => row.probability >= from && (index === 9 ? row.probability <= to : row.probability < to));
    if (bucket.length === 0) continue;
    const predicted = bucket.reduce((sum, row) => sum + row.probability, 0) / bucket.length;
    const actual = bucket.filter((row) => row.won).length / bucket.length;
    bins.push({ from, predicted: round(predicted), actual: round(actual), count: bucket.length });
  }
  return bins;
}

function wilson(wins: number, total: number): { low: number; high: number } {
  const z = 1.96;
  const p = wins / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function stamp(row: { at?: string; settledAt?: string | null; publishedAt?: string }): string {
  return row.at ?? row.settledAt ?? row.publishedAt ?? "";
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function one(query: Record<string, string | string[] | undefined>, key: string): string {
  const value = query[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function text(value: string): string | null {
  if (!value || value.length > 160) return null;
  return value;
}

function date(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function csvCell(value: string | number): string {
  const textValue = String(value);
  if (/[",\n]/.test(textValue)) return `"${textValue.replaceAll("\"", "\"\"")}"`;
  return textValue;
}
