import { Panel, Stat } from "@/components/admin/panel";
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("remaining")} value={format.number(data.snapshot.remaining)} hint={t("lastRemaining", { value: data.lastRemaining == null ? t("unknown") : format.number(data.lastRemaining) })} />
        <Stat label={t("dailyLimit")} value={format.number(data.snapshot.dailyLimit, { maximumFractionDigits: 1 })} />
        <Stat label={t("projected")} value={format.number(data.snapshot.projectedRemaining, { maximumFractionDigits: 1 })} />
        <Stat label={t("llmSpend")} value={format.number(data.llmSpend, { style: "currency", currency: "USD" })} />
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

function Integration({ label, ready, yes, no }: { label: string; ready: boolean; yes: string; no: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={ready ? "text-muted-foreground" : "text-destructive"}>{ready ? yes : no}</span>
    </li>
  );
}
