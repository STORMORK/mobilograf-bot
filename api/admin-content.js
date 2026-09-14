const crypto = require("crypto");

const ADMIN_ID = "1047945172";

function validateTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) return null;

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

  if (calculatedHash !== hash) return null;

  const user = JSON.parse(params.get("user") || "{}");

  return user;
}

export default async function handler(req, res) {
  try {
    const initData = req.headers["x-telegram-init-data"];

    const user = validateTelegramInitData(
      initData,
      process.env.BOT_TOKEN
    );

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    if (String(user.id) !== ADMIN_ID) {
      return res.status(403).json({
        error: "Forbidden"
      });
    }

    if (req.method === "GET") {
      return res.status(200).json({
        isAdmin: true,
        userId: user.id
      });
    }

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

      for (const field of allowedFields) {
        if (req.body?.[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const response = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/site_content?id=eq.1`,
        {
          method: "PATCH",
          headers: {
            apikey: process.env.SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation"
          },
          body: JSON.stringify(updates)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(500).json({
          error: "Supabase error",
          details: data
        });
      }

      return res.status(200).json({
        success: true,
        data: data[0] || null
      });
    }

    return res.status(405).json({
      error: "Method not allowed"
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}