import { DEFAULT_VOTE_LEAD_HOURS, DEFAULT_VOTE_WINDOW, type VoteWindow } from "./constants";

const MSK = "Europe/Moscow";
const HOUR_MS = 60 * 60 * 1000;

export type VoteTimeInput = {
  commenceTime: Date;
  now: Date;
  leadHours?: number;
  window?: VoteWindow;
};

export function voteTime(input: VoteTimeInput): Date {
  const leadHours = input.leadHours ?? DEFAULT_VOTE_LEAD_HOURS;
  const window = input.window ?? DEFAULT_VOTE_WINDOW;
  const ideal = new Date(input.commenceTime.getTime() - leadHours * HOUR_MS);
  if (insideVoteWindow(ideal, window)) return ideal;
  const planDay = mskParts(input.now);
  const clamped = mskInstant(planDay.year, planDay.month, planDay.day, window.endHour);
  if (clamped.getTime() < input.commenceTime.getTime()) return clamped;
  if (ideal.getTime() < input.commenceTime.getTime()) return ideal;
  return new Date(Math.min(input.now.getTime(), input.commenceTime.getTime() - 1));
}

function insideVoteWindow(instant: Date, window: VoteWindow): boolean {
  if (window.startHour > window.endHour) return false;
  const parts = mskParts(instant);
  const minutes = parts.hour * 60 + parts.minute + parts.second / 60;
  return minutes >= window.startHour * 60 && minutes <= window.endHour * 60;
}

function mskParts(instant: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MSK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const hour = read("hour");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: hour === 24 ? 0 : hour,
    minute: read("minute"),
    second: read("second"),
  };
}

function mskInstant(year: number, month: number, day: number, hour: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 3, 0, 0, 0));
}
