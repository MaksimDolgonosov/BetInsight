import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";

describe("messages", () => {
  it("keeps the same keys in Russian and English", () => {
    expect(paths(ru).sort()).toEqual(paths(en).sort());
  });
});

function paths(value: unknown, prefix = ""): string[] {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => paths(child, prefix ? `${prefix}.${key}` : key));
}
