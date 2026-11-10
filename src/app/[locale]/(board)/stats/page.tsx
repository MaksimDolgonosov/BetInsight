import type { Metadata } from "next";
import { Statistics } from "@/components/public/statistics";
import { JsonLd } from "@/components/public/json-ld";
import { pageJsonLd, socialMetadata } from "@/server/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "public.stats" });
  return {
    title: t("title"),
    ...socialMetadata({ locale, path: "/stats", title: t("title"), description: t("description") }),
  };
}

export default async function StatsPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const query = await props.searchParams;
  const [t, home, nav] = await Promise.all([
    getTranslations({ locale, namespace: "public.stats" }),
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "public.nav" }),
  ]);
  return (
    <>
      <JsonLd
        data={pageJsonLd({
          locale,
          path: "/stats",
          name: t("title"),
          description: t("description"),
          siteDescription: home("description"),
          crumbs: [
            { name: nav("home"), path: "/" },
            { name: nav("stats"), path: "/stats" },
          ],
        })}
      />
      <Statistics locale={locale} query={query} />
    </>
  );
}
