import { LocaleSwitcher } from "@/components/locale-switcher";
import { AdminNav } from "@/components/admin/nav";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/server/admin/actions";
import { getTranslations } from "next-intl/server";

export async function AdminShell({
  mode,
  children,
}: {
  mode: "postgres" | "file";
  children: React.ReactNode;
}) {
  const t = await getTranslations("admin");

  return (
    <div className="flex min-h-full flex-1 flex-col md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b bg-sidebar text-sidebar-foreground md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:block">
          <div>
            <p className="text-sm font-semibold tracking-tight">BetInsight</p>
            <p className="text-xs text-muted-foreground">{t("shell.badge")}</p>
          </div>
          <div className="flex items-center gap-2 md:mt-4">
            <LocaleSwitcher />
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                {t("shell.signOut")}
              </Button>
            </form>
          </div>
        </div>
        <AdminNav />
      </aside>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        {mode === "file" ? (
          <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("storage.file")}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
