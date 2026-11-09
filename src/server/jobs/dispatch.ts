import "server-only";
import { runAiConsensus, runAiPredict, runAiResearch, runAiVote } from "@/server/jobs/ai";
import { runEvaluateModel, runFetchOdds, runFetchScores, runPlanDay, runSyncEvents, runSyncSports } from "@/server/jobs/data";
import { runSettle } from "@/server/jobs/settle";
import { runDailyReport, runPublish, runWeeklyReport } from "@/server/jobs/telegram";
import type { JobOutcome } from "@/server/jobs/runner";

const DATA_JOBS = {
  "sync-sports": runSyncSports,
  "sync-events": runSyncEvents,
  "plan-day": runPlanDay,
  "fetch-odds": runFetchOdds,
  "evaluate-model": runEvaluateModel,
  "ai-predict": runAiPredict,
  "ai-research": runAiResearch,
  "ai-vote": runAiVote,
  "ai-consensus": runAiConsensus,
  "fetch-scores": runFetchScores,
  settle: runSettle,
  publish: runPublish,
  "daily-report": runDailyReport,
  "weekly-report": runWeeklyReport,
} as const;

export type DataJobName = keyof typeof DATA_JOBS;

export function isDataJob(job: string): job is DataJobName {
  return Object.hasOwn(DATA_JOBS, job);
}

export function runDataJob(job: DataJobName, payload: unknown, now = new Date()): Promise<JobOutcome> {
  return DATA_JOBS[job](payload, now);
}
