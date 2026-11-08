import { mockEventsPayload, mockOddsPayload, mockScoresPayload, mockSportsPayload } from "@/server/integrations/odds-api/mock";
import {
  mapOddsEvents,
  mapScores,
  mapTrackedSports,
  mapUpcomingEvents,
  type OddsEvent,
  type ScoreEvent,
  type TrackedSport,
  type UpcomingEvent,
} from "@/server/integrations/odds-api/schema";

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

export type OddsCallResult<T> = {
  ok: boolean;
  mocked: boolean;
  httpStatus: number;
  endpoint: string;
  remaining: number | null;
  used: number | null;
  lastCost: number | null;
  raw: unknown;
  data: T;
  error: string | null;
};

export async function fetchSports(input: {
  catalogKeys: readonly string[];
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<OddsCallResult<TrackedSport[]>> {
  if (oddsApiMode() === "mock") {
    const raw = mockSportsPayload();
    const mapped = mapTrackedSports(raw, input.catalogKeys);
    return callResult("GET /v4/sports", true, 200, 0, raw, mapped.sports, mapped.valid);
  }
  return oddsGet({
    path: "/sports",
    endpoint: "GET /v4/sports",
    search: {},
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
    map: (raw) => {
      const mapped = mapTrackedSports(raw, input.catalogKeys);
      return { data: mapped.sports, valid: mapped.valid };
    },
  });
}

export async function fetchSportEvents(input: {
  sportKey: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<OddsCallResult<UpcomingEvent[]>> {
  if (oddsApiMode() === "mock") {
    const raw = mockEventsPayload(input.sportKey);
    const mapped = mapUpcomingEvents(raw);
    return callResult(`GET /v4/sports/${input.sportKey}/events`, true, 200, 0, raw, mapped.events, mapped.valid);
  }
  return oddsGet({
    path: `/sports/${input.sportKey}/events`,
    endpoint: `GET /v4/sports/${input.sportKey}/events`,
    search: {},
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
    map: (raw) => {
      const mapped = mapUpcomingEvents(raw);
      return { data: mapped.events, valid: mapped.valid };
    },
  });
}

export async function fetchSportScores(input: {
  sportKey: string;
  daysFrom?: number;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<OddsCallResult<ScoreEvent[]>> {
  const daysFrom = input.daysFrom ?? 3;
  if (oddsApiMode() === "mock") {
    const raw = mockScoresPayload(input.sportKey);
    const mapped = mapScores(raw);
    return callResult(`GET /v4/sports/${input.sportKey}/scores`, true, 200, 0, raw, mapped.events, mapped.valid);
  }
  return oddsGet({
    path: `/sports/${input.sportKey}/scores`,
    endpoint: `GET /v4/sports/${input.sportKey}/scores`,
    search: { daysFrom: String(daysFrom) },
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
    map: (raw) => {
      const mapped = mapScores(raw);
      return { data: mapped.events, valid: mapped.valid };
    },
  });
}

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

  const response = await oddsFetch(
    `/sports/${input.sportKey}/odds`,
    {
      regions: input.region,
      markets: input.markets.join(","),
      oddsFormat: "decimal",
    },
    apiKey,
    input.fetchImpl ?? fetch,
  );
  const latencyMs = response.latencyMs;
  const raw = response.raw;
  const mapped = mapOddsEvents(raw);

  const httpOk = response.status >= 200 && response.status < 300;
  return {
    ok: httpOk && mapped.valid,
    mocked: false,
    httpStatus: response.status,
    latencyMs,
    remaining: response.remaining,
    used: response.used,
    lastCost: response.lastCost,
    raw,
    events: filterMarkets(mapped.events, input.markets),
    valid: mapped.valid,
    error: httpOk && mapped.valid ? null : "odds_failed",
  };
}

async function oddsGet<T>(input: {
  path: string;
  endpoint: string;
  search: Record<string, string>;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  map: (raw: unknown) => { data: T; valid: boolean };
}): Promise<OddsCallResult<T>> {
  const apiKey = input.apiKey ?? process.env.ODDS_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      mocked: false,
      httpStatus: 0,
      endpoint: input.endpoint,
      remaining: null,
      used: null,
      lastCost: null,
      raw: null,
      data: input.map(null).data,
      error: "missing_odds_key",
    };
  }
  const response = await oddsFetch(input.path, input.search, apiKey, input.fetchImpl ?? fetch);
  const mapped = input.map(response.raw);
  return {
    ok: response.status >= 200 && response.status < 300 && mapped.valid,
    mocked: false,
    httpStatus: response.status,
    endpoint: input.endpoint,
    remaining: response.remaining,
    used: response.used,
    lastCost: response.lastCost,
    raw: response.raw,
    data: mapped.data,
    error: response.status >= 200 && response.status < 300 && mapped.valid ? null : "odds_failed",
  };
}

function callResult<T>(
  endpoint: string,
  mocked: boolean,
  httpStatus: number,
  lastCost: number | null,
  raw: unknown,
  data: T,
  valid: boolean,
): OddsCallResult<T> {
  return {
    ok: valid,
    mocked,
    httpStatus,
    endpoint,
    remaining: null,
    used: null,
    lastCost,
    raw,
    data,
    error: valid ? null : "odds_failed",
  };
}

async function oddsFetch(
  path: string,
  search: Record<string, string>,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<{
  status: number;
  latencyMs: number;
  remaining: number | null;
  used: number | null;
  lastCost: number | null;
  raw: unknown;
}> {
  const url = new URL(`${ODDS_API_URL}${path}`);
  for (const [key, value] of Object.entries(search)) url.searchParams.set(key, value);
  url.searchParams.set("apiKey", apiKey);
  const started = Date.now();
  const response = await fetchWithRetry(url, fetchImpl);
  return {
    status: response.status,
    latencyMs: Date.now() - started,
    remaining: headerNumber(response, "x-requests-remaining"),
    used: headerNumber(response, "x-requests-used"),
    lastCost: headerNumber(response, "x-requests-last"),
    raw: await readJson(response),
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
