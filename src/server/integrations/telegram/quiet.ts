export type QuietWindow = { start: string; end: string } | null;

const HOUR_MINUTE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function quietUntil(now: Date, window: QuietWindow, timeZone: string): Date | null {
  if (!window) return null;
  const start = clockMinutes(window.start);
  const end = clockMinutes(window.end);
  if (start == null || end == null || start === end) return null;

  const parts = zonedParts(now, timeZone);
  const minutes = parts.hour * 60 + parts.minute;
  const crossesMidnight = start > end;
  const inside = crossesMidnight ? minutes >= start || minutes < end : minutes >= start && minutes < end;
  if (!inside) return null;

  const dayOffset = crossesMidnight && minutes >= start ? 1 : 0;
  return zonedInstant(parts, end, dayOffset, timeZone);
}

export function dayKey(now: Date, timeZone: string): string {
  const parts = zonedParts(now, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function shiftDay(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

export function onCalendarDay(iso: string | null, from: string, to: string, timeZone: string): boolean {
  if (!iso) return false;
  const key = dayKey(new Date(iso), timeZone);
  return key >= from && key <= to;
}

function clockMinutes(value: string): number | null {
  const match = HOUR_MINUTE.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function zonedInstant(
  parts: { year: number; month: number; day: number },
  minutes: number,
  dayOffset: number,
  timeZone: string,
): Date {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, hour, minute, 0));
  const corrected = new Date(guess.getTime() - zoneOffsetMinutes(guess, timeZone) * 60_000);
  const again = zoneOffsetMinutes(corrected, timeZone);
  const first = zoneOffsetMinutes(guess, timeZone);
  if (again === first) return corrected;
  return new Date(guess.getTime() - again * 60_000);
}

function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

function zonedParts(instant: Date, timeZone: string) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: string) => formatted.find((part) => part.type === type)?.value ?? "0";
  const hour = value("hour") === "24" ? 0 : Number(value("hour"));
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour,
    minute: Number(value("minute")),
    second: Number(value("second")),
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
