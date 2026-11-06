import { describe, expect, it } from "vitest";
import { activeTennisLeagues } from "./tennis";

describe("active tennis leagues", () => {
  it("keeps active match tournaments and drops outrights", () => {
    const leagues = activeTennisLeagues([
      { key: "tennis_atp_paris_masters", group: "Tennis", title: "ATP Paris Masters", active: true, has_outrights: false },
      { key: "tennis_atp_french_open", group: "Tennis", title: "ATP French Open", active: false, has_outrights: false },
      { key: "tennis_wta_us_open", group: "Tennis", title: "WTA US Open Winner", active: true, has_outrights: true },
      { key: "basketball_nba", group: "Basketball", title: "NBA", active: true, has_outrights: false },
    ]);

    expect(leagues).toEqual([
      { key: "tennis_atp_paris_masters", group: "tennis", title: "ATP Paris Masters", enabled: true },
    ]);
  });
});
