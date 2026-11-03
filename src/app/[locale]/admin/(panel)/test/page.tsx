import { TestRunner } from "@/components/admin/test-runner";
import { loadTestPage } from "@/server/admin/queries";
import { getTimeZone, getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminTestPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.test");
  const data = await loadTestPage();
  const timeZone = await getTimeZone();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("description")}</p>
      </header>
      {data.leagues.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noLeagues")}</p>
      ) : (
        <TestRunner
          leagues={data.leagues.map((league) => ({ key: league.key, title: league.title }))}
          markets={data.markets}
          region={data.region}
          mocked={data.mocked}
          remaining={data.remaining}
          reserve={data.reserve}
          lastRemaining={data.lastRemaining}
          timeZone={timeZone}
        />
      )}
    </div>
  );
}
