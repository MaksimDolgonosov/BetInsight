export type OpenRouterBalance = {
  remaining: number;
  total: number | null;
  used: number;
  scope: "account" | "key";
};

const BASE = "https://openrouter.ai/api/v1";

export async function fetchOpenRouterBalance(
  fetcher: typeof fetch = fetch,
): Promise<OpenRouterBalance | null> {
  const apiKey = process.env.OPENROUTER_MANAGEMENT_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;

  const account = await getJson(fetcher, `${BASE}/credits`, apiKey);
  const credits = account?.data;
  if (isNumber(credits?.total_credits) && isNumber(credits?.total_usage)) {
    return {
      remaining: credits.total_credits - credits.total_usage,
      total: credits.total_credits,
      used: credits.total_usage,
      scope: "account",
    };
  }

  const key = await getJson(fetcher, `${BASE}/key`, apiKey);
  const info = key?.data;
  if (isNumber(info?.limit_remaining) && isNumber(info?.usage)) {
    return {
      remaining: info.limit_remaining,
      total: isNumber(info.limit) ? info.limit : null,
      used: info.usage,
      scope: "key",
    };
  }
  return null;
}

async function getJson(fetcher: typeof fetch, url: string, apiKey: string) {
  try {
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return (await response.json()) as { data?: Record<string, unknown> & Record<string, number> };
  } catch {
    return null;
  }
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
