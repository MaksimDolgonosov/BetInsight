import { describe, expect, it } from "vitest";
import { forecastMessage, kickoffLabel, reportMessage, resultMessage } from "./format";

const match = {
  locale: "ru" as const,
  home: "Alpha <FC>",
  away: "Beta & Co",
  market: "h2h",
  selection: "home",
  point: null,
  price: 1.85,
};

describe("kickoffLabel", () => {
  it("shows Moscow time in Russian and UTC in English", () => {
    expect(kickoffLabel("2026-11-09T18:00:00.000Z", "ru")).toBe("9 ноября, 21:00 МСК");
    expect(kickoffLabel("2026-11-09T18:00:00.000Z", "en")).toBe("9 November, 18:00 UTC");
  });
});

describe("forecastMessage", () => {
  it("escapes team names and links to the locale event page", () => {
    const message = forecastMessage({
      ...match,
      league: "Premier League",
      commenceTime: "2026-11-09T18:00:00.000Z",
      confidence: "high",
      reasoning: "Состав подтверждён.",
      eventId: "event 1",
      origin: "https://bet.example",
    });

    expect(message).toContain("Alpha &lt;FC&gt;");
    expect(message).toContain("Beta &amp; Co");
    expect(message).toContain("П1 Alpha &lt;FC&gt;");
    expect(message).toContain("1,85");
    expect(message).toContain("высокая");
    expect(message).toContain("21:00 МСК");
    expect(message).toContain('href="https://bet.example/ru/events/event%201"');
    expect(message).not.toContain("<FC>");
  });

  it("shortens a long explanation", () => {
    const message = forecastMessage({
      ...match,
      locale: "en",
      league: "Premier League",
      commenceTime: "2026-11-09T18:00:00.000Z",
      confidence: "low",
      reasoning: `${"word ".repeat(200)}end`,
      eventId: "event-1",
      origin: "https://bet.example",
    });
    expect(message).toContain("…");
    expect(message.length).toBeLessThan(1200);
  });
});

describe("result and report messages", () => {
  it("marks the result and prints the series", () => {
    const message = resultMessage({
      ...match,
      status: "won",
      homeScore: 2,
      awayScore: 1,
      eventId: "event-1",
      roi: 0.12,
      hitRate: 0.583,
      decided: 24,
      origin: "https://bet.example",
    });
    expect(message).toContain("✅");
    expect(message).toContain("Зашёл");
    expect(message).toContain("2:1");
    expect(message).toContain("ROI");
  });

  it("summarises a week", () => {
    const message = reportMessage({
      locale: "en",
      kind: "weekly",
      from: "2026-11-03",
      to: "2026-11-09",
      published: 4,
      won: 2,
      lost: 1,
      voided: 0,
      roi: -0.05,
      hitRate: 0.5,
      decided: 10,
      origin: "https://bet.example",
    });
    expect(message).toContain("Weekly summary");
    expect(message).toContain("2026-11-03 — 2026-11-09");
    expect(message).toContain('href="https://bet.example/en"');
  });
});
