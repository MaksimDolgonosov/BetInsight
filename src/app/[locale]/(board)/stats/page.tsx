import type { Metadata } from "next";
import { Statistics } from "@/components/public/statistics";
import { languageAlternates } from "@/server/site";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "public.stats" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: languageAlternates(locale, "/stats"),
  };
}

export default async function StatsPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const query = await props.searchParams;
  return <Statistics locale={locale} query={query} />;
}
