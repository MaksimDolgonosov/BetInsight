import { z } from "zod";
import type { FormResult } from "./form";

const FORM_RESULTS = ["W", "D", "L"] as const satisfies readonly FormResult[];

const formSchema = z.array(z.enum(FORM_RESULTS)).max(5);

const researchReportSchema = z.object({
  data_score: z.number().min(1).max(10),
  has_injuries: z.boolean(),
  has_lineup: z.boolean(),
  h2h_available: z.boolean(),
  home_form: formSchema,
  away_form: formSchema,
  summary: z.string().trim().min(1).max(600),
  discard_reason: z.string().trim().max(300).nullable(),
});

const storedReportSchema = z.object({
  summary: z.string().trim().min(1),
  homeForm: formSchema.optional(),
  awayForm: formSchema.optional(),
});

export type ResearchReport = {
  dataScore: number;
  hasInjuries: boolean;
  hasLineup: boolean;
  h2hAvailable: boolean;
  homeForm: FormResult[];
  awayForm: FormResult[];
  summary: string;
  discardReason: string | null;
};

export type ResearchBrief = {
  summary: string;
  homeForm: FormResult[];
  awayForm: FormResult[];
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
      homeForm: parsed.data.home_form,
      awayForm: parsed.data.away_form,
      summary: parsed.data.summary.trim(),
      discardReason: reason || null,
    };
  } catch {
    return null;
  }
}

export function researchBrief(report: Pick<ResearchReport, "summary" | "homeForm" | "awayForm">): ResearchBrief {
  return {
    summary: report.summary,
    homeForm: report.homeForm,
    awayForm: report.awayForm,
  };
}

export function researchBriefFromStored(raw: unknown): ResearchBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { content?: unknown; report?: unknown };
  const stored = storedReportSchema.safeParse(record.report);
  if (stored.success) {
    return {
      summary: stored.data.summary,
      homeForm: stored.data.homeForm ?? [],
      awayForm: stored.data.awayForm ?? [],
    };
  }
  if (typeof record.content === "string" && record.content.trim()) {
    return { summary: record.content.trim(), homeForm: [], awayForm: [] };
  }
  return null;
}
