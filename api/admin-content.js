const crypto = require("crypto");

const ADMIN_ID = "1047945172";

const CONTENT_I18N_LANGS = ["ua", "ru", "en"];
const MAX_CONTENT_I18N_BYTES = 200 * 1024;
const MAX_CONTENT_I18N_FIELD_LENGTH = 5000;
const MAX_CONTENT_I18N_KEY_LENGTH = 100;

/* DeepL Free API. UA is the only language an admin edits; RU/EN are
   derived automatically. Ukrainian ("UK") is DeepL's source code; DeepL
   requires a regional variant for English as a *target* ("EN-US"/"EN-GB"),
   plain "EN" is only valid as a source. */
const DEEPL_API_URL = "https://api-free.deepl.com/v2/translate";
const DEEPL_TIMEOUT_MS = 8000;
const DEEPL_SOURCE_LANG = "UK";
const DEEPL_TARGET_LANGS = { ru: "RU", en: "EN-US" };
const DEEPL_MAX_BATCH_SIZE = 50;


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


/* Calls DeepL for one target language, chunking into batches of
   DEEPL_MAX_BATCH_SIZE (DeepL's own per-request limit). Never logs or
   returns the API key; only DeepL's own error message can surface. */
async function translateBatch(texts, targetLang){

  if(texts.length === 0){
    return [];
  }

  const apiKey = process.env.DEEPL_API_KEY;

  if(!apiKey){
    throw new Error("DEEPL_API_KEY is not configured");
  }

  const results = [];

  for(let offset = 0; offset < texts.length; offset += DEEPL_MAX_BATCH_SIZE){

    const chunk =
      texts.slice(offset, offset + DEEPL_MAX_BATCH_SIZE);

    const controller = new AbortController();

    const timeoutId = setTimeout(function(){
      controller.abort();
    }, DEEPL_TIMEOUT_MS);

    try{

      const response =
        await fetch(
          DEEPL_API_URL,
          {
            method: "POST",

            headers: {
              Authorization: `DeepL-Auth-Key ${apiKey}`,
              "Content-Type": "application/json"
            },

            body: JSON.stringify({
              text: chunk,
              source_lang: DEEPL_SOURCE_LANG,
              target_lang: targetLang
            }),

            signal: controller.signal
          }
        );

      const data =
        await response.json();

      if(!response.ok){

        throw new Error(
          `DeepL API error (${response.status}): ` +
          (data && data.message ? data.message : "unknown error")
        );

      }

      if(!data || !Array.isArray(data.translations)){
        throw new Error("Unexpected DeepL API response shape");
      }

      data.translations.forEach(function(item){
        results.push(item.text);
      });

    } finally {

      clearTimeout(timeoutId);

    }

  }

  return results;

}


/* Diffs the incoming (already-validated) content_i18n against what is
   currently stored, translates only the UA values that actually changed
   (or are brand new), and fills ru/en for every key using this priority:
     1. a fresh DeepL translation (only for changed UA values)
     2. the value already stored in Supabase for that key
     3. whatever the client sent (e.g. the schema's built-in default)
     4. the ua text itself, so a field is never left blank
   If DeepL fails, no ru/en value already in Supabase is ever overwritten -
   only step 1 is skipped, translationError is returned so the caller can
   surface a warning, and ua is still saved normally. */
async function buildTranslatedContentI18n(existingContentI18n, incomingContentI18n){

  existingContentI18n = existingContentI18n || {};

  const keysToTranslate = [];
  const textsToTranslate = [];

  for(const key of Object.keys(incomingContentI18n)){

    const newUa = incomingContentI18n[key].ua;

    if(newUa === undefined){
      continue;
    }

    const existingEntry = existingContentI18n[key];
    const existingUa = existingEntry ? existingEntry.ua : undefined;

    if(newUa !== existingUa){
      keysToTranslate.push(key);
      textsToTranslate.push(newUa);
    }

  }


  let translatedByKey = {};
  let translationError = null;

  if(textsToTranslate.length > 0){

    try{

      const [translatedRu, translatedEn] =
        await Promise.all([
          translateBatch(textsToTranslate, DEEPL_TARGET_LANGS.ru),
          translateBatch(textsToTranslate, DEEPL_TARGET_LANGS.en)
        ]);

      keysToTranslate.forEach(function(key, index){

        translatedByKey[key] = {
          ru: translatedRu[index],
          en: translatedEn[index]
        };

      });

    }catch(error){

      console.error("DeepL translation failed:", error.message);
      translationError = error.message;
      translatedByKey = {};

    }

  }


  const result = {};

  for(const key of Object.keys(incomingContentI18n)){

    const incomingEntry = incomingContentI18n[key];
    const existingEntry = existingContentI18n[key] || {};
    const translated = translatedByKey[key];

    const finalUa =
      incomingEntry.ua !== undefined
        ? incomingEntry.ua
        : existingEntry.ua;

    const finalRu =
      translated ? translated.ru :
      existingEntry.ru !== undefined ? existingEntry.ru :
      incomingEntry.ru !== undefined ? incomingEntry.ru :
      finalUa;

    const finalEn =
      translated ? translated.en :
      existingEntry.en !== undefined ? existingEntry.en :
      incomingEntry.en !== undefined ? incomingEntry.en :
      finalUa;

    result[key] = {
      ua: finalUa,
      ru: finalRu,
      en: finalEn
    };

  }

  return {
    content: result,
    translationError: translationError,
    translatedKeys: keysToTranslate
  };

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


      let translationWarning = null;

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

        const existingContent =
          await getContent();

        const translationResult =
          await buildTranslatedContentI18n(
            (existingContent && existingContent.content_i18n) || {},
            validation.value
          );

        updates.content_i18n =
          translationResult.content;

        if(translationResult.translationError){

          translationWarning =
            "Не вдалося автоматично перекласти деякі поля " +
            "(попередні RU/EN значення залишено без змін): " +
            translationResult.translationError;

        }

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
        data:data[0],
        translationWarning:translationWarning
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