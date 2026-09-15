/* Public read endpoint (no Telegram auth - same pattern as
   api/site-content.js) used by index.html to render the portfolio
   gallery. Returns every portfolio_items row with its portfolio_media
   rows embedded, both already ordered by sort_order via PostgREST's
   embedded-resource ordering. */

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

    const query =
      "select=id,title_ua,title_ru,title_en,description_ua,description_ru,description_en,sort_order," +
      "portfolio_media(id,url,media_type,mime_type,file_name,file_size,sort_order)" +
      "&order=sort_order.asc&portfolio_media.order=sort_order.asc";

    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/portfolio_items?${query}`,
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

      /* The portfolio tables may not exist yet on a site that hasn't run
         the SQL from README.md - treat that the same way site-content.js
         treats a fresh install: an empty portfolio, not a hard error, so
         the rest of the page still renders normally. */
      return res.status(200).json([]);

    }

    return res.status(200).json(Array.isArray(data) ? data : []);

  }catch(error){

    console.error(error);

    return res.status(200).json([]);

  }

}
