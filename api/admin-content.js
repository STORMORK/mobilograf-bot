import crypto from "crypto";

const ADMIN_ID = "1047945172";


function validateTelegramInitData(initData, botToken) {

  if (!initData || !botToken) {
    return null;
  }

  const params = new URLSearchParams(initData);

  const hash = params.get("hash");

  if (!hash) {
    return null;
  }

  params.delete("hash");


  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");


  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();


  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");


  if (calculatedHash !== hash) {
    return null;
  }


  const authDate =
    Number(params.get("auth_date"));


  if (!authDate) {
    return null;
  }


  if (
    Math.floor(Date.now() / 1000) -
    authDate >
    86400
  ) {
    return null;
  }


  try {

    return JSON.parse(
      params.get("user") || "{}"
    );

  } catch {

    return null;

  }

}


/* ================================
   ПОЛУЧЕНИЕ ДАННЫХ АДМИНКИ
================================ */

async function getAdmin(req, res) {

  const initData =
    req.headers["x-telegram-init-data"];


  const user =
    validateTelegramInitData(
      initData,
      process.env.BOT_TOKEN
    );


  if (
    !user ||
    String(user.id) !== ADMIN_ID
  ) {

    return res.status(403).json({
      error: "Access denied"
    });

  }


  const supabaseUrl =
    process.env.SUPABASE_URL;


  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY;


  if (
    !supabaseUrl ||
    !supabaseKey
  ) {

    return res.status(500).json({
      error:
        "Supabase environment variables are missing"
    });

  }


  const response = await fetch(
    `${supabaseUrl}/rest/v1/site_content?id=eq.1&select=*`,
    {
      method: "GET",

      headers: {

        apikey: supabaseKey,

        Authorization:
          `Bearer ${supabaseKey}`

      }

    }
  );


  const data =
    await response.json();


  if (!response.ok) {

    return res.status(500).json({

      error:
        "Supabase read error",

      details:
        data

    });

  }


  return res.status(200).json({

    isAdmin: true,

    userId: user.id,

    content:
      data[0] || null

  });

}


/* ================================
   СОХРАНЕНИЕ ДАННЫХ
================================ */

async function updateContent(req, res) {

  const initData =
    req.headers["x-telegram-init-data"];


  const user =
    validateTelegramInitData(
      initData,
      process.env.BOT_TOKEN
    );


  if (
    !user ||
    String(user.id) !== ADMIN_ID
  ) {

    return res.status(403).json({
      error: "Access denied"
    });

  }


  const supabaseUrl =
    process.env.SUPABASE_URL;


  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY;


  if (
    !supabaseUrl ||
    !supabaseKey
  ) {

    return res.status(500).json({

      error:
        "Supabase environment variables are missing"

    });

  }


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


  if (
    Object.keys(updates).length === 0
  ) {

    return res.status(400).json({

      error:
        "No fields to update"

    });

  }


  const response = await fetch(

    `${supabaseUrl}/rest/v1/site_content?id=eq.1`,

    {

      method: "PATCH",

      headers: {

        apikey:
          supabaseKey,

        Authorization:
          `Bearer ${supabaseKey}`,

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
        "Supabase update error",

      details:
        data

    });

  }


  /* ВАЖНО:
     если строки id=1 нет,
     считаем сохранение ошибкой */

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {

    return res.status(500).json({

      error:
        "Дані не змінені",

      details:
        "В Supabase не знайдена строка з id=1."

    });

  }


  return res.status(200).json({

    success: true,

    data:
      data[0]

  });

}


/* ================================
   ОСНОВНОЙ HANDLER
================================ */

export default async function handler(
  req,
  res
) {

  try {

    if (
      req.method === "GET"
    ) {

      return await getAdmin(
        req,
        res
      );

    }


    if (
      req.method === "POST"
    ) {

      return await updateContent(
        req,
        res
      );

    }


    return res.status(405).json({

      error:
        "Method not allowed"

    });


  } catch (error) {

    console.error(error);


    return res.status(500).json({

      error:
        "Internal server error"

    });

  }

}