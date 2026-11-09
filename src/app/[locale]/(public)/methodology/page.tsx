import type { Metadata } from "next";
import { Methodology } from "@/components/public/methodology";
import { languageAlternates } from "@/server/site";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "public.method" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: languageAlternates(locale, "/methodology"),
  };
}

export default async function MethodologyPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  return <Methodology locale={locale} />;
}
