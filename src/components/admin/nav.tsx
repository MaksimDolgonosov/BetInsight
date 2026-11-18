"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

const links = [
  { href: "/admin", key: "overview" },
  { href: "/admin/settings", key: "settings" },
  { href: "/admin/tracks", key: "tracks" },
  { href: "/admin/budget", key: "budget" },
  { href: "/admin/jobs", key: "jobs" },
  { href: "/admin/settlement", key: "settlement" },
  { href: "/admin/test", key: "test" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations("admin.nav");

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3 md:pb-6">
      {links.map((link) => {
        const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t(link.key)}
          </Link>
        );
      })}
      <Link href="/" className="rounded-lg px-3 py-2 text-sm whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground">
        {t("site")}
      </Link>
    </nav>
  );
}
