import { FORM_BONUS_SCALE, FORM_SAMPLE, FORM_VALUES, FORM_WEIGHTS, MIN_FORM_MATCHES } from "./constants";

export type FormResult = keyof typeof FORM_VALUES;
export type FormSource = "calculated" | "insufficient_data";

export type FormAssessment = {
  formHome: number;
  formAway: number;
  formDelta: number;
  formBonus: number;
  formSource: FormSource;
};

export function formScore(results: readonly FormResult[]): number {
  return results.slice(0, FORM_SAMPLE).reduce((sum, result, index) => sum + FORM_VALUES[result] * FORM_WEIGHTS[index]!, 0);
}

export function assessForm(homeResults: readonly FormResult[], awayResults: readonly FormResult[]): FormAssessment {
  const home = formScore(homeResults);
  const away = formScore(awayResults);
  const delta = Math.abs(home - away);
  const sufficient = homeResults.length >= MIN_FORM_MATCHES && awayResults.length >= MIN_FORM_MATCHES;
  return {
    formHome: round3(home),
    formAway: round3(away),
    formDelta: round3(delta),
    formBonus: sufficient ? Math.round(delta * FORM_BONUS_SCALE) : 0,
    formSource: sufficient ? "calculated" : "insufficient_data",
  };
}

export function finalScore(significanceScore: number, formBonus: number): number {
  return significanceScore + formBonus;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
