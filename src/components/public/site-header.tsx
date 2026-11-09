import { Link } from "@/i18n/navigation";
import { Activity, Send } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function SiteHeader({ locale, active, path }: { locale: string; active: "home" | "stats"; path: string }) {
  const nav = await getTranslations("public.nav");
  const channel = process.env.TELEGRAM_CHANNEL_URL;

  return (
    <header className="flex items-center justify-between gap-6 border-b border-[var(--bi-border)] px-4 py-[18px] lg:px-16">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-[var(--bi-accent)] text-[var(--bi-ink)]">
          <Activity className="size-[18px]" />
        </span>
        <span className="font-display text-[20px] font-bold tracking-[-0.4px]">BetInsight</span>
      </Link>
      <nav className="hidden items-center gap-9 text-[14px] md:flex">
        <Link href="/" className={navClass(active === "home")}>{nav("home")}</Link>
        <span className={navClass(false)}>{nav("forecasts")}</span>
        <Link href="/stats" className={navClass(active === "stats")}>{nav("stats")}</Link>
        <span className={navClass(false)}>{nav("method")}</span>
      </nav>
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border border-[var(--bi-border)] bg-[var(--bi-surface)] p-1">
          <Link href={path} locale="ru" className={localePill(locale === "ru")}>RU</Link>
          <Link href={path} locale="en" className={localePill(locale === "en")}>EN</Link>
        </div>
        {channel ? (
          <a href={channel} className="inline-flex items-center gap-2 rounded-full bg-[var(--bi-accent)] px-4 py-2.5 text-[14px] font-semibold text-[var(--bi-ink)]">
            <Send className="size-4" />
            {nav("telegram")}
          </a>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--bi-accent)] px-4 py-2.5 text-[14px] font-semibold text-[var(--bi-ink)]">
            <Send className="size-4" />
            {nav("telegram")}
          </span>
        )}
      </div>
    </header>
  );
}

function navClass(active: boolean) {
  return active ? "font-semibold text-[var(--bi-text)]" : "font-medium text-[var(--bi-text-2)]";
}

function localePill(active: boolean) {
  return `rounded-full px-2.5 py-1 font-stat text-[12px] font-semibold ${active ? "bg-[var(--bi-tab)] text-[var(--bi-text)]" : "text-[var(--bi-text-3)]"}`;
}
