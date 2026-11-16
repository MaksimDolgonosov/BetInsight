import { describe, expect, it } from "vitest";
import { parseResearchReport } from "./research-report";

describe("parseResearchReport", () => {
  it("reads a fenced research report and keeps an empty discard reason empty", () => {
    const report = parseResearchReport(`\`\`\`json
{"data_score":6.4,"has_injuries":true,"has_lineup":false,"h2h_available":true,"summary":"Two starters are out.","discard_reason":"  "}
\`\`\``);
    expect(report).toEqual({
      dataScore: 6,
      hasInjuries: true,
      hasLineup: false,
      h2hAvailable: true,
      summary: "Two starters are out.",
      discardReason: null,
    });
  });

  it("rejects a score outside 1–10", () => {
    expect(parseResearchReport('{"data_score":0,"has_injuries":false,"has_lineup":false,"h2h_available":false,"summary":"Empty.","discard_reason":"no sources"}')).toBeNull();
  });
});