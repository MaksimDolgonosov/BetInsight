import { LocaleSwitcher } from "@/components/locale-switcher";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function HomePage(props: PageProps<"/[locale]">) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex justify-end">
        <LocaleSwitcher />
      </header>
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("description")}</p>
        <p className="text-sm text-muted-foreground">{t("disclaimer")}</p>
      </div>
    </main>
  );
}
