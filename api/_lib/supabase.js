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


/* Turns a raw Supabase REST/Storage error body into a message an admin
   can actually act on, instead of every caller propagating a generic
   500 "Internal server error". The known cases below are exactly the
   one-time manual setup steps documented in README.md (the bucket and
   the portfolio tables) and are the most likely real-world cause of a
   failure here - everything else still surfaces Supabase's own message
   rather than being swallowed.

   `requestLabel` identifies which exact outgoing request failed (e.g.
   "Storage: create signed upload URL", "DB: PATCH site_content") and is
   prefixed onto every message, so a failure reported by an admin can be
   traced to one call site without needing Vercel log access - this is
   deliberately part of the error text returned to the client, never a
   secret or Telegram initData.

   The raw {status, code, message, details, hint} is always logged via
   console.error (never suppressed), and the raw `message`/`error`/`hint`
   string is always appended to the friendly text rather than replacing
   it, so a pattern that isn't recognized below still shows everything
   Supabase actually said. */
function buildSupabaseErrorMessage(status, data, requestLabel, context){

  const raw =
    (data && (data.message || data.error || data.hint)) || "";

  console.error(
    "Supabase error [" + (requestLabel || "unknown request") + "]",
    "HTTP " + status,
    JSON.stringify(data)
  );

  const prefix = requestLabel ? `[${requestLabel}] ` : "";

  if(/bucket not found/i.test(raw)){
    return `${prefix}Storage bucket "${STORAGE_BUCKET}" не створено. Створіть публічний bucket "${STORAGE_BUCKET}" у Supabase Storage (Storage → New bucket → Public bucket). (${raw})`;
  }

  if(/could not find the table|schema cache|relation .* does not exist/i.test(raw)){
    return `${prefix}Потрібна таблиця ще не створена в Supabase. Виконайте відповідний SQL з README.md. (${raw})`;
  }

  /* Supabase Storage's own "RelatedResourceNotFound" error (thrown on a
     foreign-key violation when inserting/updating storage.objects, code
     23503) - it reads exactly "The related resource does not exist" and,
     unlike the plain-upload "Bucket not found" case above, is what some
     Storage endpoints (including the signed-upload-url "sign" endpoint
     used here) return when the bucket referenced in the request path
     does not exist or its name doesn't match exactly (case, extra
     spaces, a rename after this code was configured with "site-media"). */
  if(
    /related resource does not exist/i.test(raw) ||
    (data && data.statusCode === "23503") ||
    (data && data.code === "23503")
  ){

    if(context === "storage"){
      return `${prefix}Storage bucket "${STORAGE_BUCKET}" не знайдено (Supabase: "${raw}"). Перевірте, що bucket у Supabase Storage називається саме "${STORAGE_BUCKET}" (без відмінностей у регістрі чи пробілів) і що він не був перейменований/видалений.`;
    }

    return `${prefix}Supabase не знайшов пов'язаний запис у базі даних (${raw}). Перевірте, що рядок site_content з id=1 та потрібні таблиці існують.`;

  }

  if(raw){
    return `${prefix}${raw}`;
  }

  return `${prefix}Supabase error (HTTP ${status})`;

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

  const data = await response.json().catch(function(){ return null; });

  if(!response.ok){
    throw new Error(buildSupabaseErrorMessage(response.status, data, "DB: GET site_content", "db"));
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

  const data = await response.json().catch(function(){ return null; });

  if(!response.ok){
    throw new Error(buildSupabaseErrorMessage(response.status, data, "DB: PATCH site_content", "db"));
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
    throw new Error(buildSupabaseErrorMessage(response.status, data, `DB: ${method} ${table}`, "db"));
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

  const data = await response.json().catch(function(){ return null; });

  if(!response.ok){
    throw new Error(buildSupabaseErrorMessage(response.status, data, "Storage: create signed upload URL", "storage"));
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
      console.error("Supabase error [Storage: delete objects]", "HTTP " + response.status, JSON.stringify(data));
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
