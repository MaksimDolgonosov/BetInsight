import { HomeScreen } from "@/components/public/home-screen";
import { loadPublicBoard } from "@/server/stats/load";
import { setRequestLocale } from "next-intl/server";

export default async function HomePage(props: PageProps<"/[locale]">) {
  const { locale } = await props.params;
  const query = await props.searchParams;
  setRequestLocale(locale);
  const value = Array.isArray(query.range) ? query.range[0] : query.range;
  const range = value === "30" || value === "90" ? value : "all";
  return <HomeScreen locale={locale} board={await loadPublicBoard()} range={range} />;
}
