/* Public read endpoint (no Telegram auth - same pattern as
   api/portfolio-list.js) used by index.html's booking form to grey out
   dates the mobilograf has already marked busy in admin.html's
   calendar. Only today-or-future dates are returned - a past busy date
   has no effect on what a new booking can select. */

export default async function handler(req, res){

  if(req.method !== "GET"){
    return res.status(405).json({ error: "Method not allowed" });
  }

  try{

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if(!supabaseUrl || !supabaseKey){

      return res.status(500).json({
        error: "Supabase environment variables are missing"
      });

    }

    const today = new Date().toISOString().slice(0, 10);

    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/busy_dates?select=date&date=gte.${today}&order=date.asc`,
        {
          method: "GET",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`
          }
        }
      );

    const data = await response.json();

    if(!response.ok){

      /* The busy_dates table may not exist yet on a site that hasn't run
         the SQL from README.md - treat that the same way portfolio-list.js
         treats missing portfolio tables: an empty list, not a hard error,
         so the booking form still works with no dates blocked. */
      return res.status(200).json([]);

    }

    const dates =
      Array.isArray(data)
        ? data.map(function(row){ return row.date; })
        : [];

    return res.status(200).json(dates);

  }catch(error){

    console.error(error);

    return res.status(200).json([]);

  }

}
