import { afterEach, describe, expect, it } from "vitest";
import { absoluteUrl, pageJsonLd, socialMetadata, sportsEventNode } from "./seo";

describe("social metadata", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("builds a distinct card for each public path", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://bet.example";
    const forecasts = socialMetadata({
      locale: "ru",
      path: "/forecasts",
      title: "Прогнозы",
      description: "Архив и предстоящие матчи.",
    });
    const stats = socialMetadata({
      locale: "en",
      path: "/stats",
      title: "Statistics",
      description: "Published results.",
    });

    expect(forecasts.openGraph).toMatchObject({
      title: "Прогнозы",
      url: "/ru/forecasts",
      locale: "ru_RU",
      alternateLocale: ["en_US"],
    });
    expect(stats.openGraph).toMatchObject({
      title: "Statistics",
      url: "/en/stats",
      locale: "en_US",
    });
    expect(forecasts.alternates).toMatchObject({ canonical: "/ru/forecasts" });
    expect(forecasts.robots).toBeUndefined();
  });

  it("keeps private pages out of the index", () => {
    const admin = socialMetadata({
      locale: "ru",
      path: "/admin",
      title: "Админка",
      description: "Закрытая панель.",
      index: false,
    });
    expect(admin.robots).toEqual({ index: false, follow: false });
    expect(admin.openGraph).toMatchObject({ url: "/ru/admin" });
  });

  it("describes the page and the match in structured data", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://bet.example";
    const graph = pageJsonLd({
      locale: "ru",
      path: "/events/abc",
      name: "Home — Away",
      description: "Прогноз зафиксирован.",
      siteDescription: "Прозрачные AI-прогнозы.",
      crumbs: [
        { name: "Главная", path: "/" },
        { name: "Прогнозы", path: "/forecasts" },
        { name: "Home — Away", path: "/events/abc" },
      ],
      extra: [
        sportsEventNode({
          name: "Home — Away",
          description: "Прогноз зафиксирован.",
          url: absoluteUrl("ru", "/events/abc"),
          startDate: "2026-11-10T18:00:00.000Z",
          league: "La Liga",
          home: "Home",
          away: "Away",
        }),
      ],
    });
    const nodes = graph["@graph"] as { "@type": string; url?: string; itemListElement?: { item: string }[] }[];
    expect(nodes.map((node) => node["@type"])).toEqual(["WebSite", "WebPage", "BreadcrumbList", "SportsEvent"]);
    expect(nodes[1]?.url).toBe("https://bet.example/ru/events/abc");
    expect(nodes[2]?.itemListElement?.map((item) => item.item)).toEqual([
      "https://bet.example/ru",
      "https://bet.example/ru/forecasts",
      "https://bet.example/ru/events/abc",
    ]);
  });
});
