import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { getTranslations } from "next-intl/server";

const SECTIONS = ["publish", "math", "consensus", "lock", "settle", "stats"] as const;

export async function Methodology({ locale }: { locale: string }) {
  const t = await getTranslations("public.method");
  const home = await getTranslations("public.home");
  const legal = await getTranslations("home");

  return (
    <div className="bi-stats min-h-screen">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col">
        <SiteHeader locale={locale} active="method" path="/methodology" />
        <main className="flex flex-col gap-8 px-4 py-8 lg:px-16 lg:pt-10 lg:pb-16">
          <div className="flex max-w-[760px] flex-col gap-3">
            <h1 className="font-display text-[40px] font-semibold tracking-[-1.8px] lg:text-[48px]">{t("title")}</h1>
            <p className="text-[16px] leading-7 text-[var(--bi-text-2)]">{t("lead")}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {SECTIONS.map((section, index) => (
              <article key={section} className="flex flex-col gap-3 rounded-[24px] border border-[var(--bi-border)] bg-[var(--bi-surface)] p-6">
                <span className="font-stat text-[12px] text-[var(--bi-accent)]">{String(index + 1).padStart(2, "0")}</span>
                <h2 className="font-display text-[22px] font-semibold">{t(`${section}Title`)}</h2>
                <p className="text-[14px] leading-6 text-[var(--bi-text-2)]">{t(`${section}Body`)}</p>
              </article>
            ))}
          </div>
          <p className="flex max-w-[760px] items-start gap-3 text-[14px] leading-6 text-[var(--bi-text-2)]">
            <span className="rounded-[6px] bg-[var(--bi-loss)] px-1.5 py-0.5 text-[12px] font-bold text-[var(--bi-ink)]">18+</span>
            <span>{legal("disclaimer")} {home("footer")}</span>
          </p>
        </main>
        <SiteFooter locale={locale} />
      </div>
    </div>
  );
}
