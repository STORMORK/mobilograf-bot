const { requireAdmin } = require("./_lib/telegramAuth");
const { createSignedUploadUrl, publicUrlFor, pgRequest } = require("./_lib/supabase");
const { validateUpload, randomFileId } = require("./_lib/mediaValidation");

/* Same signed-upload pattern as media-upload-url.js, but for files that
   belong to a specific portfolio work rather than a fixed site block.
   portfolioItemId is checked against the DB so a typo/bug can't create
   an upload path for a work that doesn't exist. */

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
    const portfolioItemId = body.portfolioItemId;

    if(typeof portfolioItemId !== "string" || portfolioItemId.length === 0){
      return res.status(400).json({ error: "Missing portfolioItemId" });
    }

    const items =
      await pgRequest("portfolio_items", {
        method: "GET",
        query: `id=eq.${encodeURIComponent(portfolioItemId)}&select=id`
      });

    if(!items || items.length === 0){
      return res.status(404).json({ error: "Portfolio item not found" });
    }

    const validation =
      validateUpload({
        mimeType: body.mimeType,
        fileName: body.fileName,
        fileSize: body.fileSize
      });

    if(validation.error){
      return res.status(400).json({ error: validation.error });
    }

    const path =
      `portfolio/${portfolioItemId}/${randomFileId()}.${validation.ext}`;

    let signed;

    try{

      signed = await createSignedUploadUrl(path);

    }catch(error){

      return res.status(502).json({
        error: error.message || "Storage error"
      });

    }

    return res.status(200).json({
      path: path,
      signedUrl: `${process.env.SUPABASE_URL}/storage/v1${signed.url}`,
      token: signed.token || null,
      publicUrl: publicUrlFor(path),
      kind: validation.kind
    });

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
