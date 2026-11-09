import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = [process.env.AUTH_URL, process.env.NEXT_PUBLIC_SITE_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .map((value) => (value ?? "").trim().replace(/\/$/, ""))
  .map((value) => (value && !value.startsWith("http") ? `https://${value}` : value))
  .find((value) => value.startsWith("https://"));
const admins = (process.env.ADMIN_TELEGRAM_IDS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

if (!token || !secret || !base) {
  console.error("Need TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and an https AUTH_URL.");
  process.exit(1);
}

const api = `https://api.telegram.org/bot${token}`;
const publicCommands = {
  ru: [
    { command: "today", description: "Прогнозы на сегодня" },
    { command: "stats", description: "Статистика серии" },
    { command: "last", description: "Последние 10 результатов" },
    { command: "settings", description: "Лиги, язык и тихие часы" },
    { command: "lang", description: "Переключить язык" },
    { command: "stop", description: "Отписаться" },
  ],
  en: [
    { command: "today", description: "Today's forecasts" },
    { command: "stats", description: "Series stats" },
    { command: "last", description: "Last 10 results" },
    { command: "settings", description: "Leagues, language and quiet hours" },
    { command: "lang", description: "Switch language" },
    { command: "stop", description: "Unsubscribe" },
  ],
};

await call("setWebhook", {
  url: `${base}/api/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: false,
});

for (const [language_code, commands] of Object.entries(publicCommands)) {
  await call("setMyCommands", { commands, language_code });
}

for (const chatId of admins) {
  for (const [language_code, commands] of Object.entries(publicCommands)) {
    const extra =
      language_code === "ru"
        ? [
            { command: "budget", description: "Остаток кредитов" },
            { command: "health", description: "Состояние сервиса" },
          ]
        : [
            { command: "budget", description: "Credit balance" },
            { command: "health", description: "Service health" },
          ];
    await call("setMyCommands", {
      commands: [...commands, ...extra],
      language_code,
      scope: { type: "chat", chat_id: Number(chatId) },
    });
  }
}

console.log(`Webhook points at ${base}/api/telegram/webhook`);

async function call(method, body) {
  const response = await fetch(`${api}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    console.error(method, payload.description ?? response.status);
    process.exit(1);
  }
}
