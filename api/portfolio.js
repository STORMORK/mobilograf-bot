const { requireAdmin } = require("./_lib/telegramAuth");
const { pgRequest, deleteStorageObjects } = require("./_lib/supabase");

/* CRUD for portfolio_items (title/description only - see
   portfolio-media.js for the files inside a work). Requires the
   portfolio_items / portfolio_media tables from README.md to exist;
   until they do, every action here fails with a Supabase 404/relation
   error surfaced as-is, same as admin-content.js does for a missing
   content_i18n column. */

const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 3000;
const TEXT_FIELDS = [
  "title_ua", "title_ru", "title_en",
  "description_ua", "description_ru", "description_en"
];


function validateTextField(key, value){

  if(value === undefined){
    return { skip: true };
  }

  if(typeof value !== "string"){
    return { error: `${key} must be a string` };
  }

  const maxLength =
    key.startsWith("title_") ? MAX_TITLE_LENGTH : MAX_DESCRIPTION_LENGTH;

  if(value.length > maxLength){
    return { error: `${key} is too long (max ${maxLength} characters)` };
  }

  return { value: value };

}


async function nextSortOrder(){

  const rows =
    await pgRequest("portfolio_items", {
      method: "GET",
      query: "select=sort_order&order=sort_order.desc&limit=1"
    });

  if(!rows || rows.length === 0){
    return 0;
  }

  return (rows[0].sort_order || 0) + 1;

}


export default async function handler(req, res){

  try{

    const auth = requireAdmin(req);

    if(auth.error){
      return res.status(auth.status).json({ error: auth.error });
    }

    if(req.method === "GET"){

      const rows =
        await pgRequest("portfolio_items", {
          method: "GET",
          query: "select=*,portfolio_media(*)&order=sort_order.asc&portfolio_media.order=sort_order.asc"
        });

      return res.status(200).json({ success: true, items: rows || [] });

    }

    if(req.method !== "POST"){
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};
    const action = body.action;


    if(action === "create"){

      const sortOrder = await nextSortOrder();

      const inserted =
        await pgRequest("portfolio_items", {
          method: "POST",
          prefer: "return=representation",
          body: {
            title_ua: "", title_ru: "", title_en: "",
            description_ua: "", description_ru: "", description_en: "",
            sort_order: sortOrder
          }
        });

      return res.status(200).json({ success: true, item: inserted[0] });

    }


    if(action === "update"){

      const id = body.id;

      if(typeof id !== "string" || id.length === 0){
        return res.status(400).json({ error: "Missing id" });
      }

      const updates = { updated_at: new Date().toISOString() };

      for(const field of TEXT_FIELDS){

        const result = validateTextField(field, body[field]);

        if(result.error){
          return res.status(400).json({ error: result.error });
        }

        if(!result.skip){
          updates[field] = result.value;
        }

      }

      const updated =
        await pgRequest("portfolio_items", {
          method: "PATCH",
          query: `id=eq.${encodeURIComponent(id)}`,
          prefer: "return=representation",
          body: updates
        });

      if(!updated || updated.length === 0){
        return res.status(404).json({ error: "Portfolio item not found" });
      }

      return res.status(200).json({ success: true, item: updated[0] });

    }


    if(action === "delete"){

      const id = body.id;

      if(typeof id !== "string" || id.length === 0){
        return res.status(400).json({ error: "Missing id" });
      }

      const mediaRows =
        await pgRequest("portfolio_media", {
          method: "GET",
          query: `portfolio_item_id=eq.${encodeURIComponent(id)}&select=storage_path`
        });

      const paths =
        (mediaRows || [])
          .map(function(row){ return row.storage_path; })
          .filter(Boolean);

      await pgRequest("portfolio_items", {
        method: "DELETE",
        query: `id=eq.${encodeURIComponent(id)}`
      });

      if(paths.length > 0){
        await deleteStorageObjects(paths);
      }

      return res.status(200).json({ success: true });

    }


    if(action === "reorder"){

      const order = body.order;

      if(!Array.isArray(order) || order.length === 0){
        return res.status(400).json({ error: "order must be a non-empty array of ids" });
      }

      await Promise.all(
        order.map(function(id, index){

          return pgRequest("portfolio_items", {
            method: "PATCH",
            query: `id=eq.${encodeURIComponent(id)}`,
            body: { sort_order: index }
          });

        })
      );

      return res.status(200).json({ success: true });

    }


    return res.status(400).json({ error: "Unknown action: " + action });


  }catch(error){

    console.error(error);

    /* error.message is already a clear, actionable reason for the two
       most likely real-world causes here - a missing "site-media"
       Storage bucket or missing portfolio tables (see
       _lib/supabase.js's buildSupabaseErrorMessage) - so it goes
       straight into "error" instead of being hidden behind a generic
       "Internal server error" label with the real reason buried in a
       separate "details" field admin.html would have to know to read. */
    return res.status(500).json({
      error: error.message || "Internal server error"
    });

  }

}
