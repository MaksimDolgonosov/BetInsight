import { SettlementList } from "@/components/admin/settlement-list";
import { loadSettlement } from "@/server/admin/queries";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminSettlementPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.settlement");
  const data = await loadSettlement();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("description")}</p>
      </header>
      <SettlementList candidates={data.candidates} />
    </div>
  );
}
