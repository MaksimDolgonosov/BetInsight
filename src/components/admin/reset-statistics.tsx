"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resetStatisticsAction } from "@/server/admin/actions";
import { useFormatter, useTranslations } from "next-intl";

export function ResetStatistics({
  startedAt,
  predictions,
  archivedPredictions,
}: {
  startedAt: string | null;
  predictions: number;
  archivedPredictions: number;
}) {
  const t = useTranslations("admin.overview");
  const te = useTranslations("admin.errors");
  const format = useFormatter();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setPending(true);
    setError(null);
    const result = await resetStatisticsAction();
    setPending(false);
    if (!result.ok) {
      setError(te(result.error));
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {startedAt
          ? t("epochSince", { date: format.dateTime(new Date(startedAt), { dateStyle: "medium", timeStyle: "short" }) })
          : t("epochAll")}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("epochCounts", { current: format.number(predictions), archived: format.number(archivedPredictions) })}
      </p>
      {confirming ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">{t("resetConfirm")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" disabled={pending} onClick={reset}>
              {pending ? t("resetPending") : t("resetSubmit")}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
              {t("resetCancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
          {t("reset")}
        </Button>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
