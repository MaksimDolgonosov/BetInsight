"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/server/admin/actions";
import { useTranslations } from "next-intl";

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations("admin.login");
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t("email")}</span>
        <Input name="email" type="email" autoComplete="username" required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t("password")}</span>
        <Input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error ? <p className="text-sm text-destructive">{t(state.error)}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
