import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventScreen, ScheduledScreen } from "@/components/public/event-screen";
import { JsonLd } from "@/components/public/json-ld";
import { absoluteUrl, pageJsonLd, socialMetadata, sportsEventNode } from "@/server/seo";
import { loadPublicEvent, loadScheduledForecast } from "@/server/stats/load";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await props.params;
  const event = await loadPublicEvent(id);
  const scheduled = event ? null : await loadScheduledForecast(id);
  const t = await getTranslations({ locale, namespace: "public.event" });
  const subject = event?.pick ?? scheduled;
  const title = subject ? `${subject.home} — ${subject.away}` : t("missing");
  const description = subject ? t("meta", { home: subject.home, away: subject.away, league: subject.league }) : t("missing");
  return {
    title,
    ...socialMetadata({ locale, path: `/events/${id}`, title, description }),
  };
}

export default async function EventPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const event = await loadPublicEvent(id);
  if (!event) {
    const scheduled = await loadScheduledForecast(id);
    if (!scheduled) notFound();
    return <ScheduledScreen locale={locale} match={scheduled} />;
  }
  const [t, home, nav] = await Promise.all([
    getTranslations({ locale, namespace: "public.event" }),
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "public.nav" }),
  ]);
  const name = `${event.pick.home} — ${event.pick.away}`;
  const description = t("meta", { home: event.pick.home, away: event.pick.away, league: event.pick.league });
  const startDate = event.pick.commenceTime;
  return (
    <>
      <JsonLd
          data={pageJsonLd({
            locale,
            path: `/events/${id}`,
            name,
            description,
            siteDescription: home("description"),
            crumbs: [
              { name: nav("home"), path: "/" },
              { name: nav("forecasts"), path: "/forecasts" },
              { name, path: `/events/${id}` },
            ],
            extra: startDate
              ? [
                  sportsEventNode({
                    name,
                    description,
                    url: absoluteUrl(locale, `/events/${id}`),
                    startDate,
                    league: event.pick.league,
                    home: event.pick.home,
                    away: event.pick.away,
                  }),
                ]
              : [],
          })}
        />
      <EventScreen locale={locale} event={event} />
    </>
  );
}
