"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { restartJobAction } from "@/server/admin/actions";
import type { JobRunRecord } from "@/server/admin/types";
import { useFormatter, useTranslations } from "next-intl";

export function JobsTable({ jobs }: { jobs: JobRunRecord[] }) {
  const t = useTranslations("admin.jobs");
  const te = useTranslations("admin.errors");
  const status = useTranslations("admin.status");
  const format = useFormatter();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function restart(id: string) {
    setPendingId(id);
    setMessage(null);
    const result = await restartJobAction(id);
    setMessage(result.ok ? t("restarted") : te(result.error));
    setPendingId(null);
    if (result.ok) router.refresh();
  }

  if (jobs.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-2 py-2 font-medium">{t("job")}</th>
              <th className="px-2 py-2 font-medium">{t("status")}</th>
              <th className="px-2 py-2 font-medium">{t("started")}</th>
              <th className="px-2 py-2 font-medium">{t("finished")}</th>
              <th className="px-2 py-2 font-medium">{t("error")}</th>
              <th className="px-2 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b align-top last:border-b-0">
                <td className="px-2 py-3">
                  <span className="font-medium">{job.job}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{job.idempotencyKey}</span>
                </td>
                <td className="px-2 py-3">
                  <span className={job.status === "failed" ? "text-destructive" : undefined}>{status(job.status)}</span>
                </td>
                <td className="px-2 py-3 whitespace-nowrap">{formatTime(format, job.startedAt)}</td>
                <td className="px-2 py-3 whitespace-nowrap">{formatTime(format, job.finishedAt)}</td>
                <td className="max-w-xs px-2 py-3 text-muted-foreground">{job.error ?? "—"}</td>
                <td className="px-2 py-3 text-right">
                  {job.status === "failed" ? (
                    <Button type="button" variant="outline" size="sm" disabled={pendingId === job.id} onClick={() => restart(job.id)}>
                      {pendingId === job.id ? t("restarting") : t("restart")}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatTime(format: ReturnType<typeof useFormatter>, value: string | null) {
  if (!value) return "—";
  return format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });
}
