const { requireAdmin } = require("./_lib/telegramAuth");
const { pgRequest } = require("./_lib/supabase");

/* Admin-only (requireAdmin() - the exact same Telegram initData + 403
   check as every other admin endpoint) real server-side aggregation
   of analytics_events, built for the "📊 Статистика" section in
   admin.html. Both administrators (ADMIN_IDS) never appear in this
   data in the first place - api/analytics-collect.js never writes
   their events - so nothing here needs to filter them out again. */

const DAY_MS = 24 * 60 * 60 * 1000;


function dayKey(date){
  return date.toISOString().slice(0, 10);
}


export default async function handler(req, res){

  if(req.method !== "GET"){
    return res.status(405).json({ error: "Method not allowed" });
  }

  try{

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

      /* Table not created yet (see README.md) - same "empty, not a
         hard error" degradation api/busy-dates.js already uses, so
         this section still renders (all-zero stats) before the
         one-time SQL setup step has been run. */
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

  }catch(error){

    console.error(error);

    return res.status(500).json({
      error: error.message || "Internal server error"
    });

  }

}
