/* Telegram Bot webhook - the actual bot conversation (currently just
   "/start") lives here, completely separate from every other endpoint
   in this repo: those all serve the Mini App itself (booking, content,
   portfolio, analytics), never handle incoming Telegram updates. This
   is the ONLY place that does.

   Requires a one-time setup step outside this repo - Telegram doesn't
   discover this URL on its own: see README.md ("Telegram-бот: /start
   та кнопка запуску Mini App") for the exact setWebhook call.

   TELEGRAM_WEBHOOK_SECRET is optional. When set, Telegram is asked (via
   setWebhook's own secret_token param, done once in that same setup
   step) to echo it back on every update as the
   X-Telegram-Bot-Api-Secret-Token header - checked below so a request
   that merely guesses this URL and payload shape can't make the bot
   send messages to an arbitrary chat_id using BOT_TOKEN. Left unset,
   the check is skipped, same "optional, graceful without it" pattern
   NOTIFICATION_CHAT_ID already uses in send-message.js. */

const MINI_APP_URL = "https://mobilograf-bot.vercel.app/";

const OPEN_APP_BUTTON_TEXT = "📱 Відкрити застосунок";

const START_MESSAGE_TEXT =
`Вітаю! 👋

Тут ви можете переглянути мої роботи, ознайомитися з послугами та обрати зручну дату для зйомки.

Натискайте кнопку нижче та заходьте 👇`;


async function callTelegramApi(token, method, payload) {

  const response =
    await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

  return response.json().catch(function () { return null; });

}


function isStartCommand(text) {
  return typeof text === "string" && text.indexOf("/start") === 0;
}


export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (
    expectedSecret &&
    req.headers["x-telegram-bot-api-secret-token"] !== expectedSecret
  ) {
    return res.status(401).json({ error: "Invalid secret token" });
  }

  const token = process.env.BOT_TOKEN;

  if (!token) {

    console.error("telegram-webhook: BOT_TOKEN is not configured");

    // Telegram only cares about a 2xx response - anything else makes it
    // retry the same update repeatedly, so this always answers 200.
    return res.status(200).json({ ok: true });

  }

  try {

    const update = req.body || {};
    const message = update.message;
    const chatId = message && message.chat && message.chat.id;

    if (chatId && isStartCommand(message.text)) {

      await callTelegramApi(token, "sendMessage", {

        chat_id: chatId,

        text: START_MESSAGE_TEXT,

        reply_markup: {
          inline_keyboard: [[
            {
              text: OPEN_APP_BUTTON_TEXT,
              web_app: { url: MINI_APP_URL }
            }
          ]]
        }

      });

      /* No chat_id here on purpose - sets the DEFAULT menu button (the
         one shown next to the message box) for every user, not just
         this chat. Safe/idempotent to repeat on every /start - keeps
         it self-healing if it's ever reset from outside this code. */
      await callTelegramApi(token, "setChatMenuButton", {
        menu_button: {
          type: "web_app",
          text: OPEN_APP_BUTTON_TEXT,
          web_app: { url: MINI_APP_URL }
        }
      });

    }

  } catch (error) {

    console.error("telegram-webhook error:", error);

  }

  return res.status(200).json({ ok: true });

}
