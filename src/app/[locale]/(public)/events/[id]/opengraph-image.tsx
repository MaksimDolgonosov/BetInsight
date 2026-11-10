import { getTranslations } from "next-intl/server";
import { shareContentType, shareImage, shareSize } from "@/server/share-image";
import { loadPublicEvent } from "@/server/stats/load";

export const alt = "BetInsight";
export const size = shareSize;
export const contentType = shareContentType;
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const [event, t] = await Promise.all([
    loadPublicEvent(id),
    getTranslations({ locale, namespace: "public.event" }),
  ]);
  if (!event) return shareImage(t("missing"), t("missing"));
  const title = `${event.pick.home} — ${event.pick.away}`;
  const description = t("meta", { home: event.pick.home, away: event.pick.away, league: event.pick.league });
  return shareImage(title, description);
}
