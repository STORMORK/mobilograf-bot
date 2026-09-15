const crypto = require("crypto");

const ADMIN_ID = "1047945172";

const CONTENT_I18N_LANGS = ["ua", "ru", "en"];
const MAX_CONTENT_I18N_BYTES = 200 * 1024;
const MAX_CONTENT_I18N_FIELD_LENGTH = 5000;
const MAX_CONTENT_I18N_KEY_LENGTH = 100;


function isPlainObject(value){
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


/* Validates and sanitizes the universal content editor payload
   (admin.html -> content-schema.js). Every key/value is type- and
   size-checked before it ever reaches Supabase, so a malformed or
   oversized payload is rejected with 400 instead of being stored. */
function validateContentI18n(value){

  if(!isPlainObject(value)){
    return { error: "content_i18n must be an object" };
  }

  if(JSON.stringify(value).length > MAX_CONTENT_I18N_BYTES){
    return { error: "content_i18n payload is too large" };
  }

  const sanitized = {};

  for(const key of Object.keys(value)){

    if(
      typeof key !== "string" ||
      key.length === 0 ||
      key.length > MAX_CONTENT_I18N_KEY_LENGTH
    ){
      return { error: `Invalid content_i18n key: ${key}` };
    }

    const entry = value[key];

    if(!isPlainObject(entry)){
      return { error: `content_i18n["${key}"] must be an object` };
    }

    const sanitizedEntry = {};

    for(const lang of CONTENT_I18N_LANGS){

      const langValue = entry[lang];

      if(langValue === undefined || langValue === null){
        continue;
      }

      if(typeof langValue !== "string"){
        return { error: `content_i18n["${key}"]["${lang}"] must be a string` };
      }

      if(langValue.length > MAX_CONTENT_I18N_FIELD_LENGTH){
        return { error: `content_i18n["${key}"]["${lang}"] is too long` };
      }

      sanitizedEntry[lang] = langValue;

    }

    sanitized[key] = sanitizedEntry;

  }

  return { value: sanitized };

}


function validateTelegramInitData(
  initData,
  botToken
){

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


async function getContent(){

  const response =
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/site_content?id=eq.1&select=*`,
      {
        method:"GET",
        headers:{
          apikey:
            process.env.SUPABASE_SECRET_KEY,

          Authorization:
            `Bearer ${process.env.SUPABASE_SECRET_KEY}`
        }
      }
    );

  const data =
    await response.json();

  if(!response.ok){

    throw new Error(
      JSON.stringify(data)
    );

  }

  return data[0] || null;

}


export default async function handler(
  req,
  res
){

  try{

    const initData =
      req.headers["x-telegram-init-data"];

    const user =
      validateTelegramInitData(
        initData,
        process.env.BOT_TOKEN
      );

    if(!user){

      return res.status(401).json({
        error:"Telegram authorization failed"
      });

    }

    if(String(user.id) !== ADMIN_ID){

      return res.status(403).json({
        error:"You are not administrator"
      });

    }


    if(req.method === "GET"){

      const content =
        await getContent();

      return res.status(200).json({
        isAdmin:true,
        userId:user.id,
        content:content
      });

    }


    if(req.method === "POST"){

      const allowedFields = [

        "hero_title_ua",
        "hero_title_ru",
        "hero_title_en",

        "hero_text_ua",
        "hero_text_ru",
        "hero_text_en",

        "about_title_ua",
        "about_title_ru",
        "about_title_en",

        "phone",
        "telegram",
        "instagram",
        "location"

      ];

      const updates = {};

      for(const field of allowedFields){

        if(
          req.body &&
          req.body[field] !== undefined
        ){

          updates[field] =
            String(req.body[field]);

        }

      }


      if(
        req.body &&
        req.body.content_i18n !== undefined
      ){

        const validation =
          validateContentI18n(req.body.content_i18n);

        if(validation.error){

          return res.status(400).json({
            error: validation.error
          });

        }

        updates.content_i18n =
          validation.value;

      }


      if(
        Object.keys(updates).length === 0
      ){

        return res.status(400).json({
          error:"No fields to update"
        });

      }


      const response =
        await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/site_content?id=eq.1`,
          {
            method:"PATCH",

            headers:{
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


      if(!response.ok){

        return res.status(500).json({
          error:"Supabase error",
          details:data
        });

      }


      if(
        !Array.isArray(data) ||
        data.length === 0
      ){

        return res.status(500).json({
          error:
            "Supabase did not update row with id=1"
        });

      }


      return res.status(200).json({
        success:true,
        data:data[0]
      });

    }


    return res.status(405).json({
      error:"Method not allowed"
    });


  }catch(error){

    console.error(error);

    return res.status(500).json({
      error:"Internal server error",
      details:error.message
    });

  }

}