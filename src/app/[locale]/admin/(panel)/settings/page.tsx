import { SettingsForm } from "@/components/admin/settings-form";
import { promptVersions } from "@/server/integrations/openrouter/prompt";
import { getAdminStore } from "@/server/admin/store";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminSettingsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.settings");
  const settings = await getAdminStore().getSettings();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("description")}</p>
      </header>
      <SettingsForm
        key={JSON.stringify(settings)}
        settings={settings}
        promptVersions={promptVersions()}
      />
    </div>
  );
}
