import { Link } from "@/i18n/navigation";
import { Activity, Send } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { telegramChannelUrl } from "@/server/site";

export async function SiteHeader({ locale, active, path }: { locale: string; active: "home" | "forecasts" | "stats" | "method"; path: string }) {
  const nav = await getTranslations("public.nav");
  const channel = telegramChannelUrl(locale);

  return (
    <header className="flex flex-col border-b border-[var(--bi-border)]">
      <div className="flex items-center justify-between gap-6 px-4 py-[18px] lg:px-16">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-[var(--bi-accent)] text-[var(--bi-ink)]">
          <Activity className="size-[18px]" />
        </span>
        <span className="font-display text-[20px] font-bold tracking-[-0.4px]">BetInsight</span>
      </Link>
      <nav className="hidden items-center gap-9 text-[14px] md:flex">
        <Link href="/" className={navClass(active === "home")}>{nav("home")}</Link>
        <Link href="/forecasts" className={navClass(active === "forecasts")}>{nav("forecasts")}</Link>
        <Link href="/stats" className={navClass(active === "stats")}>{nav("stats")}</Link>
        <Link href="/methodology" className={navClass(active === "method")}>{nav("method")}</Link>
      </nav>
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border border-[var(--bi-border)] bg-[var(--bi-surface)] p-1">
          <Link href={path} locale="ru" className={localePill(locale === "ru")}>RU</Link>
          <Link href={path} locale="en" className={localePill(locale === "en")}>EN</Link>
        </div>
        {channel ? (
          <a href={channel} aria-label={nav("telegram")} className="inline-flex items-center gap-2 rounded-full bg-[var(--bi-accent)] px-4 py-2.5 text-[14px] font-semibold text-[var(--bi-ink)]">
            <Send className="size-4" />
            <TelegramLabel full={nav("telegram")} short={nav("telegramShort")} />
          </a>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--bi-accent)] px-4 py-2.5 text-[14px] font-semibold text-[var(--bi-ink)]">
            <Send className="size-4" />
            <TelegramLabel full={nav("telegram")} short={nav("telegramShort")} />
          </span>
        )}
      </div>
      </div>
      <nav className="flex gap-5 overflow-x-auto px-4 pb-3 text-[14px] md:hidden">
        <Link href="/" className={navClass(active === "home")}>{nav("home")}</Link>
        <Link href="/forecasts" className={navClass(active === "forecasts")}>{nav("forecasts")}</Link>
        <Link href="/stats" className={navClass(active === "stats")}>{nav("stats")}</Link>
        <Link href="/methodology" className={navClass(active === "method")}>{nav("method")}</Link>
      </nav>
    </header>
  );
}

function TelegramLabel({ full, short }: { full: string; short: string }) {
  return (
    <>
      <span className="hidden min-[451px]:inline">{full}</span>
      <span className="hidden min-[410px]:inline min-[451px]:hidden">{short}</span>
    </>
  );
}

function navClass(active: boolean) {
  return active ? "font-semibold text-[var(--bi-text)]" : "font-medium text-[var(--bi-text-2)]";
}

function localePill(active: boolean) {
  return `rounded-full px-2.5 py-1 font-stat text-[12px] font-semibold ${active ? "bg-[var(--bi-tab)] text-[var(--bi-text)]" : "text-[var(--bi-text-3)]"}`;
}
