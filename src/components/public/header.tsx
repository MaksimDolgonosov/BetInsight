import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export async function PublicHeader() {
  const t = await getTranslations("public.nav");

  return (
    <header className="flex items-center justify-between gap-4">
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/" className="font-semibold tracking-tight">
          BetInsight
        </Link>
        <Link href="/stats" className="text-muted-foreground hover:text-foreground">
          {t("stats")}
        </Link>
      </nav>
      <LocaleSwitcher />
    </header>
  );
}
