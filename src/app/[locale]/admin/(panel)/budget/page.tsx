import { BudgetChart } from "@/components/admin/budget-chart";
import { Panel } from "@/components/admin/panel";
import { CreditSpendCard, LlmSpendCard } from "@/components/admin/spend-cards";
import { loadBudget } from "@/server/admin/queries";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminBudgetPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.budget");
  const sources = await getTranslations("admin.sources");
  const purposes = await getTranslations("admin.purposes");
  const format = await getFormatter();
  const data = await loadBudget();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("description")}</p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <CreditSpendCard
          title={t("creditsTitle")}
          source={data.credits.fromApi ? t("creditsSource") : t("creditsFallback")}
          remaining={format.number(data.credits.remaining)}
          ofLimit={t("ofLimit", { limit: format.number(data.snapshot.monthlyLimit) })}
          spent={t("spent", { value: format.number(data.credits.spent) })}
          free={t("free", { value: format.number(data.credits.free) })}
          reserve={t("reserveSegment", { value: format.number(data.credits.reserve) })}
          spentValue={data.credits.spent}
          freeValue={data.credits.free}
          reserveValue={data.credits.reserve}
          bars={data.bars}
          dailyLabel={t("dailyLimit")}
          dailyValue={format.number(data.snapshot.dailyLimit, { maximumFractionDigits: 1 })}
          todayLabel={t("today")}
          todayValue={format.number(data.todaySpent)}
          projectedLabel={t("projected")}
          projectedValue={format.number(data.snapshot.projectedRemaining, { maximumFractionDigits: 1 })}
          note={
            data.credits.fromApi && Math.abs(data.snapshot.used - data.credits.spent) >= 1
              ? t("ledgerNote", {
                  ledger: format.number(data.snapshot.used),
                  header: format.number(data.credits.spent),
                })
              : undefined
          }
        />
        <LlmSpendCard
          title={t("llmTitle")}
          model={modelLabel(data.settings.llmModel)}
          spent={format.number(data.aiPickSpend, { style: "currency", currency: "USD" })}
          ofBudget={t("llmOfBudget", {
            budget: format.number(data.settings.aiPick.monthlyBudgetUsd, { style: "currency", currency: "USD" }),
          })}
          valueNote={t("llmValue", {
            value: format.number(Math.max(0, data.llmSpend - data.aiPickSpend), { style: "currency", currency: "USD" }),
          })}
          ratio={data.settings.aiPick.monthlyBudgetUsd <= 0 ? 0 : data.aiPickSpend / data.settings.aiPick.monthlyBudgetUsd}
        />
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
                  <th className="px-2 py-2 font-medium">{t("purpose")}</th>
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
                    <td className="px-2 py-3">{purposes(row.purpose)}</td>
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

function modelLabel(model: string) {
  const name = model.split("/").at(-1) ?? model;
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}
