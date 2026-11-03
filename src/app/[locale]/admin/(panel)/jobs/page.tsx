import { JobsTable } from "@/components/admin/jobs-table";
import { loadJobs } from "@/server/admin/queries";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminJobsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.jobs");
  const data = await loadJobs();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("description")}</p>
      </header>
      <section className="rounded-xl border bg-card p-4 md:p-6">
        <JobsTable jobs={data.jobs} />
      </section>
    </div>
  );
}
