"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/admin/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteRivalryAction,
  deleteTeamMetaAction,
  saveRivalryAction,
  saveTeamMetaAction,
  type ReferenceState,
} from "@/server/admin/actions";
import type { RivalryInput, TeamMetaInput } from "@/server/domain/selection/reference";
import { useTranslations } from "next-intl";

type LeagueOption = { key: string; title: string };

export function SelectionEditor({
  leagues,
  teams,
  rivalries,
}: {
  leagues: LeagueOption[];
  teams: TeamMetaInput[];
  rivalries: RivalryInput[];
}) {
  const t = useTranslations("admin.selection");

  return (
    <div className="flex flex-col gap-6">
      <Panel title={t("teamsTitle")} description={t("teamsDescription")}>
        <TeamForm leagues={leagues} />
        {teams.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("emptyTeams")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 font-medium">{t("team")}</th>
                  <th className="px-2 py-2 font-medium">{t("league")}</th>
                  <th className="px-2 py-2 font-medium">{t("rank")}</th>
                  <th className="px-2 py-2 font-medium">{t("relegation")}</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {teams.map((row) => (
                  <tr key={`${row.leagueKey}:${row.teamName}`} className="border-b last:border-b-0">
                    <td className="px-2 py-3">{row.teamName}</td>
                    <td className="px-2 py-3">{leagueTitle(leagues, row.leagueKey)}</td>
                    <td className="px-2 py-3">{row.tableRank ?? "—"}</td>
                    <td className="px-2 py-3">{row.isRelegation ? t("yes") : t("no")}</td>
                    <td className="px-2 py-3 text-right">
                      <DeleteForm action={deleteTeamMetaAction} fields={{ teamName: row.teamName, leagueKey: row.leagueKey }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={t("rivalriesTitle")} description={t("rivalriesDescription")}>
        <RivalryForm leagues={leagues} />
        {rivalries.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("emptyRivalries")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2 font-medium">{t("league")}</th>
                  <th className="px-2 py-2 font-medium">{t("pair")}</th>
                  <th className="px-2 py-2 font-medium">{t("label")}</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rivalries.map((row) => (
                  <tr key={`${row.sportKey}:${row.teamA}:${row.teamB}`} className="border-b last:border-b-0">
                    <td className="px-2 py-3">{leagueTitle(leagues, row.sportKey)}</td>
                    <td className="px-2 py-3">{row.teamA} — {row.teamB}</td>
                    <td className="px-2 py-3">{row.label ?? "—"}</td>
                    <td className="px-2 py-3 text-right">
                      <DeleteForm
                        action={deleteRivalryAction}
                        fields={{ sportKey: row.sportKey, teamA: row.teamA, teamB: row.teamB }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function TeamForm({ leagues }: { leagues: LeagueOption[] }) {
  const t = useTranslations("admin.selection");
  const te = useTranslations("admin.errors");
  const [state, action, pending] = useSavedForm(saveTeamMetaAction);

  return (
    <form action={action} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <SelectField label={t("league")} name="leagueKey" leagues={leagues} />
      <TextField label={t("team")} name="teamName" required />
      <TextField label={t("rank")} name="tableRank" type="number" />
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input className="size-4" type="checkbox" name="relegation" />
        {t("relegation")}
      </label>
      <div className="md:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={pending}>{pending ? t("saving") : t("addTeam")}</Button>
        <FormNote state={state} saved={t("saved")} invalid={te("invalid")} />
      </div>
    </form>
  );
}

function RivalryForm({ leagues }: { leagues: LeagueOption[] }) {
  const t = useTranslations("admin.selection");
  const te = useTranslations("admin.errors");
  const [state, action, pending] = useSavedForm(saveRivalryAction);

  return (
    <form action={action} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <SelectField label={t("league")} name="sportKey" leagues={leagues} />
      <TextField label={t("teamA")} name="teamA" required />
      <TextField label={t("teamB")} name="teamB" required />
      <TextField label={t("label")} name="label" />
      <div className="md:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={pending}>{pending ? t("saving") : t("addRivalry")}</Button>
        <FormNote state={state} saved={t("saved")} invalid={te("invalid")} />
      </div>
    </form>
  );
}

function DeleteForm({
  action,
  fields,
}: {
  action: (state: ReferenceState, formData: FormData) => Promise<ReferenceState>;
  fields: Record<string, string>;
}) {
  const t = useTranslations("admin.selection");
  const [state, formAction, pending] = useSavedForm(action);
  return (
    <form action={formAction}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" variant="outline" disabled={pending}>{pending ? t("saving") : t("remove")}</Button>
      {state?.ok === false ? <span className="ml-2 text-xs text-destructive">{t("removeFailed")}</span> : null}
    </form>
  );
}

function SelectField({ label, name, leagues }: { label: string; name: string; leagues: LeagueOption[] }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select name={name} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" required defaultValue={leagues[0]?.key ?? ""}>
        {leagues.map((league) => (
          <option key={league.key} value={league.key}>{league.title}</option>
        ))}
      </select>
    </label>
  );
}

function TextField({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <Input name={name} type={type} min={type === "number" ? 1 : undefined} max={type === "number" ? 40 : undefined} required={required} />
    </label>
  );
}

function FormNote({ state, saved, invalid }: { state: ReferenceState; saved: string; invalid: string }) {
  if (state?.ok === true) return <p className="mt-3 text-sm text-muted-foreground">{saved}</p>;
  if (state?.ok === false) return <p className="mt-3 text-sm text-destructive">{invalid}</p>;
  return null;
}

function useSavedForm(action: (state: ReferenceState, formData: FormData) => Promise<ReferenceState>) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [router, state]);
  return [state, formAction, pending] as const;
}

function leagueTitle(leagues: LeagueOption[], key: string) {
  return leagues.find((league) => league.key === key)?.title ?? key;
}
