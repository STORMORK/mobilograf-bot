const crypto = require("crypto");
const { requireAdmin, getVerifiedTelegramUser, isAdmin } = require("./_lib/telegramAuth");
const { pgRequest } = require("./_lib/supabase");

/* One file, two methods - same "combine related operations into one
   endpoint" pattern api/admin-busy-dates.js (GET+POST) and
   api/portfolio.js (one file, several actions) already use, so adding
   analytics doesn't grow the number of serverless functions by two.

   POST (collect, public - no admin required) is called by index.html's
   trackEvent() to record one analytics event. Telegram initData is
   read the same way api/send-message.js already does (optional -
   verified when present, ignored when the Mini App is opened outside
   Telegram), purely to determine two things server-side: whether this
   request is one of the two administrators (ADMIN_IDS in
   telegramAuth.js) - in which case nothing is written at all, however
   the Mini App was opened - and a one-way hash of the visitor's
   Telegram id, used only to tell unique/returning visitors apart
   below. The raw initData string and the raw Telegram user id are
   never stored - only event_type, that hash, the UI language, and a
   timestamp. A client-supplied "isAdmin" flag would be meaningless
   here - only getVerifiedTelegramUser()'s own server-side HMAC check
   of initData decides who's excluded.

   GET (stats, admin-only - requireAdmin(), the exact same Telegram
   initData + 403 check as every other admin endpoint) aggregates
   analytics_events server-side for the "📊 Статистика" section in
   admin.html. Both administrators never appear in this data in the
   first place - the POST branch never writes their events - so
   nothing here needs to filter them out again. */

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

const DAY_MS = 24 * 60 * 60 * 1000;


function hashVisitorId(telegramUserId){

  const secret = process.env.BOT_TOKEN || "";

  return crypto
    .createHmac("sha256", secret)
    .update(String(telegramUserId))
    .digest("hex");

}


function dayKey(date){
  return date.toISOString().slice(0, 10);
}


async function handleCollect(req, res){

  const body = req.body || {};
  const eventType = body.event_type;
  const lang = ALLOWED_LANGS.includes(body.lang) ? body.lang : null;

  if(typeof eventType !== "string" || ALLOWED_EVENT_TYPES.indexOf(eventType) === -1){
    return res.status(400).json({ error: "Unknown event_type" });
  }

  const telegramUser = getVerifiedTelegramUser(req);

  /* Either administrator - never counted, never stored, regardless of
     how the Mini App was opened (no "Адмін" button click required -
     this is a server-side identity check, not a client flag). */
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
       principle used by api/busy-dates.js for its own not-yet-created
       table - logged, but still answered as success so the page's
       fire-and-forget fetch() never even sees a failure. */
    console.error("analytics collect DB error:", dbError.message);

  }

  return res.status(200).json({ success: true });

}


async function handleStats(req, res){

  const auth = requireAdmin(req);

  if(auth.error){
    return res.status(auth.status).json({ error: auth.error });
  }

  let rows;

  try{

    rows =
      await pgRequest("analytics_events", {
        method: "GET",
        query: "select=event_type,visitor_hash,lang,created_at&order=created_at.asc"
      });

  }catch(dbError){

    /* Table not created yet (see README.md) - same "empty, not a hard
       error" degradation api/busy-dates.js already uses, so this
       section still renders (all-zero stats) before the one-time SQL
       setup step has been run. */
    rows = [];

  }

  rows = rows || [];

  const now = new Date();
  const todayKey = dayKey(now);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  let totalOpens = 0;
  let portfolioViews = 0;
  let itemOpens = 0;
  let materialViews = 0;
  let orderOpens = 0;
  let orderSubmits = 0;

  const byLanguage = { ua: 0, ru: 0, en: 0 };

  const uniqueVisitors = new Set();
  const visitorsToday = new Set();
  const visitors7d = new Set();
  const visitors30d = new Set();

  /* visitor_hash -> Set of distinct calendar dates it opened the app
     on, across all recorded history - a visitor is "returning" once
     that set has 2 or more days in it. */
  const visitorDays = {};

  const dailyVisitorSets = {};

  rows.forEach(function(row){

    if(row.event_type === "portfolio_open"){
      portfolioViews++;
      return;
    }

    if(row.event_type === "portfolio_item_open"){
      itemOpens++;
      return;
    }

    if(row.event_type === "portfolio_material_view"){
      materialViews++;
      return;
    }

    if(row.event_type === "order_open"){
      orderOpens++;
      return;
    }

    if(row.event_type === "order_submit"){
      orderSubmits++;
      return;
    }

    if(row.event_type !== "app_open"){
      return;
    }

    totalOpens++;

    if(row.lang && Object.prototype.hasOwnProperty.call(byLanguage, row.lang)){
      byLanguage[row.lang]++;
    }

    if(!row.visitor_hash){
      return;
    }

    const created = new Date(row.created_at);
    const key = dayKey(created);

    uniqueVisitors.add(row.visitor_hash);

    if(!visitorDays[row.visitor_hash]){
      visitorDays[row.visitor_hash] = new Set();
    }
    visitorDays[row.visitor_hash].add(key);

    if(key === todayKey){
      visitorsToday.add(row.visitor_hash);
    }

    if(created >= sevenDaysAgo){
      visitors7d.add(row.visitor_hash);
    }

    if(created >= thirtyDaysAgo){

      visitors30d.add(row.visitor_hash);

      if(!dailyVisitorSets[key]){
        dailyVisitorSets[key] = new Set();
      }
      dailyVisitorSets[key].add(row.visitor_hash);

    }

  });

  let returningVisitors = 0;

  Object.keys(visitorDays).forEach(function(hash){
    if(visitorDays[hash].size >= 2){
      returningVisitors++;
    }
  });

  const dailyVisitors = [];

  for(let i = 29; i >= 0; i--){

    const d = new Date(now.getTime() - i * DAY_MS);
    const key = dayKey(d);

    dailyVisitors.push({
      date: key,
      count: dailyVisitorSets[key] ? dailyVisitorSets[key].size : 0
    });

  }

  return res.status(200).json({
    success: true,
    uniqueVisitors: uniqueVisitors.size,
    totalOpens: totalOpens,
    visitorsToday: visitorsToday.size,
    visitors7d: visitors7d.size,
    visitors30d: visitors30d.size,
    portfolioViews: portfolioViews,
    itemOpens: itemOpens,
    materialViews: materialViews,
    orderOpens: orderOpens,
    orderSubmits: orderSubmits,
    returningVisitors: returningVisitors,
    byLanguage: byLanguage,
    dailyVisitors: dailyVisitors
  });

}


export default async function handler(req, res){

  try{

    if(req.method === "POST"){
      return await handleCollect(req, res);
    }

    if(req.method === "GET"){
      return await handleStats(req, res);
    }

    return res.status(405).json({ error: "Method not allowed" });

  }catch(error){

    console.error(error);

    /* Only the GET (stats, admin-facing) branch should ever surface a
       real error - the POST (collect) branch must never break a
       visitor's experience over analytics. */
    if(req.method === "POST"){
      return res.status(200).json({ success: true });
    }

    return res.status(500).json({
      error: error.message || "Internal server error"
    });

  }

}
