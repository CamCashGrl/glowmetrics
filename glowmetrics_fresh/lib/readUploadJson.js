// Read an /api/upload* response without trusting it to be JSON.
//
// A too-large (413), timed-out (504) or crashed upload gets a platform error
// page or an empty body instead of our JSON, and res.json() then throws a raw
// "JSON.parse: unexpected character" error that reads as a broken CSV. Read as
// text first and turn those into a message that says what really happened.
// Only touches error reporting — never the parsed rows or anything stored.
export const UPLOAD_TOO_LARGE_ERROR =
  'This file is too large to upload in one go. Try splitting it into smaller date ranges.'
export const UPLOAD_NO_RESPONSE_ERROR =
  'The server stopped responding while importing this file — it may be too large to process in one upload. Try splitting it into smaller date ranges.'

export async function readUploadJson(res) {
  const raw = await res.text()
  if (raw) {
    try { return JSON.parse(raw) } catch {}
  }
  // An empty 2xx body keeps its old meaning (no fields, not an error).
  if (!raw && res.ok) return {}
  if (res.status === 413) return { error: UPLOAD_TOO_LARGE_ERROR }
  if (res.status === 504 || !raw) return { error: UPLOAD_NO_RESPONSE_ERROR }
  return { error: `Server returned an unreadable response (HTTP ${res.status}).` }
}
