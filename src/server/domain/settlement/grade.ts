import { profitUnits, type SettlementStatus } from "@/server/domain/settlement/profit";

export type ScoreSport = "soccer" | "basketball" | "tennis" | "other";

export type GradeAction =
  | { action: "settle"; status: SettlementStatus; profitUnits: number }
  | { action: "wait"; reason: "incomplete" | "unsupported" };

export type PendingSettlement = {
  id: string;
  sportKey: string;
  eventStatus: string;
  market: string;
  selection: string;
  point: number | null;
  price: number;
  homeScore: number | null;
  awayScore: number | null;
};

const SELECTIONS = new Set(["home", "draw", "away", "over", "under"]);

export function scoreSport(sportKey: string): ScoreSport {
  if (sportKey.startsWith("soccer")) return "soccer";
  if (sportKey.startsWith("basketball")) return "basketball";
  if (sportKey.startsWith("tennis")) return "tennis";
  return "other";
}

export function gradePrediction(input: Omit<PendingSettlement, "id">): GradeAction {
  if (input.eventStatus === "void") return settled("void", input.price);
  if (input.eventStatus !== "completed") return { action: "wait", reason: "incomplete" };
  if (!validScore(input.homeScore) || !validScore(input.awayScore)) return { action: "wait", reason: "incomplete" };
  if (!SELECTIONS.has(input.selection) || !(input.price > 1)) return { action: "wait", reason: "unsupported" };

  const sport = scoreSport(input.sportKey);
  if (sport === "other") return { action: "wait", reason: "unsupported" };
  if (input.market === "h2h") return gradeHeadToHead(sport, input.selection, input.price, input.homeScore, input.awayScore);
  if (input.market === "totals") return gradeTotal(sport, input.selection, input.point, input.price, input.homeScore, input.awayScore);
  return { action: "wait", reason: "unsupported" };
}

export function settlementsFor(rows: PendingSettlement[]): { id: string; status: SettlementStatus; profitUnits: number }[] {
  return rows.flatMap((row) => {
    const graded = gradePrediction(row);
    if (graded.action !== "settle") return [];
    return [{ id: row.id, status: graded.status, profitUnits: graded.profitUnits }];
  });
}

function gradeHeadToHead(
  sport: Exclude<ScoreSport, "other">,
  selection: string,
  price: number,
  home: number,
  away: number,
): GradeAction {
  if (sport === "basketball" && !basketballScoreReady(home, away)) return { action: "wait", reason: "incomplete" };
  if (sport === "tennis" && tennisScoreShape(home, away) === "unknown") return { action: "wait", reason: "incomplete" };
  if (selection !== "home" && selection !== "draw" && selection !== "away") return { action: "wait", reason: "unsupported" };

  const winner = home === away ? "draw" : home > away ? "home" : "away";
  if (sport !== "soccer") {
    if (selection === "draw" || winner === "draw") return settled("void", price);
  }
  return settled(selection === winner ? "won" : "lost", price);
}

function gradeTotal(
  sport: Exclude<ScoreSport, "other">,
  selection: string,
  point: number | null,
  price: number,
  home: number,
  away: number,
): GradeAction {
  if (selection !== "over" && selection !== "under") return { action: "wait", reason: "unsupported" };
  if (point == null || !Number.isFinite(point)) return { action: "wait", reason: "unsupported" };
  if (sport === "basketball" && !basketballScoreReady(home, away)) return { action: "wait", reason: "incomplete" };
  if (sport === "tennis" && tennisScoreShape(home, away) !== "games") return { action: "wait", reason: "incomplete" };

  const total = home + away;
  if (Math.abs(total - point) < 1e-9) return settled("void", price);
  const over = total > point;
  const won = selection === "over" ? over : !over;
  return settled(won ? "won" : "lost", price);
}

function basketballScoreReady(home: number, away: number): boolean {
  return home >= 30 && away >= 30 && home + away >= 80;
}

function tennisScoreShape(home: number, away: number): "sets" | "games" | "unknown" {
  if (home <= 5 && away <= 5) return "sets";
  if (home + away >= 12) return "games";
  return "unknown";
}

function validScore(value: number | null): value is number {
  return value != null && Number.isInteger(value) && value >= 0;
}

function settled(status: SettlementStatus, price: number): GradeAction {
  return { action: "settle", status, profitUnits: profitUnits(status, price) };
}
