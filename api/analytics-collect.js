const crypto = require("crypto");
const { getVerifiedTelegramUser, isAdmin } = require("./_lib/telegramAuth");
const { pgRequest } = require("./_lib/supabase");

/* Public endpoint (no admin required - same "public, ungated" pattern
   as api/busy-dates.js / api/portfolio-list.js) that the site calls to
   record one analytics event. Telegram initData is read the same way
   api/send-message.js already does (optional - verified when present,
   ignored when the Mini App is opened outside Telegram), purely to
   determine two things server-side: whether this request is one of
   the two administrators (ADMIN_IDS in telegramAuth.js) - in which
   case nothing is written at all, however the Mini App was opened -
   and a one-way hash of the visitor's Telegram id, used only to tell
   unique/returning visitors apart in api/analytics-stats.js. The raw
   initData string and the raw Telegram user id are never stored -
   only event_type, that hash, the UI language, and a timestamp. A
   client-supplied "isAdmin" flag would be meaningless here - only
   getVerifiedTelegramUser()'s own server-side HMAC check of initData
   (see telegramAuth.js) decides who's excluded. */

const ALLOWED_EVENT_TYPES = [
  "app_open",
  "portfolio_open",
  "portfolio_item_open",
  "portfolio_material_view",
  "order_open",
  "order_submit",
  "language_change"
];

const ALLOWED_LANGS = ["ua", "ru", "en"];


function hashVisitorId(telegramUserId){

  const secret = process.env.BOT_TOKEN || "";

  return crypto
    .createHmac("sha256", secret)
    .update(String(telegramUserId))
    .digest("hex");

}


export default async function handler(req, res){

  if(req.method !== "POST"){
    return res.status(405).json({ error: "Method not allowed" });
  }

  try{

    const body = req.body || {};
    const eventType = body.event_type;
    const lang = ALLOWED_LANGS.includes(body.lang) ? body.lang : null;

    if(typeof eventType !== "string" || ALLOWED_EVENT_TYPES.indexOf(eventType) === -1){
      return res.status(400).json({ error: "Unknown event_type" });
    }

    const telegramUser = getVerifiedTelegramUser(req);

    /* Either administrator - never counted, never stored, regardless
       of how the Mini App was opened (no "Адмін" button click
       required - this is a server-side identity check, not a client
       flag). */
    if(telegramUser && isAdmin(telegramUser.id)){
      return res.status(200).json({ success: true, skipped: true });
    }

    const visitorHash =
      telegramUser ? hashVisitorId(telegramUser.id) : null;

    try{

      await pgRequest("analytics_events", {
        method: "POST",
        prefer: "return=minimal",
        body: {
          event_type: eventType,
          visitor_hash: visitorHash,
          lang: lang
        }
      });

    }catch(dbError){

      /* Same "never break the visitor's experience over analytics"
         principle used by api/busy-dates.js for its own not-yet-
         created table - logged, but still answered as success so the
         page's fire-and-forget fetch() never even sees a failure. */
      console.error("analytics-collect DB error:", dbError.message);

    }

    return res.status(200).json({ success: true });

  }catch(error){

    console.error(error);

    /* Analytics must never surface as a visible error to a real
       visitor - always 200 here, even on an unexpected failure. */
    return res.status(200).json({ success: true });

  }

}
