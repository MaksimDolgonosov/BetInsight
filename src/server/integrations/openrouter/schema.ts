import { z } from "zod";
import { MARKETS } from "@/server/domain/settings";

const MARKET_ENUM = [...MARKETS] as [string, ...string[]];

export const predictionSchema = z.object({
  pick: z.object({
    market: z.enum(MARKETS),
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

export const voteSchema = z.object({
  probabilities: z
    .array(
      z.object({
        market: z.enum(MARKETS),
        selection: z.enum(["home", "draw", "away", "over", "under"]),
        point: z.number().nullable(),
        p: z.number().min(0).max(1),
      }),
    )
    .min(2)
    .max(3),
  pick: z.object({
    market: z.enum(MARKETS),
    selection: z.enum(["home", "draw", "away", "over", "under"]),
    point: z.number().nullable(),
  }),
  confidence: z.enum(["low", "medium", "high"]),
  reasoning: z.object({
    ru: z.string().min(1).max(600),
    en: z.string().min(1).max(600),
  }),
});

export type VoteResult = z.infer<typeof voteSchema>;

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
        market: { type: "string", enum: MARKET_ENUM },
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

export const voteJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["probabilities", "pick", "confidence", "reasoning"],
  properties: {
    probabilities: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["market", "selection", "point", "p"],
        properties: {
          market: { type: "string", enum: MARKET_ENUM },
          selection: { type: "string", enum: ["home", "draw", "away", "over", "under"] },
          point: { type: ["number", "null"] },
          p: { type: "number" },
        },
      },
    },
    pick: {
      type: "object",
      additionalProperties: false,
      required: ["market", "selection", "point"],
      properties: {
        market: { type: "string", enum: MARKET_ENUM },
        selection: { type: "string", enum: ["home", "draw", "away", "over", "under"] },
        point: { type: ["number", "null"] },
      },
    },
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
  },
} as const;
