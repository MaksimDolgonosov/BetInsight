import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventScreen } from "@/components/public/event-screen";
import { JsonLd } from "@/components/public/json-ld";
import { absoluteUrl, pageJsonLd, socialMetadata, sportsEventNode } from "@/server/seo";
import { loadPublicEvent } from "@/server/stats/load";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await props.params;
  const event = await loadPublicEvent(id);
  const t = await getTranslations({ locale, namespace: "public.event" });
  const title = event ? `${event.pick.home} — ${event.pick.away}` : t("missing");
  const description = event ? t("meta", { home: event.pick.home, away: event.pick.away, league: event.pick.league }) : t("missing");
  return {
    title,
    ...socialMetadata({ locale, path: `/events/${id}`, title, description }),
  };
}

export default async function EventPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const event = await loadPublicEvent(id);
  if (!event) notFound();
  const [t, home, nav] = await Promise.all([
    getTranslations({ locale, namespace: "public.event" }),
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "public.nav" }),
  ]);
  const name = `${event.pick.home} — ${event.pick.away}`;
  const description = t("meta", { home: event.pick.home, away: event.pick.away, league: event.pick.league });
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
            extra: [
              sportsEventNode({
                name,
                description,
                url: absoluteUrl(locale, `/events/${id}`),
                startDate: event.pick.commenceTime,
                league: event.pick.league,
                home: event.pick.home,
                away: event.pick.away,
              }),
            ],
          })}
        />
      <EventScreen locale={locale} event={event} />
    </>
  );
}
