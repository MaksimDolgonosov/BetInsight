import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { socialMetadata } from "@/server/seo";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "admin.meta" });
  const title = t("title");
  const description = t("description");

  return {
    title: { absolute: title },
    ...socialMetadata({ locale, path: "/admin", title, description, index: false, card: "summary" }),
  };
}

export default async function AdminLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return props.children;
}
