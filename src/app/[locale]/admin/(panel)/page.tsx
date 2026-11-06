import { Panel } from "@/components/admin/panel";
import { ResetStatistics } from "@/components/admin/reset-statistics";
import { CreditSpendCard, LlmSpendCard } from "@/components/admin/spend-cards";
import { loadOverview } from "@/server/admin/queries";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminOverviewPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.overview");
  const status = await getTranslations("admin.status");
  const format = await getFormatter();
  const data = await loadOverview();
  const enabled = data.settings.leagues.filter((league) => league.enabled).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("description")}</p>
      </header>
      <Panel title={t("statsTitle")} description={t("statsDescription")}>
        <ResetStatistics
          startedAt={data.statsEpoch.startedAt}
          predictions={data.statsEpoch.predictions}
          archivedPredictions={data.statsEpoch.archivedPredictions}
        />
      </Panel>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <CreditSpendCard
          title={t("creditsTitle")}
          source={data.credits.fromApi ? t("creditsSource") : t("creditsFallback")}
          remaining={format.number(data.credits.remaining)}
          ofLimit={t("ofLimit", { limit: format.number(data.snapshot.monthlyLimit) })}
          spent={t("spent", { value: format.number(data.credits.spent) })}
          free={t("free", { value: format.number(data.credits.free) })}
          reserve={t("reserve", { value: format.number(data.credits.reserve) })}
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
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("leagues")}>
          <p className="text-sm text-muted-foreground">{t("leaguesCount", { enabled, total: data.settings.leagues.length })}</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {data.settings.leagues.map((league) => (
              <li key={league.key} className="flex items-center justify-between gap-3">
                <span>{league.title}</span>
                <span className="text-muted-foreground">{league.enabled ? t("enabled") : t("disabled")}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("integrations")}>
          <ul className="flex flex-col gap-2 text-sm">
            <Integration label={t("odds")} ready={data.integrations.odds} yes={t("configured")} no={t("missing")} />
            <Integration label={t("openrouter")} ready={data.integrations.openrouter} yes={t("configured")} no={t("missing")} />
            <Integration label={t("qstash")} ready={data.integrations.qstash} yes={t("configured")} no={t("missing")} />
            <Integration label={t("redis")} ready={data.integrations.redis} yes={t("configured")} no={t("missing")} />
            <Integration label={t("postgres")} ready={data.integrations.postgres} yes={t("configured")} no={t("missing")} />
          </ul>
        </Panel>
      </div>
      <Panel title={t("recentJobs")} description={t("failedJobs", { count: data.failedJobs })}>
        {data.jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noJobs")}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {data.jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-3">
                <span>{job.job}</span>
                <span className={job.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{status(job.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function modelLabel(model: string) {
  const name = model.split("/").at(-1) ?? model;
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}

function Integration({ label, ready, yes, no }: { label: string; ready: boolean; yes: string; no: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={ready ? "text-muted-foreground" : "text-destructive"}>{ready ? yes : no}</span>
    </li>
  );
}
