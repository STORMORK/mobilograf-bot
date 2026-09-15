/* Shared upload validation for site-block media and portfolio media.
   Two independent whitelists (MIME type, file extension) must both pass
   and must agree with each other - the browser's own claims about a
   file are never trusted alone. The actual stored filename/extension is
   always derived here from the validated MIME type, never from
   whatever the client calls the file. */

const EXT_GROUPS = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "video/mp4": ["mp4"],
  "video/webm": ["webm"]
};

const MIME_TO_KIND = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "gif",
  "video/mp4": "video",
  "video/webm": "video"
};

const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm"
};

const MAX_BYTES_BY_KIND = {
  image: 10 * 1024 * 1024,
  gif: 5 * 1024 * 1024,
  video: 20 * 1024 * 1024
};


function classifyMime(mimeType){
  return MIME_TO_KIND[mimeType] || null;
}


/* Returns { kind, ext } on success or { error } on rejection. Never
   throws - callers turn a returned error straight into a 400 response. */
function validateUpload({ mimeType, fileName, fileSize }){

  if(typeof mimeType !== "string" || !MIME_TO_KIND[mimeType]){
    return { error: "Unsupported file type" + (mimeType ? `: ${mimeType}` : "") };
  }

  const kind = MIME_TO_KIND[mimeType];

  if(
    typeof fileSize !== "number" ||
    !Number.isFinite(fileSize) ||
    fileSize <= 0
  ){
    return { error: "Invalid file size" };
  }

  const maxBytes = MAX_BYTES_BY_KIND[kind];

  if(fileSize > maxBytes){
    return {
      error: `File too large for ${kind} (max ${Math.round(maxBytes / (1024 * 1024))} MB)`
    };
  }

  if(typeof fileName === "string" && fileName.includes(".")){

    const nameExt =
      fileName.split(".").pop().toLowerCase();

    const allowedExts = EXT_GROUPS[mimeType] || [];

    if(!allowedExts.includes(nameExt)){
      return {
        error: `File extension ".${nameExt}" does not match declared type ${mimeType}`
      };
    }

  }

  return { kind, ext: MIME_TO_EXT[mimeType] };

}


function randomFileId(){

  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 12)
  );

}


module.exports = {
  classifyMime,
  validateUpload,
  randomFileId,
  MAX_BYTES_BY_KIND,
  MIME_TO_EXT,
  MIME_TO_KIND
};
