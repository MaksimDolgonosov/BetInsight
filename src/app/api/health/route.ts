import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { pingRedis, redisConfigured } from "@/server/integrations/redis/client";

export async function GET() {
  const db = getDb();
  const ping = await db.execute<{ ok: number }>(sql`select 1 as ok`);
  const schema = await db.execute<{ app_settings: string | null }>(
    sql`select to_regclass('public.app_settings') as app_settings`,
  );
  const postgres = ping.rows[0]?.ok === 1 && schema.rows[0]?.app_settings === "app_settings";
  const redis = redisConfigured() ? await pingRedis() : false;
  const ready = postgres && (!redisConfigured() || redis);

  return Response.json({ ok: ready, postgres, redis }, { status: ready ? 200 : 503 });
}
