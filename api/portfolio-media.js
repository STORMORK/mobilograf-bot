const { requireAdmin } = require("./_lib/telegramAuth");
const { pgRequest, publicUrlFor, deleteStorageObjects } = require("./_lib/supabase");
const { MIME_TO_KIND } = require("./_lib/mediaValidation");

/* Manages individual files inside a portfolio work: commit an uploaded
   file as a new portfolio_media row, delete one, or reorder them. No
   limit on how many rows one portfolio_item_id can have - the schema
   and this endpoint place no artificial cap, only the per-file size
   limits already enforced in portfolio-upload-url.js. */

async function nextSortOrder(portfolioItemId){

  const rows =
    await pgRequest("portfolio_media", {
      method: "GET",
      query: `portfolio_item_id=eq.${encodeURIComponent(portfolioItemId)}&select=sort_order&order=sort_order.desc&limit=1`
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

    if(req.method !== "POST"){
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};
    const action = body.action;


    if(action === "add"){

      const portfolioItemId = body.portfolioItemId;
      const path = body.path;
      const mimeType = body.mimeType;

      if(typeof portfolioItemId !== "string" || portfolioItemId.length === 0){
        return res.status(400).json({ error: "Missing portfolioItemId" });
      }

      if(
        typeof path !== "string" ||
        !path.startsWith(`portfolio/${portfolioItemId}/`)
      ){
        return res.status(400).json({ error: "Invalid storage path for this portfolio item" });
      }

      if(typeof mimeType !== "string" || !MIME_TO_KIND[mimeType]){
        return res.status(400).json({ error: "Invalid or unsupported mimeType" });
      }

      const fileName =
        typeof body.fileName === "string" ? body.fileName.slice(0, 200) : "";

      const fileSize =
        typeof body.fileSize === "number" && Number.isFinite(body.fileSize)
          ? body.fileSize
          : 0;

      const sortOrder = await nextSortOrder(portfolioItemId);

      const inserted =
        await pgRequest("portfolio_media", {
          method: "POST",
          prefer: "return=representation",
          body: {
            portfolio_item_id: portfolioItemId,
            url: publicUrlFor(path),
            storage_path: path,
            media_type: MIME_TO_KIND[mimeType],
            mime_type: mimeType,
            file_name: fileName,
            file_size: fileSize,
            sort_order: sortOrder
          }
        });

      return res.status(200).json({ success: true, media: inserted[0] });

    }


    if(action === "delete"){

      const id = body.id;

      if(typeof id !== "string" || id.length === 0){
        return res.status(400).json({ error: "Missing id" });
      }

      const rows =
        await pgRequest("portfolio_media", {
          method: "GET",
          query: `id=eq.${encodeURIComponent(id)}&select=storage_path`
        });

      if(!rows || rows.length === 0){
        return res.status(404).json({ error: "Media not found" });
      }

      await pgRequest("portfolio_media", {
        method: "DELETE",
        query: `id=eq.${encodeURIComponent(id)}`
      });

      if(rows[0].storage_path){
        await deleteStorageObjects([rows[0].storage_path]);
      }

      return res.status(200).json({ success: true });

    }


    if(action === "reorder"){

      const portfolioItemId = body.portfolioItemId;
      const order = body.order;

      if(typeof portfolioItemId !== "string" || portfolioItemId.length === 0){
        return res.status(400).json({ error: "Missing portfolioItemId" });
      }

      if(!Array.isArray(order) || order.length === 0){
        return res.status(400).json({ error: "order must be a non-empty array of media ids" });
      }

      await Promise.all(
        order.map(function(id, index){

          return pgRequest("portfolio_media", {
            method: "PATCH",
            query: `id=eq.${encodeURIComponent(id)}&portfolio_item_id=eq.${encodeURIComponent(portfolioItemId)}`,
            body: { sort_order: index }
          });

        })
      );

      return res.status(200).json({ success: true });

    }


    return res.status(400).json({ error: "Unknown action: " + action });


  }catch(error){

    console.error(error);

    return res.status(500).json({
      error: "Internal server error",
      details: error.message
    });

  }

}
