import { LoginForm } from "@/components/admin/login-form";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/server/auth";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminLoginPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const session = await auth();
  if (session?.user?.role === "admin") redirect({ href: "/admin", locale });

  const t = await getTranslations("admin.login");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <p className="text-sm font-medium text-muted-foreground">BetInsight</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="rounded-xl border bg-card p-4 md:p-6">
        <LoginForm locale={locale} />
      </div>
      <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        {t("back")}
      </Link>
    </main>
  );
}
