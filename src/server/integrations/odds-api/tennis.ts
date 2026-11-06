import type { LeagueSetting } from "@/server/domain/settings";
import { oddsApiMode } from "@/server/integrations/odds-api/client";

const TENNIS_KEY = /^tennis_[a-z0-9_]{3,70}$/;

export function activeTennisLeagues(payload: unknown): LeagueSetting[] {
  if (!Array.isArray(payload)) return [];
  const leagues: LeagueSetting[] = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.active !== true || row.has_outrights === true || row.group !== "Tennis") continue;
    if (typeof row.key !== "string" || !TENNIS_KEY.test(row.key)) continue;
    if (typeof row.title !== "string" || row.title.trim().length < 2) continue;
    leagues.push({
      key: row.key,
      group: "tennis",
      title: row.title.trim(),
      enabled: true,
    });
  }
  return leagues;
}

export async function listActiveTennisLeagues(fetchImpl: typeof fetch = fetch): Promise<LeagueSetting[]> {
  if (oddsApiMode() === "mock") {
    return [
      {
        key: "tennis_atp_paris_masters",
        group: "tennis",
        title: "ATP Paris Masters",
        enabled: true,
      },
    ];
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];

  try {
    const url = new URL("https://api.the-odds-api.com/v4/sports");
    url.searchParams.set("apiKey", apiKey);
    const response = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return [];
    return activeTennisLeagues(await response.json());
  } catch {
    return [];
  }
}
