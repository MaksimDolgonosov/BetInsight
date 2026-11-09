import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteOrigin } from "@/server/site";
import { loadPublicBoard } from "@/server/stats/load";

const PAGES = ["", "/forecasts", "/stats", "/methodology"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const board = await loadPublicBoard();
  const events = [...new Set(board.picks.map((pick) => `/events/${pick.eventId}`))];
  return [...PAGES, ...events].flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${origin}/${locale}${path}`,
      changeFrequency: "daily" as const,
      priority: path === "" ? 1 : path.startsWith("/events") ? 0.6 : 0.8,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((item) => [item, `${origin}/${item}${path}`])),
      },
    })),
  );
}
