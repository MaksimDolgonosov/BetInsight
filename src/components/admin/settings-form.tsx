"use client";

import { useActionState } from "react";
import { Panel } from "@/components/admin/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSettingsAction } from "@/server/admin/actions";
import { MARKETS, SPORT_GROUPS, type AdminSettings, type SportGroup } from "@/server/domain/settings";
import { useTranslations } from "next-intl";

const groups: SportGroup[] = [...SPORT_GROUPS];

export function SettingsForm({ settings }: { settings: AdminSettings }) {
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
              {groups.map((group) => (
                <option key={group} value={group}>
                  {t(group)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Panel>

      <Panel title={t("marketsTitle")} description={t("marketsDescription")}>
        <div className="flex flex-wrap gap-4">
          {MARKETS.map((market) => (
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

      <Panel title={t("modelTitle")} description={t("modelDescription")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("monthlyLimit")}>
            <Input name="monthlyCreditLimit" type="number" min="1" step="1" defaultValue={settings.monthlyCreditLimit} required />
          </Field>
          <Field label={t("reserve")} hint={t("reserveHint")}>
            <Input name="reserveCredits" type="number" min="0" step="1" defaultValue={settings.reserveCredits} required />
          </Field>
          <Field label={t("testRuns")} hint={t("testRunsHint")}>
            <Input name="testRunsPerDay" type="number" min="1" max="24" step="1" defaultValue={settings.testRunsPerDay} required />
          </Field>
          <Field label={t("webSearchLimit")} hint={t("webSearchLimitHint")}>
            <Input name="webSearchDailyLimit" type="number" min="0" max="100" step="1" defaultValue={settings.webSearchDailyLimit} required />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input className="size-4" type="checkbox" name="webSearchEnabled" defaultChecked={settings.webSearchEnabled} />
          {t("webSearch")}
        </label>
      </Panel>

      <Panel title={t("aiPickTitle")} description={t("aiPickDescription")}>
        <label className="flex items-center gap-2 text-sm">
          <input className="size-4" type="checkbox" name="aiPickEnabled" defaultChecked={settings.aiPick.enabled} />
          {t("aiPickEnabled")}
        </label>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {([0, 1, 2] as const).map((index) => (
            <Field key={index} label={t("aiPickModel", { index: index + 1 })}>
              <Input name={`aiPickModel${index}`} defaultValue={settings.aiPick.models[index]} required />
            </Field>
          ))}
          <Field label={t("researchModel")} hint={t("researchModelHint")}>
            <Input name="aiPickResearchModel" defaultValue={settings.aiPick.researchModel} />
          </Field>
          <Field label={t("consensusMode")}>
            <select name="aiPickConsensusMode" defaultValue={settings.aiPick.consensusMode} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
              <option value="two_thirds">{t("twoThirds")}</option>
              <option value="unanimous">{t("unanimous")}</option>
            </select>
          </Field>
          <Field label={t("aiPickDailyLimit")} hint={t("aiPickDailyLimitHint")}>
            <Input name="aiPickDailyLimit" type="number" min="0" max="20" step="1" defaultValue={settings.aiPick.dailyLimit} required />
          </Field>
          <Field label={t("aiPickBudget")} hint={t("aiPickBudgetHint")}>
            <Input name="aiPickMonthlyBudgetUsd" type="number" min="0" max="100" step="1" defaultValue={settings.aiPick.monthlyBudgetUsd} required />
          </Field>
        </div>
      </Panel>

      <Panel title={t("selectionTitle")} description={t("selectionDescription")}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label={t("windowMin")} hint={t("windowHint")}>
            <Input name="selectionWindowMinHours" type="number" min="0" max="168" step="1" defaultValue={settings.selection.windowMinHours} required />
          </Field>
          <Field label={t("windowMax")}>
            <Input name="selectionWindowMaxHours" type="number" min="0" max="168" step="1" defaultValue={settings.selection.windowMaxHours} required />
          </Field>
          <Field label={t("probMin")} hint={t("probHint")}>
            <Input name="probMinPercent" type="number" min="1" max="99" step="1" defaultValue={Math.round(settings.selection.probMin * 100)} required />
          </Field>
          <Field label={t("probMax")}>
            <Input name="probMaxPercent" type="number" min="1" max="99" step="1" defaultValue={Math.round(settings.selection.probMax * 100)} required />
          </Field>
          <Field label={t("leagueQuota")}>
            <Input name="leagueQuota" type="number" min="1" max="8" step="1" defaultValue={settings.selection.leagueQuota} required />
          </Field>
          <Field label={t("voteWindowStart")} hint={t("voteWindowHint")}>
            <Input name="voteWindowStart" type="number" min="0" max="23" step="1" defaultValue={settings.selection.voteWindowStart} required />
          </Field>
          <Field label={t("voteWindowEnd")}>
            <Input name="voteWindowEnd" type="number" min="0" max="23" step="1" defaultValue={settings.selection.voteWindowEnd} required />
          </Field>
          <Field label={t("dataScoreThreshold")} hint={t("dataScoreHint")}>
            <Input name="dataScoreThreshold" type="number" min="1" max="10" step="1" defaultValue={settings.selection.dataScoreThreshold} required />
          </Field>
          <Field label={t("dataScoreLowConf")}>
            <Input name="dataScoreLowConf" type="number" min="1" max="10" step="1" defaultValue={settings.selection.dataScoreLowConf} required />
          </Field>
        </div>
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
