export function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production}`;
  return "http://localhost:3000";
}

export function telegramChannelUrl(locale: string): string | null {
  const channel = locale === "ru" ? process.env.TELEGRAM_CHANNEL_RU : process.env.TELEGRAM_CHANNEL_EN;
  return publicTelegramUrl(channel) ?? publicTelegramUrl(process.env.TELEGRAM_CHANNEL_URL);
}

export function publicTelegramUrl(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.startsWith("https://") || raw.startsWith("http://")) return raw.replace(/\/$/, "");
  const name = raw.replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{5,}$/.test(name)) return null;
  return `https://t.me/${name}`;
}

export function languageAlternates(locale: string, path: string) {
  const suffix = path === "/" ? "" : path;
  return {
    canonical: `/${locale}${suffix}`,
    languages: {
      ru: `/ru${suffix}`,
      en: `/en${suffix}`,
      "x-default": `/en${suffix}`,
    },
  };
}
