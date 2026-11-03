import { describe, expect, it } from "vitest";
import { routing } from "./routing";

describe("routing", () => {
  it("uses ru and en, with English as the fallback locale", () => {
    expect(routing.locales).toEqual(["ru", "en"]);
    expect(routing.defaultLocale).toBe("en");
    expect(routing.localePrefix).toBe("always");
  });
});
