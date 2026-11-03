import { AdminShell } from "@/components/admin/shell";
import { redirect } from "@/i18n/navigation";
import { getAdminStore } from "@/server/admin/store";
import { requireAdmin } from "@/server/auth";
import { setRequestLocale } from "next-intl/server";

export default async function AdminPanelLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const session = await requireAdmin();
  if (!session) redirect({ href: "/admin/login", locale });

  return <AdminShell mode={getAdminStore().mode}>{props.children}</AdminShell>;
}
