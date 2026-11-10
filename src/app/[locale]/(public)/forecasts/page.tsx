import type { Metadata } from "next";
import { Forecasts } from "@/components/public/forecasts";
import { JsonLd } from "@/components/public/json-ld";
import { pageJsonLd, socialMetadata } from "@/server/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "public.forecasts" });
  return {
    title: t("title"),
    ...socialMetadata({ locale, path: "/forecasts", title: t("title"), description: t("description") }),
  };
}

export default async function ForecastsPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const [t, home, nav] = await Promise.all([
    getTranslations({ locale, namespace: "public.forecasts" }),
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "public.nav" }),
  ]);
  return (
    <>
      <JsonLd
        data={pageJsonLd({
          locale,
          path: "/forecasts",
          name: t("title"),
          description: t("description"),
          siteDescription: home("description"),
          crumbs: [
            { name: nav("home"), path: "/" },
            { name: nav("forecasts"), path: "/forecasts" },
          ],
        })}
      />
      <Forecasts locale={locale} query={await props.searchParams} />
    </>
  );
}
