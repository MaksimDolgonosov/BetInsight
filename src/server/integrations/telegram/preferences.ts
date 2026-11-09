export type Locale = "ru" | "en";

export const QUIET_PRESET = { start: "23:00", end: "08:00" };

const HOUR_MINUTE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function localeFromLanguage(code: string | undefined): Locale {
  return code?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function asLocale(value: string | null | undefined): Locale {
  return value === "ru" ? "ru" : "en";
}

export function nextLeagues(current: string[] | null, key: string, enabled: string[]): string[] | null {
  if (key === "all") return null;
  if (!enabled.includes(key)) return current;
  const base = current ?? [...enabled];
  const next = base.includes(key) ? base.filter((item) => item !== key) : [...base, key];
  const allowed = new Set(enabled);
  const normalized = [...new Set(next)].filter((item) => allowed.has(item));
  if (enabled.length > 0 && enabled.every((item) => normalized.includes(item))) return null;
  return normalized;
}

export function parseQuiet(value: unknown): { start: string; end: string } | null {
  if (!value || typeof value !== "object") return null;
  const start = "start" in value ? value.start : null;
  const end = "end" in value ? value.end : null;
  if (typeof start !== "string" || typeof end !== "string") return null;
  if (!HOUR_MINUTE.test(start) || !HOUR_MINUTE.test(end)) return null;
  return { start, end };
}

export function parseLeagues(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}
