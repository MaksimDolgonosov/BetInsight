import type { Metadata } from "next";
import { Forecasts } from "@/components/public/forecasts";
import { languageAlternates } from "@/server/site";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "public.forecasts" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: languageAlternates(locale, "/forecasts"),
  };
}

export default async function ForecastsPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  return <Forecasts locale={locale} query={await props.searchParams} />;
}
