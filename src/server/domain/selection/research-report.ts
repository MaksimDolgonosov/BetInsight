import { z } from "zod";

const researchReportSchema = z.object({
  data_score: z.number().min(1).max(10),
  has_injuries: z.boolean(),
  has_lineup: z.boolean(),
  h2h_available: z.boolean(),
  summary: z.string().trim().min(1).max(600),
  discard_reason: z.string().trim().max(300).nullable(),
});

export type ResearchReport = {
  dataScore: number;
  hasInjuries: boolean;
  hasLineup: boolean;
  h2hAvailable: boolean;
  summary: string;
  discardReason: string | null;
};

export function parseResearchReport(text: string): ResearchReport | null {
  try {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    const parsed = researchReportSchema.safeParse(JSON.parse(fenced?.[1] ?? trimmed));
    if (!parsed.success) return null;
    const reason = parsed.data.discard_reason?.trim() ?? "";
    return {
      dataScore: Math.round(parsed.data.data_score),
      hasInjuries: parsed.data.has_injuries,
      hasLineup: parsed.data.has_lineup,
      h2hAvailable: parsed.data.h2h_available,
      summary: parsed.data.summary.trim(),
      discardReason: reason || null,
    };
  } catch {
    return null;
  }
}
