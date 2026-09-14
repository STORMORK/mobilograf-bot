export default async function handler(
  req,
  res
) {

  if (req.method !== "POST") {

    return res.status(405).json({

      error:
        "Method not allowed"

    });

  }


  try {

    const botToken =
      process.env.BOT_TOKEN;

    const chatId =
      process.env.CHAT_ID ||
      "1047945172";


    if (!botToken) {

      return res.status(500).json({

        error:
          "BOT_TOKEN is missing"

      });

    }


    const body =
      req.body || {};


    const name =
      String(
        body.name || ""
      ).trim();


    const phone =
      String(
        body.phone || ""
      ).trim();


    const date =
      String(
        body.date || ""
      ).trim();


    const service =
      String(
        body.service || ""
      ).trim();


    const comment =
      String(
        body.comment || ""
      ).trim();


    if (!name || !phone) {

      return res.status(400).json({

        error:
          "Name and phone are required"

      });

    }


    const text =

`📩 НОВА ЗАЯВКА

👤 Ім'я: ${name}

📞 Телефон: ${phone}

📅 Дата: ${date || "Не вказана"}

🎥 Послуга: ${service || "Не вказана"}

💬 Коментар:
${comment || "Без коментаря"}`;


    const telegramResponse =
      await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({

              chat_id:
                chatId,

              text:
                text

            })

        }
      );


    const telegramData =
      await telegramResponse.json();


    if (
      !telegramResponse.ok ||
      !telegramData.ok
    ) {

      return res.status(500).json({

        error:
          "Telegram error",

        details:
          telegramData

      });

    }


    return res.status(200).json({

      success: true

    });


  } catch (error) {

    console.error(error);


    return res.status(500).json({

      error:
        "Internal server error",

      details:
        error.message

    });

  }

}