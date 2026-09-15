/* Shared Supabase REST/Storage helpers for all admin API endpoints.
   SUPABASE_SECRET_KEY is read from process.env here and never returned
   to any caller - every function returns only the data Supabase gives
   back, or throws an Error with Supabase's own message. */

const STORAGE_BUCKET = "site-media";


function supabaseUrl(){
  return process.env.SUPABASE_URL;
}


function authHeaders(extra){

  return Object.assign(
    {
      apikey: process.env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`
    },
    extra || {}
  );

}


/* ---------- site_content (existing table, unchanged shape) ---------- */

async function getSiteContentRow(){

  const response =
    await fetch(
      `${supabaseUrl()}/rest/v1/site_content?id=eq.1&select=*`,
      {
        method: "GET",
        headers: authHeaders()
      }
    );

  const data = await response.json();

  if(!response.ok){
    throw new Error(JSON.stringify(data));
  }

  return data[0] || null;

}


/* Merge-safe write: content_i18n is one jsonb column shared by the
   universal text editor AND site media metadata (content_i18n.media).
   A naive PATCH would replace the whole column with whatever the
   current caller sent, silently wiping out whichever of those two the
   caller didn't include. This always reads the current column first and
   shallow-merges the caller's top-level keys into it, so a text-only
   save can never erase media and a media-only save can never erase
   text. flatFields (phone/telegram/instagram/location, etc.) are applied
   as-is alongside it in the same PATCH, exactly like before. */
async function patchSiteContent(contentI18nPatch, flatFields){

  const updates = Object.assign({}, flatFields || {});

  if(contentI18nPatch !== undefined && contentI18nPatch !== null){

    const existing = await getSiteContentRow();
    const existingContentI18n = (existing && existing.content_i18n) || {};

    updates.content_i18n =
      Object.assign({}, existingContentI18n, contentI18nPatch);

  }

  if(Object.keys(updates).length === 0){
    throw new Error("No fields to update");
  }

  const response =
    await fetch(
      `${supabaseUrl()}/rest/v1/site_content?id=eq.1`,
      {
        method: "PATCH",

        headers: authHeaders({
          "Content-Type": "application/json",
          Prefer: "return=representation"
        }),

        body: JSON.stringify(updates)
      }
    );

  const data = await response.json();

  if(!response.ok){
    throw new Error(JSON.stringify(data));
  }

  if(!Array.isArray(data) || data.length === 0){
    throw new Error("Supabase did not update row with id=1");
  }

  return data[0];

}


/* ---------- generic PostgREST helper (portfolio_items / portfolio_media) ---------- */

async function pgRequest(table, { method, query, body, prefer }){

  const url =
    `${supabaseUrl()}/rest/v1/${table}${query ? "?" + query : ""}`;

  const headers = authHeaders({ "Content-Type": "application/json" });

  if(prefer){
    headers.Prefer = prefer;
  }

  const response =
    await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

  if(response.status === 204){
    return null;
  }

  const data = await response.json().catch(function(){ return null; });

  if(!response.ok){
    throw new Error(JSON.stringify(data));
  }

  return data;

}


/* ---------- Storage: signed upload URLs + delete ---------- */

async function createSignedUploadUrl(path){

  const response =
    await fetch(
      `${supabaseUrl()}/storage/v1/object/upload/sign/${STORAGE_BUCKET}/${path}`,
      {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({})
      }
    );

  const data = await response.json();

  if(!response.ok){
    throw new Error(JSON.stringify(data));
  }

  return data;

}


function publicUrlFor(path){
  return `${supabaseUrl()}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}


/* Best-effort delete: called when replacing/removing media. Failures are
   logged but never thrown - losing the metadata update over an orphaned
   Storage object would be a worse outcome than a small amount of
   leftover storage. */
async function deleteStorageObjects(paths){

  if(!paths || paths.length === 0){
    return;
  }

  try{

    const response =
      await fetch(
        `${supabaseUrl()}/storage/v1/object/${STORAGE_BUCKET}`,
        {
          method: "DELETE",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ prefixes: paths })
        }
      );

    if(!response.ok){
      const data = await response.json().catch(function(){ return null; });
      console.error("Storage delete failed:", JSON.stringify(data));
    }

  }catch(error){

    console.error("Storage delete error:", error.message);

  }

}


module.exports = {
  STORAGE_BUCKET,
  getSiteContentRow,
  patchSiteContent,
  pgRequest,
  createSignedUploadUrl,
  publicUrlFor,
  deleteStorageObjects
};
