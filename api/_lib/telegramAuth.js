const crypto = require("crypto");

/* Shared by every admin API endpoint (admin-content.js and the new
   media/portfolio endpoints). The HMAC algorithm is unchanged from the
   original admin-content.js - only relocated so new endpoints don't
   duplicate security-critical code.

   ADMIN_IDS is the single list of Telegram user IDs allowed into the
   admin panel and every protected endpoint - independent from
   NOTIFICATION_CHAT_ID in api/send-message.js, which only controls
   where new booking requests are delivered and has no bearing on who
   can access the admin API. Adding/removing an administrator is a
   one-line change here; nothing else needs to change. */

const ADMIN_IDS = ["1047945172", "5904817027"];


function isAdmin(userId){
  return ADMIN_IDS.includes(String(userId));
}


function validateTelegramInitData(initData, botToken){

  if(!initData || !botToken){
    return null;
  }

  try{

    const params =
      new URLSearchParams(initData);

    const hash =
      params.get("hash");

    if(!hash){
      return null;
    }

    params.delete("hash");

    const dataCheckString =
      Array.from(params.entries())
        .sort(([a],[b]) =>
          a.localeCompare(b)
        )
        .map(
          ([key,value]) =>
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

    if(calculatedHash !== hash){
      return null;
    }

    const userString =
      params.get("user");

    if(!userString){
      return null;
    }

    const user =
      JSON.parse(userString);

    return user;

  }catch(error){

    console.error(
      "Telegram validation error:",
      error
    );

    return null;

  }

}


/* Verifies Telegram initData the same way requireAdmin() does, but
   without the admin check - for endpoints (like send-message.js) that
   just need to know which real Telegram user is making the request,
   not whether they're an administrator. Always returns the verified
   user object or null; never throws, never trusts anything from the
   request body - the only input is the signed x-telegram-init-data
   header, HMAC-checked against BOT_TOKEN by validateTelegramInitData()
   above. A missing/invalid/absent initData (e.g. the Mini App opened
   outside Telegram) is not an error here - it just means "no verified
   Telegram profile for this request". */
function getVerifiedTelegramUser(req){

  const initData =
    req.headers["x-telegram-init-data"];

  return validateTelegramInitData(initData, process.env.BOT_TOKEN);

}


/* Runs the same auth check every admin endpoint needs and returns either
   { user } or { error, status } so callers can just do:
     const auth = requireAdmin(req);
     if (auth.error) return res.status(auth.status).json({ error: auth.error }); */
function requireAdmin(req){

  const initData =
    req.headers["x-telegram-init-data"];

  const user =
    validateTelegramInitData(
      initData,
      process.env.BOT_TOKEN
    );

  if(!user){
    return { error: "Telegram authorization failed", status: 401 };
  }

  if(!isAdmin(user.id)){
    return { error: "You are not administrator", status: 403 };
  }

  return { user };

}


module.exports = {
  ADMIN_IDS,
  isAdmin,
  validateTelegramInitData,
  requireAdmin,
  getVerifiedTelegramUser
};
