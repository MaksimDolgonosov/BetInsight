import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { filterPicks, parseFilter, toCsv, withPeriod } from "@/server/domain/stats/metrics";
import { loadPublicBoard } from "@/server/stats/load";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ locale: string }> }) {
  const { locale } = await context.params;
  if (!hasLocale(routing.locales, locale)) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const board = await loadPublicBoard();
  const picks = filterPicks(board.picks, parseFilter(withPeriod(Object.fromEntries(url.searchParams.entries()))));
  return new Response(toCsv(picks), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"betinsight-stats.csv\"",
    },
  });
}
