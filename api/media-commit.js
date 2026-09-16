const { requireAdmin } = require("./_lib/telegramAuth");
const {
  getSiteContentRow,
  patchSiteContent,
  publicUrlFor,
  deleteStorageObjects,
  pgRequest
} = require("./_lib/supabase");
const { MIME_TO_KIND } = require("./_lib/mediaValidation");
const { MEDIA_BLOCKS } = require("../content-schema.js");

/* Step 2 of the upload flow: called after the browser has already PUT
   the file directly to the Storage signed URL from media-upload-url.js.
   This endpoint never receives file bytes - only metadata about a file
   that (by construction) can only live under blocks/<blockId>/ because
   media-upload-url.js is the only thing that ever generates that path.

   content_i18n.media.blocks is read, merged in-memory (so replacing one
   block's media never touches any other block's), and the *whole*
   resulting media object is handed to patchSiteContent() as the
   complete new value of the "media" top-level key - patchSiteContent's
   own shallow merge then guarantees this never touches unrelated
   content_i18n text keys either. */

function isKnownBlock(id){
  return MEDIA_BLOCKS.some(function(block){ return block.id === id; });
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
    const blockId = body.blockId;

    if(typeof blockId !== "string" || !isKnownBlock(blockId)){
      return res.status(400).json({ error: "Unknown block: " + blockId });
    }

    const existing = await getSiteContentRow();
    const existingMedia = (existing && existing.content_i18n && existing.content_i18n.media) || {};
    const existingBlocks = existingMedia.blocks || {};


    if(action === "delete"){

      const current = existingBlocks[blockId];

      const newBlocks = Object.assign({}, existingBlocks);
      delete newBlocks[blockId];

      const data =
        await patchSiteContent({ media: { blocks: newBlocks } });

      if(current && current.path){
        await deleteStorageObjects([current.path]);
      }

      return res.status(200).json({ success: true, data: data });

    }


    if(action === "save"){

      const path = body.path;
      const mimeType = body.mimeType;
      const fileName = body.fileName;
      const fileSize = body.fileSize;

      if(
        typeof path !== "string" ||
        !path.startsWith(`blocks/${blockId}/`)
      ){
        return res.status(400).json({ error: "Invalid storage path for this block" });
      }

      if(typeof mimeType !== "string" || !MIME_TO_KIND[mimeType]){
        return res.status(400).json({ error: "Invalid or unsupported mimeType" });
      }

      const previous = existingBlocks[blockId];

      const newEntry = {
        url: publicUrlFor(path),
        path: path,
        type: MIME_TO_KIND[mimeType],
        mime: mimeType,
        fileName: typeof fileName === "string" ? fileName.slice(0, 200) : "",
        fileSize: typeof fileSize === "number" && Number.isFinite(fileSize) ? fileSize : null,
        updatedAt: new Date().toISOString()
      };

      const newBlocks =
        Object.assign({}, existingBlocks, { [blockId]: newEntry });

      const data =
        await patchSiteContent({ media: { blocks: newBlocks } });

      if(previous && previous.path && previous.path !== path){
        await deleteStorageObjects([previous.path]);
      }

      return res.status(200).json({ success: true, data: data });

    }


    if(action === "save-from-portfolio"){

      /* Adopts an already-uploaded portfolio file as this block's
         media, with no re-upload and no new Storage object - looked
         up server-side by id (never trusting a client-supplied path)
         so this can't be used to point a block at an arbitrary
         Storage path. Deliberately has no "path" of its own: the
         portfolio file is shared, not moved, so neither replacing nor
         deleting this block's media should ever delete it - the
         existing cleanup below only ever acts on previous.path, which
         a borrowed entry never has. */

      const portfolioMediaId = body.portfolioMediaId;

      if(typeof portfolioMediaId !== "string" || portfolioMediaId.length === 0){
        return res.status(400).json({ error: "Missing portfolioMediaId" });
      }

      const rows =
        await pgRequest("portfolio_media", {
          method: "GET",
          query:
            "id=eq." + encodeURIComponent(portfolioMediaId) +
            "&select=url,media_type,mime_type,file_name,file_size"
        });

      if(!rows || rows.length === 0){
        return res.status(404).json({ error: "Portfolio media not found" });
      }

      const source = rows[0];

      const previous = existingBlocks[blockId];

      const newEntry = {
        url: source.url,
        type: source.media_type,
        mime: source.mime_type,
        fileName: source.file_name || "",
        fileSize: typeof source.file_size === "number" ? source.file_size : null,
        borrowedFromPortfolio: true,
        updatedAt: new Date().toISOString()
      };

      const newBlocks =
        Object.assign({}, existingBlocks, { [blockId]: newEntry });

      const data =
        await patchSiteContent({ media: { blocks: newBlocks } });

      if(previous && previous.path){
        await deleteStorageObjects([previous.path]);
      }

      return res.status(200).json({ success: true, data: data });

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
