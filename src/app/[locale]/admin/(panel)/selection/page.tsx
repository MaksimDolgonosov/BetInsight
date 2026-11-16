import { SelectionEditor } from "@/components/admin/selection-editor";
import { getAdminStore } from "@/server/admin/store";
import { LEAGUE_CATALOG } from "@/server/domain/settings";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminSelectionPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.selection");
  const store = getAdminStore();
  const [teams, rivalries] = await Promise.all([store.listTeamMeta(), store.listRivalries()]);
  const known = new Map(LEAGUE_CATALOG.map((league) => [league.key, league.title]));
  for (const row of [...teams.map((item) => item.leagueKey), ...rivalries.map((item) => item.sportKey)]) {
    if (!known.has(row)) known.set(row, row);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("description")}</p>
      </header>
      <SelectionEditor
        leagues={[...known.entries()].map(([key, title]) => ({ key, title }))}
        teams={teams}
        rivalries={rivalries}
      />
    </div>
  );
}
