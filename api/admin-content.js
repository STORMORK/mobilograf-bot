const { requireAdmin } = require("./_lib/telegramAuth");
const { getSiteContentRow, patchSiteContent } = require("./_lib/supabase");

const CONTENT_I18N_LANGS = ["ua", "ru", "en"];
const MAX_CONTENT_I18N_BYTES = 200 * 1024;
const MAX_CONTENT_I18N_FIELD_LENGTH = 5000;
const MAX_CONTENT_I18N_KEY_LENGTH = 100;

/* "media" is a reserved top-level content_i18n key written exclusively by
   api/media-commit.js (a different shape: { blocks: { <id>: {...} } }, not
   {ua,ru,en}). Rejecting it here stops it from ever being silently
   corrupted by the {ua,ru,en}-shaped validation below. */
const RESERVED_CONTENT_I18N_KEYS = ["media"];


function isPlainObject(value){
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


/* Validates and sanitizes the universal content editor payload
   (admin.html -> content-schema.js). Every key/value is type- and
   size-checked before it ever reaches Supabase, so a malformed or
   oversized payload is rejected with 400 instead of being stored.
   Unchanged from before this file started sharing _lib helpers. */
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

    if(RESERVED_CONTENT_I18N_KEYS.includes(key)){
      return { error: `"${key}" is a reserved key and cannot be set here` };
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


export default async function handler(
  req,
  res
){

  try{

    const auth = requireAdmin(req);

    if(auth.error){
      return res.status(auth.status).json({ error: auth.error });
    }

    const user = auth.user;


    if(req.method === "GET"){

      const content =
        await getSiteContentRow();

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

      const flatUpdates = {};

      for(const field of allowedFields){

        if(
          req.body &&
          req.body[field] !== undefined
        ){

          flatUpdates[field] =
            String(req.body[field]);

        }

      }


      let contentI18nPatch;

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

        contentI18nPatch = validation.value;

      }


      if(
        contentI18nPatch === undefined &&
        Object.keys(flatUpdates).length === 0
      ){

        return res.status(400).json({
          error:"No fields to update"
        });

      }


      let data;

      try{

        data = await patchSiteContent(contentI18nPatch, flatUpdates);

      }catch(error){

        return res.status(500).json({
          error:"Supabase error",
          details:error.message
        });

      }


      return res.status(200).json({
        success:true,
        data:data
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
