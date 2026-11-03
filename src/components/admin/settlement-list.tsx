"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { settlePredictionAction } from "@/server/admin/actions";
import type { SettlementCandidate } from "@/server/admin/types";
import { useFormatter, useTranslations } from "next-intl";

export function SettlementList({ candidates }: { candidates: SettlementCandidate[] }) {
  const t = useTranslations("admin.settlement");
  const te = useTranslations("admin.errors");
  const markets = useTranslations("admin.markets");
  const selections = useTranslations("admin.selections");
  const format = useFormatter();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  async function settle(candidate: SettlementCandidate, formData: FormData) {
    const status = String(formData.get("status"));
    if (status !== "won" && status !== "lost" && status !== "void") return;
    setPendingId(candidate.predictionId);
    const result = await settlePredictionAction({
      predictionId: candidate.predictionId,
      status,
      comment: String(formData.get("comment") ?? ""),
    });
    setMessages((current) => ({
      ...current,
      [candidate.predictionId]: result.ok
        ? t("saved", { profit: format.number(result.profitUnits, { maximumFractionDigits: 2, signDisplay: "exceptZero" }) })
        : te(result.error),
    }));
    setPendingId(null);
    if (result.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {candidates.map((candidate) => (
        <form
          key={candidate.predictionId}
          className="rounded-xl border p-4"
          action={(formData) => settle(candidate, formData)}
        >
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              {candidate.home} — {candidate.away}
            </p>
            <p className="text-sm text-muted-foreground">
              {format.dateTime(new Date(candidate.commenceTime), { dateStyle: "medium", timeStyle: "short" })}
              {" · "}
              {markets(candidate.market as "h2h" | "totals")}
              {" · "}
              {selections(candidate.selection as "home" | "draw" | "away" | "over" | "under")}
              {candidate.point != null ? ` ${candidate.point}` : ""}
              {" · "}
              {format.number(candidate.price, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t("result")}</span>
              <select name="status" defaultValue="won" className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="won">{t("won")}</option>
                <option value="lost">{t("lost")}</option>
                <option value="void">{t("void")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t("comment")}</span>
              <textarea
                name="comment"
                required
                minLength={10}
                maxLength={500}
                className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <Button type="submit" disabled={pendingId === candidate.predictionId}>
              {pendingId === candidate.predictionId ? t("saving") : t("save")}
            </Button>
          </div>
          {messages[candidate.predictionId] ? (
            <p className="mt-3 text-sm text-muted-foreground">{messages[candidate.predictionId]}</p>
          ) : null}
        </form>
      ))}
    </div>
  );
}
