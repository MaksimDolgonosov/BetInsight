import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export async function GET() {
  const db = getDb();
  const ping = await db.execute<{ ok: number }>(sql`select 1 as ok`);
  const schema = await db.execute<{ app_settings: string | null }>(
    sql`select to_regclass('public.app_settings') as app_settings`,
  );
  const ready = ping.rows[0]?.ok === 1 && schema.rows[0]?.app_settings === "app_settings";

  return Response.json({ ok: ready, postgres: ready }, { status: ready ? 200 : 503 });
}
