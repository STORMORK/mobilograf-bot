const crypto = require("crypto");

/* Shared by every admin API endpoint (admin-content.js and the new
   media/portfolio endpoints). The HMAC algorithm and ADMIN_ID are
   unchanged from the original admin-content.js - only relocated so new
   endpoints don't duplicate security-critical code. */

const ADMIN_ID = "1047945172";


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

  if(String(user.id) !== ADMIN_ID){
    return { error: "You are not administrator", status: 403 };
  }

  return { user };

}


module.exports = {
  ADMIN_ID,
  validateTelegramInitData,
  requireAdmin
};
