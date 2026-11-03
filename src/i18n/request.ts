import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

const timeZones = {
  ru: "Europe/Moscow",
  en: "UTC",
} as const;

export default getRequestConfig(async ({ locale, requestLocale }) => {
  const requested = locale ?? (await requestLocale);

  if (!hasLocale(routing.locales, requested)) {
    return { locale: routing.defaultLocale };
  }

  return {
    locale: requested,
    messages: (await import(`../../messages/${requested}.json`)).default,
    timeZone: timeZones[requested],
  };
});
