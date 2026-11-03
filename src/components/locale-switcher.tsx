import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";

export async function LocaleSwitcher() {
  const locale = await getLocale();
  const t = await getTranslations("localeSwitcher");
  const nextLocale = locale === "ru" ? "en" : "ru";

  return (
    <Button variant="outline" asChild>
      <Link href="/" locale={nextLocale}>
        {t(nextLocale)}
      </Link>
    </Button>
  );
}
