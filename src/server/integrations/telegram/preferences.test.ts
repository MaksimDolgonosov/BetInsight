import { describe, expect, it } from "vitest";
import { localeFromLanguage, nextLeagues, parseLeagues, parseQuiet } from "./preferences";

describe("localeFromLanguage", () => {
  it("keeps Russian and falls back to English", () => {
    expect(localeFromLanguage("ru")).toBe("ru");
    expect(localeFromLanguage("ru-RU")).toBe("ru");
    expect(localeFromLanguage("en")).toBe("en");
    expect(localeFromLanguage(undefined)).toBe("en");
  });
});

describe("nextLeagues", () => {
  const enabled = ["soccer_epl", "tennis_atp"];

  it("stores all leagues as an empty filter", () => {
    expect(nextLeagues(["soccer_epl"], "all", enabled)).toBeNull();
  });

  it("turns one league off and restores all when every league is on", () => {
    expect(nextLeagues(null, "tennis_atp", enabled)).toEqual(["soccer_epl"]);
    expect(nextLeagues(["soccer_epl"], "tennis_atp", enabled)).toBeNull();
  });
});

describe("stored preferences", () => {
  it("accepts a quiet window and a league list", () => {
    expect(parseQuiet({ start: "23:00", end: "08:00" })).toEqual({ start: "23:00", end: "08:00" });
    expect(parseQuiet({ start: "25:00", end: "08:00" })).toBeNull();
    expect(parseLeagues(null)).toBeNull();
    expect(parseLeagues(["soccer_epl", 1])).toEqual(["soccer_epl"]);
  });
});
