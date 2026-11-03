import { z } from "zod";

export const predictionSchema = z.object({
  pick: z.object({
    market: z.enum(["h2h", "totals"]),
    selection: z.enum(["home", "draw", "away", "over", "under"]),
    point: z.number().nullable(),
  }),
  ai_probability: z.number().min(0).max(1),
  confidence: z.enum(["low", "medium", "high"]),
  reasoning: z.object({
    ru: z.string().min(1).max(600),
    en: z.string().min(1).max(600),
  }),
  skip: z.boolean(),
});

export type PredictionResult = z.infer<typeof predictionSchema>;

export const predictionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pick", "ai_probability", "confidence", "reasoning", "skip"],
  properties: {
    pick: {
      type: "object",
      additionalProperties: false,
      required: ["market", "selection", "point"],
      properties: {
        market: { type: "string", enum: ["h2h", "totals"] },
        selection: { type: "string", enum: ["home", "draw", "away", "over", "under"] },
        point: { type: ["number", "null"] },
      },
    },
    ai_probability: { type: "number" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    reasoning: {
      type: "object",
      additionalProperties: false,
      required: ["ru", "en"],
      properties: {
        ru: { type: "string" },
        en: { type: "string" },
      },
    },
    skip: { type: "boolean" },
  },
} as const;
