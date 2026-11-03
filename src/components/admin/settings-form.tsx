"use client";

import { useActionState } from "react";
import { Panel } from "@/components/admin/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSettingsAction } from "@/server/admin/actions";
import type { AdminSettings, SportGroup } from "@/server/domain/settings";
import { useTranslations } from "next-intl";

const groups: SportGroup[] = ["soccer", "basketball"];

export function SettingsForm({
  settings,
  promptVersions,
}: {
  settings: AdminSettings;
  promptVersions: string[];
}) {
  const t = useTranslations("admin.settings");
  const te = useTranslations("admin.errors");
  const [state, action, pending] = useActionState(saveSettingsAction, null);

  return (
    <form action={action} className="flex flex-col gap-6">
      <Panel title={t("leaguesTitle")} description={t("leaguesDescription")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {settings.leagues.map((league) => (
            <label key={league.key} className="flex items-start gap-3 rounded-lg border px-3 py-3 text-sm">
              <input
                className="mt-0.5 size-4"
                type="checkbox"
                name="league"
                value={league.key}
                defaultChecked={league.enabled}
              />
              <span>
                <span className="block font-medium">{league.title}</span>
                <span className="text-xs text-muted-foreground">{league.key}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label={t("newLeagueKey")}>
            <Input name="newLeagueKey" placeholder="soccer_epl" />
          </Field>
          <Field label={t("newLeagueTitle")}>
            <Input name="newLeagueTitle" />
          </Field>
          <Field label={t("newLeagueGroup")}>
            <select name="newLeagueGroup" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" defaultValue="">
              <option value="">{t("newLeagueGroupEmpty")}</option>
              <option value="soccer">{t("soccer")}</option>
              <option value="basketball">{t("basketball")}</option>
            </select>
          </Field>
        </div>
      </Panel>

      <Panel title={t("marketsTitle")} description={t("marketsDescription")}>
        <div className="flex flex-wrap gap-4">
          {(["h2h", "totals"] as const).map((market) => (
            <label key={market} className="flex items-center gap-2 text-sm">
              <input
                className="size-4"
                type="checkbox"
                name="market"
                value={market}
                defaultChecked={settings.markets.includes(market)}
              />
              {t(market)}
            </label>
          ))}
        </div>
        <div className="mt-4 max-w-xs">
          <Field label={t("region")} hint={t("regionHint")}>
            <Input name="region" defaultValue={settings.region} required />
          </Field>
        </div>
      </Panel>

      {groups.map((group) => (
        <Panel key={group} title={t(group)} description={t("thresholdsDescription")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("evPercent")}>
              <Input name={`${group}.evPercent`} type="number" min="0.1" max="99" step="0.1" defaultValue={Number((settings.thresholds[group].evThreshold * 100).toFixed(2))} required />
            </Field>
            <Field label={t("oddsMin")}>
              <Input name={`${group}.oddsMin`} type="number" min="1.01" step="0.01" defaultValue={settings.thresholds[group].oddsMin} required />
            </Field>
            <Field label={t("oddsMax")}>
              <Input name={`${group}.oddsMax`} type="number" min="1.01" step="0.01" defaultValue={settings.thresholds[group].oddsMax} required />
            </Field>
            <Field label={t("minBookmakers")}>
              <Input name={`${group}.minBookmakers`} type="number" min="1" max="30" step="1" defaultValue={settings.thresholds[group].minBookmakers} required />
            </Field>
            <Field label={t("totalsMin")}>
              <Input name={`${group}.totalsPointMin`} type="number" min="0.5" step="0.5" defaultValue={settings.thresholds[group].totalsPointMin} required />
            </Field>
            <Field label={t("totalsMax")}>
              <Input name={`${group}.totalsPointMax`} type="number" min="0.5" step="0.5" defaultValue={settings.thresholds[group].totalsPointMax} required />
            </Field>
          </div>
        </Panel>
      ))}

      <Panel title={t("modelTitle")} description={t("modelDescription")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("llmModel")}>
            <Input name="llmModel" defaultValue={settings.llmModel} required />
          </Field>
          <Field label={t("promptVersion")}>
            <select name="promptVersion" defaultValue={settings.promptVersion} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
              {promptVersions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("monthlyLimit")}>
            <Input name="monthlyCreditLimit" type="number" min="1" step="1" defaultValue={settings.monthlyCreditLimit} required />
          </Field>
          <Field label={t("reserve")} hint={t("reserveHint")}>
            <Input name="reserveCredits" type="number" min="0" step="1" defaultValue={settings.reserveCredits} required />
          </Field>
          <Field label={t("testRuns")} hint={t("testRunsHint")}>
            <Input name="testRunsPerDay" type="number" min="1" max="24" step="1" defaultValue={settings.testRunsPerDay} required />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input className="size-4" type="checkbox" name="webSearchEnabled" defaultChecked={settings.webSearchEnabled} />
          {t("webSearch")}
        </label>
      </Panel>

      {state?.ok === false ? <p className="text-sm text-destructive">{te(state.error)}</p> : null}
      {state?.ok === true ? <p className="text-sm text-muted-foreground">{t("saved")}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
