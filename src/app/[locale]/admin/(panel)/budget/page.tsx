import { BudgetChart } from "@/components/admin/budget-chart";
import { Panel, Stat } from "@/components/admin/panel";
import { loadBudget } from "@/server/admin/queries";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminBudgetPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.budget");
  const sources = await getTranslations("admin.sources");
  const format = await getFormatter();
  const data = await loadBudget();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("description")}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("used")} value={format.number(data.snapshot.used)} />
        <Stat label={t("remaining")} value={format.number(data.snapshot.remaining)} hint={t("apiRemaining", { value: data.lastRemaining == null ? t("unknown") : format.number(data.lastRemaining) })} />
        <Stat label={t("reserve")} value={format.number(data.snapshot.reserveCredits)} />
        <Stat label={t("projected")} value={format.number(data.snapshot.projectedRemaining, { maximumFractionDigits: 1 })} />
      </div>
      <Panel title={t("chartTitle")} description={t("llmSpend", { value: format.number(data.llmSpend, { style: "currency", currency: "USD" }) })}>
        <BudgetChart series={data.series} creditsLabel={t("credits")} />
      </Panel>
      <Panel title={t("usageTitle")}>
        {data.usage.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyUsage")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 font-medium">{t("createdAt")}</th>
                  <th className="px-2 py-2 font-medium">{t("endpoint")}</th>
                  <th className="px-2 py-2 font-medium">{t("cost")}</th>
                  <th className="px-2 py-2 font-medium">{t("remainingHeader")}</th>
                  <th className="px-2 py-2 font-medium">{t("source")}</th>
                </tr>
              </thead>
              <tbody>
                {data.usage.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-2 py-3 whitespace-nowrap">{format.dateTime(new Date(row.createdAt), { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="px-2 py-3">{row.endpoint}</td>
                    <td className="px-2 py-3">{format.number(row.cost)}</td>
                    <td className="px-2 py-3">{row.remaining == null ? "—" : format.number(row.remaining)}</td>
                    <td className="px-2 py-3">{sources(row.source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title={t("aiTitle")}>
        {data.aiRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyAi")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 font-medium">{t("createdAt")}</th>
                  <th className="px-2 py-2 font-medium">{t("model")}</th>
                  <th className="px-2 py-2 font-medium">{t("tokens")}</th>
                  <th className="px-2 py-2 font-medium">{t("costUsd")}</th>
                  <th className="px-2 py-2 font-medium">{t("source")}</th>
                  <th className="px-2 py-2 font-medium">{t("error")}</th>
                </tr>
              </thead>
              <tbody>
                {data.aiRequests.map((row) => (
                  <tr key={row.id} className="border-b align-top last:border-b-0">
                    <td className="px-2 py-3 whitespace-nowrap">{format.dateTime(new Date(row.createdAt), { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="px-2 py-3">
                      {row.model}
                      <span className="mt-1 block text-xs text-muted-foreground">{row.promptVersion}</span>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">{row.tokensIn ?? "—"} / {row.tokensOut ?? "—"}</td>
                    <td className="px-2 py-3">{row.costUsd == null ? "—" : format.number(row.costUsd, { style: "currency", currency: "USD", maximumFractionDigits: 4 })}</td>
                    <td className="px-2 py-3">{sources(row.source)}</td>
                    <td className="max-w-xs px-2 py-3 text-muted-foreground">{row.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
