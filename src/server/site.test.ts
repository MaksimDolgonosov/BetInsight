import { afterEach, describe, expect, it } from "vitest";
import { publicTelegramUrl, telegramChannelUrl } from "./site";

describe("publicTelegramUrl", () => {
  it("turns a channel username into a t.me link", () => {
    expect(publicTelegramUrl("@betinsight_ru")).toBe("https://t.me/betinsight_ru");
    expect(publicTelegramUrl("https://t.me/betinsight_en/")).toBe("https://t.me/betinsight_en");
    expect(publicTelegramUrl("")).toBeNull();
  });
});

describe("telegramChannelUrl", () => {
  afterEach(() => {
    delete process.env.TELEGRAM_CHANNEL_RU;
    delete process.env.TELEGRAM_CHANNEL_EN;
    delete process.env.TELEGRAM_CHANNEL_URL;
  });

  it("follows the selected language", () => {
    process.env.TELEGRAM_CHANNEL_RU = "@betinsight_ru";
    process.env.TELEGRAM_CHANNEL_EN = "@betinsight_en";
    expect(telegramChannelUrl("ru")).toBe("https://t.me/betinsight_ru");
    expect(telegramChannelUrl("en")).toBe("https://t.me/betinsight_en");
  });
});
