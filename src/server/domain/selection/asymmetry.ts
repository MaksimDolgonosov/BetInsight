import { DEFAULT_PROB_RANGE, type ProbRange } from "./constants";

export type AsymmetryMarket = "h2h" | "totals" | "spreads";

export type AsymmetryOutcome = {
  market: AsymmetryMarket;
  selection: string;
  point: number | null;
  probability: number;
};

export type AsymmetryHit = {
  probability: number;
  market: AsymmetryMarket;
  selection: string;
  point: number | null;
  strength: number;
};

const MARKETS = new Set<AsymmetryMarket>(["h2h", "totals", "spreads"]);

export function asymmetryStrength(probability: number, range: ProbRange = DEFAULT_PROB_RANGE): number {
  const half = (range.max - range.min) / 2;
  if (!Number.isFinite(probability) || half <= 0) return 0;
  const center = (range.min + range.max) / 2;
  const raw = 1 - Math.abs(probability - center) / half;
  const clamped = Math.min(1, Math.max(0, raw));
  return Math.round(clamped * 1_000_000) / 1_000_000;
}

export function peakAsymmetry(
  outcomes: readonly AsymmetryOutcome[],
  range: ProbRange = DEFAULT_PROB_RANGE,
): AsymmetryHit | null {
  let peak: AsymmetryOutcome | null = null;
  for (const outcome of outcomes) {
    if (!MARKETS.has(outcome.market) || !Number.isFinite(outcome.probability)) continue;
    if (!peak || outcome.probability > peak.probability) peak = outcome;
  }
  if (!peak || peak.probability < range.min || peak.probability > range.max) return null;
  return {
    probability: peak.probability,
    market: peak.market,
    selection: peak.selection,
    point: peak.point,
    strength: asymmetryStrength(peak.probability, range),
  };
}
