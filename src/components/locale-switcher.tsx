"use client";

import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("localeSwitcher");
  const nextLocale = locale === "ru" ? "en" : "ru";

  return (
    <Button variant="outline" asChild>
      <Link href={pathname} locale={nextLocale}>
        {t(nextLocale)}
      </Link>
    </Button>
  );
}
