export const JOBS = [
  "sync-sports",
  "sync-events",
  "plan-day",
  "fetch-odds",
  "evaluate-model",
  "ai-predict",
  "publish",
  "fetch-closing-odds",
  "fetch-scores",
  "settle",
  "daily-report",
  "weekly-report",
] as const;

export type JobName = (typeof JOBS)[number];

const JOB_NAMES = new Set<string>(JOBS);

export function isJobName(job: string): job is JobName {
  return JOB_NAMES.has(job);
}
