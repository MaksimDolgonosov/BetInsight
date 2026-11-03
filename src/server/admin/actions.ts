"use server";

import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { adminConfigured, getAdminStore } from "@/server/admin/store";
import { parseSettingsForm, type SettingsError } from "@/server/domain/settings";
import type { SettlementError, SettlementStatus } from "@/server/domain/settlement/profit";
import { enqueueJob } from "@/server/integrations/qstash/enqueue";
import { requireAdmin, signIn, signOut } from "@/server/auth";

export type LoginState = { error: "invalid_credentials" | "not_configured" } | null;
export type SettingsState = { ok: true } | { ok: false; error: SettingsError | "unauthorized" } | null;
export type ActionError = "unauthorized" | "not_failed" | "unknown_job" | "scheduler_unconfigured" | "publish_failed" | SettlementError;

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  if (!adminConfigured()) return { error: "not_configured" };

  const locale = String(formData.get("locale") ?? "en");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: `/${locale === "ru" ? "ru" : "en"}/admin`,
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "invalid_credentials" };
    throw error;
  }

  return null;
}

export async function signOutAction() {
  const locale = await getLocale();
  await signOut({ redirectTo: `/${locale}/admin/login` });
}

export async function saveSettingsAction(
  _state: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await requireAdmin();
  if (!session?.user?.email) return { ok: false, error: "unauthorized" };

  const store = getAdminStore();
  const current = await store.getSettings();
  const parsed = parseSettingsForm(formData, current);
  if (!parsed.ok) return parsed;

  await store.saveSettings(parsed.settings, session.user.email);
  revalidatePath("/ru/admin", "layout");
  revalidatePath("/en/admin", "layout");
  return { ok: true };
}

export async function restartJobAction(
  jobRunId: string,
): Promise<{ ok: true } | { ok: false; error: ActionError }> {
  const session = await requireAdmin();
  if (!session?.user?.email) return { ok: false, error: "unauthorized" };

  const store = getAdminStore();
  const job = await store.getJobRun(jobRunId);
  if (!job || job.status !== "failed") return { ok: false, error: "not_failed" };

  const queued = await enqueueJob(job.job, job.payload);
  await store.recordAudit({
    actor: session.user.email,
    action: queued.ok ? "job.restart" : "job.restart_failed",
    entity: job.id,
    payload: queued.ok ? { messageId: queued.messageId, job: job.job } : { reason: queued.reason, job: job.job },
  });
  if (!queued.ok) return { ok: false, error: queued.reason };
  return { ok: true };
}

export async function settlePredictionAction(input: {
  predictionId: string;
  status: SettlementStatus;
  comment: string;
}): Promise<{ ok: true; profitUnits: number } | { ok: false; error: ActionError }> {
  const session = await requireAdmin();
  if (!session?.user?.email) return { ok: false, error: "unauthorized" };
  if (input.status !== "won" && input.status !== "lost" && input.status !== "void") {
    return { ok: false, error: "not_found" };
  }

  return getAdminStore().settlePrediction({
    predictionId: input.predictionId,
    status: input.status,
    comment: input.comment,
    actor: session.user.email,
    now: new Date(),
  });
}
