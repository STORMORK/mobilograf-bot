/* =====================================
   CONFIG
===================================== */

const FIELD_LIMITS = {
  name: 100,
  phone: 30,
  date: 20,
  service: 50,
  comment: 1000
};

const MAX_BODY_BYTES = 10 * 1024; // form payload never legitimately exceeds this

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5; // per IP, per window
const RATE_LIMIT_STORE_MAX_ENTRIES = 5000; // cap memory use of the in-process map

const TELEGRAM_TIMEOUT_MS = 8000;


/* =====================================
   RATE LIMITING (best-effort, in-memory)

   Serverless instances are ephemeral and can run concurrently, so this map
   only limits requests that land on the same warm instance. It is not a
   substitute for a shared store, but requires no external service.
===================================== */

const rateLimitStore = new Map();

function getClientIp(req) {

  const forwarded = req.headers["x-forwarded-for"];

  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }

  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }

  return "unknown";
}

function isRateLimited(ip) {

  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {

    rateLimitStore.set(ip, { count: 1, windowStart: now });

    if (rateLimitStore.size > RATE_LIMIT_STORE_MAX_ENTRIES) {

      for (const [key, value] of rateLimitStore) {
        if (now - value.windowStart > RATE_LIMIT_WINDOW_MS) {
          rateLimitStore.delete(key);
        }
      }

    }

    return false;
  }

  entry.count += 1;

  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}


/* =====================================
   VALIDATION
===================================== */

function validateField(value, fieldName, maxLength, required) {

  if (value === undefined || value === null || value === "") {

    if (required) {
      return { error: `Поле "${fieldName}" є обов'язковим` };
    }

    return { value: "" };
  }

  if (typeof value !== "string") {
    return { error: `Поле "${fieldName}" має бути текстом` };
  }

  const trimmed = value.trim();

  if (required && trimmed.length === 0) {
    return { error: `Поле "${fieldName}" є обов'язковим` };
  }

  if (trimmed.length > maxLength) {
    return { error: `Поле "${fieldName}" занадто довге (максимум ${maxLength} символів)` };
  }

  return { value: trimmed };
}


/* =====================================
   TELEGRAM
===================================== */

async function sendTelegramMessage(token, chatId, text) {

  const controller = new AbortController();

  const timeoutId = setTimeout(
    function () {
      controller.abort();
    },
    TELEGRAM_TIMEOUT_MS
  );

  try {

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          chat_id: chatId,
          text: text
        }),

        signal: controller.signal
      }
    );

    return response;

  } finally {

    clearTimeout(timeoutId);

  }

}


/* =====================================
   HANDLER
===================================== */

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const clientIp = getClientIp(req);

  if (isRateLimited(clientIp)) {

    res.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_MS / 1000));

    return res.status(429).json({
      error: "Забагато запитів. Спробуйте пізніше."
    });

  }

  const contentType = req.headers["content-type"] || "";

  if (!contentType.toLowerCase().includes("application/json")) {

    return res.status(415).json({
      error: "Content-Type must be application/json"
    });

  }

  const contentLength = Number(req.headers["content-length"] || 0);

  if (contentLength > MAX_BODY_BYTES) {

    return res.status(413).json({
      error: "Запит занадто великий"
    });

  }

  try {

    const body = req.body || {};

    const nameResult = validateField(body.name, "Ім'я", FIELD_LIMITS.name, true);
    if (nameResult.error) {
      return res.status(400).json({ error: nameResult.error });
    }

    const phoneResult = validateField(body.phone, "Телефон", FIELD_LIMITS.phone, true);
    if (phoneResult.error) {
      return res.status(400).json({ error: phoneResult.error });
    }

    const dateResult = validateField(body.date, "Дата", FIELD_LIMITS.date, false);
    if (dateResult.error) {
      return res.status(400).json({ error: dateResult.error });
    }

    const serviceResult = validateField(body.service, "Послуга", FIELD_LIMITS.service, false);
    if (serviceResult.error) {
      return res.status(400).json({ error: serviceResult.error });
    }

    const commentResult = validateField(body.comment, "Коментар", FIELD_LIMITS.comment, false);
    if (commentResult.error) {
      return res.status(400).json({ error: commentResult.error });
    }

    const name = nameResult.value;
    const phone = phoneResult.value;
    const date = dateResult.value;
    const service = serviceResult.value;
    const comment = commentResult.value;

    const token = process.env.BOT_TOKEN;

    if (!token) {
      return res.status(500).json({
        error: "BOT_TOKEN is not configured"
      });
    }

    const adminChatId = "1047945172";

    const text =
`📸 НОВАЯ ЗАЯВКА

👤 Имя: ${name}

📞 Телефон: ${phone}

📅 Дата: ${date || "Не указана"}

🎬 Услуга: ${service || "Не указана"}

💬 Комментарий:
${comment || "Без комментария"}`;


    let telegramResponse;

    try {

      telegramResponse = await sendTelegramMessage(
        token,
        adminChatId,
        text
      );

    } catch (fetchError) {

      if (fetchError.name === "AbortError") {

        return res.status(504).json({
          error: "Telegram API timeout"
        });

      }

      throw fetchError;

    }


    const data =
      await telegramResponse.json();


    if (!telegramResponse.ok) {

      return res.status(502).json({
        error: "Telegram API error",
        details: data
      });

    }


    return res.status(200).json({
      success: true
    });


  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Internal server error"
    });

  }

}
