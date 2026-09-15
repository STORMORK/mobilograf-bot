export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const {
      name,
      phone,
      date,
      service,
      comment
    } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({
        error: "Имя и телефон обязательны"
      });
    }

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


    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          chat_id: adminChatId,
          text: text
        })
      }
    );


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