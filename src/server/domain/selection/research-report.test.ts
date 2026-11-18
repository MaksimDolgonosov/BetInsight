import { describe, expect, it } from "vitest";
import { parseResearchReport, researchBriefFromStored } from "./research-report";

describe("parseResearchReport", () => {
  it("reads a fenced research report and keeps an empty discard reason empty", () => {
    const report = parseResearchReport(`\`\`\`json
{"data_score":6.4,"has_injuries":true,"has_lineup":false,"h2h_available":true,"home_form":["W","W","L","D","W"],"away_form":["L"],"summary":"Two starters are out.","discard_reason":"  "}
\`\`\``);
    expect(report).toEqual({
      dataScore: 6,
      hasInjuries: true,
      hasLineup: false,
      h2hAvailable: true,
      homeForm: ["W", "W", "L", "D", "W"],
      awayForm: ["L"],
      summary: "Two starters are out.",
      discardReason: null,
    });
  });

  it("rejects a score outside 1–10 and a form longer than five", () => {
    expect(parseResearchReport('{"data_score":0,"has_injuries":false,"has_lineup":false,"h2h_available":false,"home_form":[],"away_form":[],"summary":"Empty.","discard_reason":"no sources"}')).toBeNull();
    expect(parseResearchReport('{"data_score":6,"has_injuries":false,"has_lineup":false,"h2h_available":false,"home_form":["W","W","W","W","W","L"],"away_form":[],"summary":"Long form.","discard_reason":null}')).toBeNull();
    expect(parseResearchReport('{"data_score":6,"has_injuries":false,"has_lineup":false,"h2h_available":false,"home_form":["X"],"away_form":[],"summary":"Bad letter.","discard_reason":null}')).toBeNull();
  });

  it("keeps an older brief that has no form arrays", () => {
    expect(researchBriefFromStored({ content: "Two starters are out.", report: { summary: "Two starters are out." } })).toEqual({
      summary: "Two starters are out.",
      homeForm: [],
      awayForm: [],
    });
    expect(researchBriefFromStored({ content: "Only text." })).toEqual({
      summary: "Only text.",
      homeForm: [],
      awayForm: [],
    });
  });
});