const { requireAdmin } = require("./_lib/telegramAuth");
const { createSignedUploadUrl, publicUrlFor } = require("./_lib/supabase");
const { validateUpload, randomFileId } = require("./_lib/mediaValidation");
const { MEDIA_BLOCKS } = require("../content-schema.js");

/* Step 1 of the direct-to-Storage upload flow (see README): the browser
   asks this endpoint for a signed upload URL instead of posting the file
   itself through this serverless function - large videos would risk
   Vercel's request size/timeout limits otherwise. This endpoint only
   ever sees the file's declared type/name/size, never its bytes. */

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
    const blockId = body.blockId;

    if(typeof blockId !== "string" || !isKnownBlock(blockId)){
      return res.status(400).json({ error: "Unknown block: " + blockId });
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
      `blocks/${blockId}/${randomFileId()}.${validation.ext}`;

    let signed;

    try{

      signed = await createSignedUploadUrl(path);

    }catch(error){

      return res.status(502).json({
        error: "Storage error",
        details: error.message
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

    return res.status(500).json({
      error: "Internal server error",
      details: error.message
    });

  }

}
