import { HomeScreen } from "@/components/public/home-screen";
import { JsonLd } from "@/components/public/json-ld";
import { pageJsonLd } from "@/server/seo";
import { loadPublicBoard } from "@/server/stats/load";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function HomePage(props: PageProps<"/[locale]">) {
  const { locale } = await props.params;
  const query = await props.searchParams;
  setRequestLocale(locale);
  const value = Array.isArray(query.range) ? query.range[0] : query.range;
  const range = value === "30" || value === "90" ? value : "all";
  const [home, nav] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "public.nav" }),
  ]);
  return (
    <>
      <JsonLd
        data={pageJsonLd({
          locale,
          path: "/",
          name: home("title"),
          description: home("description"),
          siteDescription: home("description"),
          crumbs: [{ name: nav("home"), path: "/" }],
        })}
      />
      <HomeScreen locale={locale} board={await loadPublicBoard()} range={range} />
    </>
  );
}
