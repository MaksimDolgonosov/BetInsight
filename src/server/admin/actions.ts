"use server";

import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { adminConfigured, getAdminStore } from "@/server/admin/store";
import { parseRivalryInput, parseTeamMetaInput } from "@/server/domain/selection/reference";
import { parseSettingsForm, type SettingsError } from "@/server/domain/settings";
import type { SettlementError, SettlementStatus } from "@/server/domain/settlement/profit";
import { enqueueJob } from "@/server/integrations/qstash/enqueue";
import { refreshPublicBoard } from "@/server/stats/refresh";
import { requireAdmin, signIn, signOut } from "@/server/auth";

export type LoginState = { error: "invalid_credentials" | "not_configured" } | null;
export type SettingsState = { ok: true } | { ok: false; error: SettingsError | "unauthorized" } | null;
export type ActionError = "unauthorized" | "not_failed" | "unknown_job" | "scheduler_unconfigured" | "publish_failed" | SettlementError;
export type ReferenceState = { ok: true } | { ok: false; error: "unauthorized" | "invalid" } | null;

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

export async function saveTeamMetaAction(_state: ReferenceState, formData: FormData): Promise<ReferenceState> {
  const session = await requireAdmin();
  if (!session?.user?.email) return { ok: false, error: "unauthorized" };
  const parsed = parseTeamMetaInput({
    teamName: String(formData.get("teamName") ?? ""),
    sportKey: String(formData.get("sportKey") ?? ""),
    leagueKey: String(formData.get("leagueKey") ?? ""),
    tableRank: String(formData.get("tableRank") ?? ""),
    relegation: formData.get("relegation") === "on",
  });
  if (!parsed.ok) return parsed;
  await getAdminStore().saveTeamMeta(parsed.row, session.user.email);
  revalidateSelection();
  return { ok: true };
}

export async function deleteTeamMetaAction(_state: ReferenceState, formData: FormData): Promise<ReferenceState> {
  const session = await requireAdmin();
  if (!session?.user?.email) return { ok: false, error: "unauthorized" };
  const teamName = String(formData.get("teamName") ?? "").trim();
  const leagueKey = String(formData.get("leagueKey") ?? "").trim();
  if (!teamName || !leagueKey) return { ok: false, error: "invalid" };
  await getAdminStore().deleteTeamMeta({ teamName, leagueKey }, session.user.email);
  revalidateSelection();
  return { ok: true };
}

export async function saveRivalryAction(_state: ReferenceState, formData: FormData): Promise<ReferenceState> {
  const session = await requireAdmin();
  if (!session?.user?.email) return { ok: false, error: "unauthorized" };
  const parsed = parseRivalryInput({
    sportKey: String(formData.get("sportKey") ?? ""),
    teamA: String(formData.get("teamA") ?? ""),
    teamB: String(formData.get("teamB") ?? ""),
    label: String(formData.get("label") ?? ""),
  });
  if (!parsed.ok) return parsed;
  await getAdminStore().saveRivalry(parsed.row, session.user.email);
  revalidateSelection();
  return { ok: true };
}

export async function deleteRivalryAction(_state: ReferenceState, formData: FormData): Promise<ReferenceState> {
  const session = await requireAdmin();
  if (!session?.user?.email) return { ok: false, error: "unauthorized" };
  const sportKey = String(formData.get("sportKey") ?? "").trim();
  const teamA = String(formData.get("teamA") ?? "").trim();
  const teamB = String(formData.get("teamB") ?? "").trim();
  if (!sportKey || !teamA || !teamB) return { ok: false, error: "invalid" };
  await getAdminStore().deleteRivalry({ sportKey, teamA, teamB }, session.user.email);
  revalidateSelection();
  return { ok: true };
}

function revalidateSelection() {
  revalidatePath("/ru/admin/selection");
  revalidatePath("/en/admin/selection");
}

export async function resetStatisticsAction(): Promise<{ ok: true } | { ok: false; error: ActionError }> {
  const session = await requireAdmin();
  if (!session?.user?.email) return { ok: false, error: "unauthorized" };

  await getAdminStore().resetStatsEpoch({ actor: session.user.email, now: new Date() });
  refreshPublicBoard();
  revalidatePath("/ru/admin", "layout");
  revalidatePath("/en/admin", "layout");
  revalidatePath("/ru", "layout");
  revalidatePath("/en", "layout");
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
