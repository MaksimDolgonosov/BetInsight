export type SettlementStatus = "won" | "lost" | "void";

export type SettlementError = "not_found" | "not_eligible" | "already_settled" | "comment" | "not_started";

export function profitUnits(status: SettlementStatus, price: number): number {
  if (status === "won") return roundUnits(price - 1);
  if (status === "lost") return -1;
  return 0;
}

export function decideSettlement(input: {
  prediction: { status: string; price: number } | null;
  event: { missingFromScores: boolean; commenceTime: string } | null;
  nextStatus: SettlementStatus;
  comment: string;
  now: Date;
}):
  | { ok: true; profitUnits: number; comment: string }
  | { ok: false; error: SettlementError } {
  if (!input.prediction || !input.event) {
    return { ok: false, error: "not_found" };
  }
  if (input.prediction.status !== "pending") {
    return { ok: false, error: "already_settled" };
  }
  if (!input.event.missingFromScores) {
    return { ok: false, error: "not_eligible" };
  }
  if (new Date(input.event.commenceTime).getTime() > input.now.getTime()) {
    return { ok: false, error: "not_started" };
  }

  const comment = input.comment.trim();
  if (comment.length < 10 || comment.length > 500) {
    return { ok: false, error: "comment" };
  }

  return {
    ok: true,
    profitUnits: profitUnits(input.nextStatus, input.prediction.price),
    comment,
  };
}

function roundUnits(value: number): number {
  return Math.round(value * 10000) / 10000;
}
