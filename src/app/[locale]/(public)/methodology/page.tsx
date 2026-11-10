import type { Metadata } from "next";
import { Methodology } from "@/components/public/methodology";
import { JsonLd } from "@/components/public/json-ld";
import { pageJsonLd, socialMetadata } from "@/server/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "public.method" });
  return {
    title: t("title"),
    ...socialMetadata({ locale, path: "/methodology", title: t("title"), description: t("lead") }),
  };
}

export default async function MethodologyPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const [t, home, nav] = await Promise.all([
    getTranslations({ locale, namespace: "public.method" }),
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "public.nav" }),
  ]);
  return (
    <>
      <JsonLd
        data={pageJsonLd({
          locale,
          path: "/methodology",
          name: t("title"),
          description: t("lead"),
          siteDescription: home("description"),
          crumbs: [
            { name: nav("home"), path: "/" },
            { name: nav("method"), path: "/methodology" },
          ],
        })}
      />
      <Methodology locale={locale} />
    </>
  );
}
