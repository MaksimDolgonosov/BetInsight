import { mockOddsPayload } from "@/server/integrations/odds-api/mock";
import { mapOddsEvents, type OddsEvent } from "@/server/integrations/odds-api/schema";

export type OddsFetchResult = {
  ok: boolean;
  mocked: boolean;
  httpStatus: number;
  latencyMs: number;
  remaining: number | null;
  used: number | null;
  lastCost: number | null;
  raw: unknown;
  events: OddsEvent[];
  valid: boolean;
  error: string | null;
};

const ODDS_API_URL = "https://api.the-odds-api.com/v4";

export function oddsApiMode(): "live" | "mock" {
  if (process.env.VERCEL_ENV === "preview" || process.env.ODDS_API_MODE === "mock") return "mock";
  return "live";
}

export async function fetchLeagueOdds(input: {
  sportKey: string;
  region: string;
  markets: string[];
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<OddsFetchResult> {
  if (oddsApiMode() === "mock") {
    const raw = mockOddsPayload(input.sportKey);
    const mapped = mapOddsEvents(raw);
    return {
      ok: true,
      mocked: true,
      httpStatus: 200,
      latencyMs: 0,
      remaining: null,
      used: null,
      lastCost: 0,
      raw,
      events: filterMarkets(mapped.events, input.markets),
      valid: mapped.valid,
      error: null,
    };
  }

  const apiKey = input.apiKey ?? process.env.ODDS_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      mocked: false,
      httpStatus: 0,
      latencyMs: 0,
      remaining: null,
      used: null,
      lastCost: null,
      raw: null,
      events: [],
      valid: false,
      error: "missing_odds_key",
    };
  }

  const url = new URL(`${ODDS_API_URL}/sports/${input.sportKey}/odds`);
  url.searchParams.set("regions", input.region);
  url.searchParams.set("markets", input.markets.join(","));
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("apiKey", apiKey);

  const started = Date.now();
  const response = await fetchWithRetry(url, input.fetchImpl ?? fetch);
  const latencyMs = Date.now() - started;
  const raw = await readJson(response);
  const mapped = mapOddsEvents(raw);

  return {
    ok: response.ok && mapped.valid,
    mocked: false,
    httpStatus: response.status,
    latencyMs,
    remaining: headerNumber(response, "x-requests-remaining"),
    used: headerNumber(response, "x-requests-used"),
    lastCost: headerNumber(response, "x-requests-last"),
    raw,
    events: filterMarkets(mapped.events, input.markets),
    valid: mapped.valid,
    error: response.ok && mapped.valid ? null : "odds_failed",
  };
}

function filterMarkets(events: OddsEvent[], markets: string[]): OddsEvent[] {
  return events.map((event) => ({
    ...event,
    quotes: event.quotes.filter((quote) => markets.includes(quote.market)),
  }));
}

async function fetchWithRetry(url: URL, fetchImpl: typeof fetch): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (response.status < 500 && response.status !== 429) return response;
      lastError = new Error(`Odds API status ${response.status}`);
      if (attempt === 1) return response;
    } catch (error) {
      lastError = error;
      if (attempt === 1) throw lastError;
    }
  }
  throw lastError;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function headerNumber(response: Response, name: string): number | null {
  const value = Number(response.headers.get(name));
  return Number.isFinite(value) ? value : null;
}
