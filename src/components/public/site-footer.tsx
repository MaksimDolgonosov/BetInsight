import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { telegramChannelUrl } from "@/server/site";

export async function SiteFooter({ locale }: { locale: string }) {
  const t = await getTranslations("public.home");
  const nav = await getTranslations("public.nav");
  const channelRu = telegramChannelUrl("ru");
  const channelEn = telegramChannelUrl("en");

  return (
    <footer className="flex flex-col gap-4 border-t border-[var(--bi-border)] px-4 py-7 lg:flex-row lg:items-center lg:justify-between lg:px-16">
      <p className="flex items-center gap-3 text-[13px] text-[var(--bi-text-3)]">
        <span className="rounded-[6px] bg-[var(--bi-loss)] px-1.5 py-0.5 text-[12px] font-bold text-[var(--bi-ink)]">18+</span>
        {t("footer")}
      </p>
      <div className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[13px] text-[var(--bi-text-2)]">
        <Link href="/forecasts">{nav("forecasts")}</Link>
        <Link href="/stats">{nav("stats")}</Link>
        <Link href="/methodology">{nav("method")}</Link>
        <a href={`/${locale}/stats/csv`}>{t("csvExport")}</a>
        {channelRu ? <a href={channelRu}>{t("telegramRu")}</a> : <span>{t("telegramRu")}</span>}
        {channelEn ? <a href={channelEn}>{t("telegramEn")}</a> : <span>{t("telegramEn")}</span>}
      </div>
    </footer>
  );
}
