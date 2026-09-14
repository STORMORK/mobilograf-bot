export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { chatId, text } = req.body;

  if (!chatId || !text) {
    return res.status(400).json({ error: "chatId and text are required" });
  }

  const token = process.env.BOT_TOKEN;

  if (!token) {
    return res.status(500).json({ error: "BOT_TOKEN is not configured" });
  }

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
      })
    }
  );

  const data = await response.json();

  return res.status(response.ok ? 200 : 500).json(data);
}
