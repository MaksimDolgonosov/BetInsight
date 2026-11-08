import "server-only";
import { getRedis } from "@/server/integrations/redis/client";
import { JOB_STALE_MS } from "@/server/jobs/claim";
import { JobBusyError } from "@/server/jobs/errors";

export async function withJobLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  if (!redis) throw new JobBusyError();
  const owner = crypto.randomUUID();
  const lockKey = `betinsight:job:${key}`;
  const acquired = await redis.set(lockKey, owner, { nx: true, ex: Math.ceil(JOB_STALE_MS / 1000) });
  if (acquired !== "OK") throw new JobBusyError();

  try {
    return await work();
  } finally {
    const current = await redis.get<string>(lockKey);
    if (current === owner) await redis.del(lockKey);
  }
}
