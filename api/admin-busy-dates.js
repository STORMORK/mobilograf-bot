const { requireAdmin } = require("./_lib/telegramAuth");
const { pgRequest } = require("./_lib/supabase");

/* Admin-only CRUD for busy_dates - the "📅 Календар" section in
   admin.html marking dates the mobilograf is unavailable. Requires the
   busy_dates table from README.md to exist; until it does, both
   methods fail with Supabase's own table-missing error, surfaced as-is
   the same way portfolio.js does for the portfolio tables. */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value){

  if(typeof value !== "string" || !DATE_PATTERN.test(value)){
    return false;
  }

  const parsed = new Date(value + "T00:00:00Z");

  return !Number.isNaN(parsed.getTime());

}


export default async function handler(req, res){

  try{

    const auth = requireAdmin(req);

    if(auth.error){
      return res.status(auth.status).json({ error: auth.error });
    }

    if(req.method === "GET"){

      const rows =
        await pgRequest("busy_dates", {
          method: "GET",
          query: "select=date&order=date.asc"
        });

      const dates =
        (rows || []).map(function(row){ return row.date; });

      return res.status(200).json({ success: true, dates: dates });

    }

    if(req.method !== "POST"){
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};
    const action = body.action;
    const date = body.date;

    if(!isValidDate(date)){
      return res.status(400).json({ error: "Invalid date (expected YYYY-MM-DD)" });
    }

    if(action === "add"){

      await pgRequest("busy_dates", {
        method: "POST",
        prefer: "return=minimal,resolution=ignore-duplicates",
        body: { date: date }
      });

      return res.status(200).json({ success: true });

    }

    if(action === "remove"){

      await pgRequest("busy_dates", {
        method: "DELETE",
        query: `date=eq.${encodeURIComponent(date)}`
      });

      return res.status(200).json({ success: true });

    }

    return res.status(400).json({ error: "Unknown action: " + action });

  }catch(error){

    console.error(error);

    return res.status(500).json({
      error: error.message || "Internal server error"
    });

  }

}
