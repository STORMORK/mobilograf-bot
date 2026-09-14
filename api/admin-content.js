const crypto = require("crypto");

const ADMIN_ID = "1047945172";


function validateTelegramInitData(
  initData,
  botToken
) {

  if (!initData || !botToken) {
    return null;
  }


  try {

    const params =
      new URLSearchParams(initData);


    const hash =
      params.get("hash");


    if (!hash) {
      return null;
    }


    params.delete("hash");


    const dataCheckString =
      Array.from(params.entries())
        .sort(
          ([a], [b]) =>
            a.localeCompare(b)
        )
        .map(
          ([key, value]) =>
            `${key}=${value}`
        )
        .join("\n");


    const secretKey =
      crypto
        .createHmac(
          "sha256",
          "WebAppData"
        )
        .update(botToken)
        .digest();


    const calculatedHash =
      crypto
        .createHmac(
          "sha256",
          secretKey
        )
        .update(dataCheckString)
        .digest("hex");


    if (
      calculatedHash !== hash
    ) {

      return null;

    }


    const userString =
      params.get("user");


    if (!userString) {
      return null;
    }


    const user =
      JSON.parse(userString);


    return user;

  } catch (error) {

    console.error(
      "Telegram validation error:",
      error
    );

    return null;

  }

}


async function getContent() {

  const response =
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/site_content?id=eq.1&select=*`,
      {
        method: "GET",

        headers: {
          apikey:
            process.env.SUPABASE_SECRET_KEY,

          Authorization:
            `Bearer ${process.env.SUPABASE_SECRET_KEY}`
        }
      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      JSON.stringify(data)
    );

  }


  return data[0] || null;

}


export default async function handler(
  req,
  res
) {

  try {

    const initData =
      req.headers[
        "x-telegram-init-data"
      ];


    const user =
      validateTelegramInitData(
        initData,
        process.env.BOT_TOKEN
      );


    if (!user) {

      return res.status(401).json({
        error:
          "Telegram authorization failed"
      });

    }


    if (
      String(user.id) !==
      ADMIN_ID
    ) {

      return res.status(403).json({
        error:
          "You are not administrator"
      });

    }


    /*
     * GET
     */

    if (req.method === "GET") {

      const content =
        await getContent();


      return res.status(200).json({

        isAdmin: true,

        userId:
          user.id,

        content:
          content

      });

    }


    /*
     * POST
     */

    if (req.method === "POST") {

      const allowedFields = [

        "hero_title",

        "hero_text",

        "about_title",

        "phone",

        "telegram",

        "instagram",

        "location"

      ];


      const updates = {};


      for (
        const field of allowedFields
      ) {

        if (
          req.body &&
          req.body[field] !== undefined
        ) {

          updates[field] =
            String(req.body[field]);

        }

      }


      const response =
        await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/site_content?id=eq.1`,
          {
            method: "PATCH",

            headers: {

              apikey:
                process.env.SUPABASE_SECRET_KEY,

              Authorization:
                `Bearer ${process.env.SUPABASE_SECRET_KEY}`,

              "Content-Type":
                "application/json",

              Prefer:
                "return=representation"

            },

            body:
              JSON.stringify(updates)

          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        return res.status(500).json({

          error:
            "Supabase error",

          details:
            data

        });

      }


      if (
        !Array.isArray(data) ||
        data.length === 0
      ) {

        return res.status(500).json({

          error:
            "Supabase did not update row with id=1"

        });

      }


      return res.status(200).json({

        success: true,

        data:
          data[0]

      });

    }


    return res.status(405).json({

      error:
        "Method not allowed"

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