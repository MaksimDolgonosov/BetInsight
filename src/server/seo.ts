import type { Metadata } from "next";
import { languageAlternates, siteOrigin } from "@/server/site";

export function ogLocale(locale: string) {
  return locale === "ru" ? "ru_RU" : "en_US";
}

export function absoluteUrl(locale: string, path: string) {
  const suffix = path === "/" ? "" : path;
  return `${siteOrigin()}/${locale}${suffix}`;
}

export function socialMetadata(input: {
  locale: string;
  path: string;
  title: string;
  description: string;
  index?: boolean;
  card?: "summary" | "summary_large_image";
}): Metadata {
  const { locale, path, title, description, index = true, card = "summary_large_image" } = input;
  const alternates = languageAlternates(locale, path);
  return {
    description,
    alternates,
    ...(index ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      siteName: "BetInsight",
      locale: ogLocale(locale),
      alternateLocale: [locale === "ru" ? "en_US" : "ru_RU"],
      type: "website",
    },
    twitter: {
      card,
      title,
      description,
    },
  };
}

type Crumb = { name: string; path: string };

export function pageJsonLd(input: {
  locale: string;
  path: string;
  name: string;
  description: string;
  siteDescription: string;
  crumbs: Crumb[];
  extra?: Record<string, unknown>[];
}) {
  const origin = siteOrigin();
  const pageUrl = absoluteUrl(input.locale, input.path);
  const websiteId = `${origin}/#website`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "BetInsight",
        url: absoluteUrl(input.locale, "/"),
        inLanguage: input.locale,
        description: input.siteDescription,
      },
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: input.name,
        description: input.description,
        isPartOf: { "@id": websiteId },
        inLanguage: input.locale,
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: input.crumbs.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: absoluteUrl(input.locale, crumb.path),
        })),
      },
      ...(input.extra ?? []),
    ],
  };
}

export function sportsEventNode(input: {
  name: string;
  description: string;
  url: string;
  startDate: string;
  league: string;
  home: string;
  away: string;
}) {
  return {
    "@type": "SportsEvent",
    name: input.name,
    description: input.description,
    url: input.url,
    startDate: input.startDate,
    sport: input.league,
    homeTeam: { "@type": "SportsTeam", name: input.home },
    awayTeam: { "@type": "SportsTeam", name: input.away },
  };
}
