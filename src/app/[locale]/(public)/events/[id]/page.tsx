import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventScreen } from "@/components/public/event-screen";
import { languageAlternates } from "@/server/site";
import { loadPublicEvent } from "@/server/stats/load";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await props.params;
  const event = await loadPublicEvent(id);
  const t = await getTranslations({ locale, namespace: "public.event" });
  const title = event ? `${event.pick.home} — ${event.pick.away}` : t("missing");
  return {
    title,
    description: event ? t("meta", { home: event.pick.home, away: event.pick.away, league: event.pick.league }) : t("missing"),
    alternates: languageAlternates(locale, `/events/${id}`),
  };
}

export default async function EventPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const event = await loadPublicEvent(id);
  if (!event) notFound();
  return <EventScreen locale={locale} event={event} />;
}
