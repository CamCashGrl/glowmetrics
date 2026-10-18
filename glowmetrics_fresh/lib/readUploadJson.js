// Read an /api/upload* response without trusting it to be JSON.
//
// A too-large (413), timed-out (504) or crashed upload gets a platform error
// page or an empty body instead of our JSON, and res.json() then throws a raw
// "JSON.parse: unexpected character" error that reads as a broken CSV. Read as
// text first and turn those into a message that says what really happened.
// Re-uploading the same complete export is safe because the import RPCs are
// deduplicating; rows that already landed are skipped rather than duplicated.
export const UPLOAD_TOO_LARGE_ERROR =
  'This file is too large to reach CamCash in one upload. Try a smaller date range. Re-uploading the same export is safe — tips already imported will be skipped, not duplicated.'
export const UPLOAD_NO_RESPONSE_ERROR =
  'The import stopped before CamCash could finish responding. You can safely try the same file again — tips that already imported will be skipped — or use a smaller date range if it keeps happening.'

export async function readUploadJson(res) {
  const raw = await res.text()
  if (raw) {
    try { return JSON.parse(raw) } catch {}
  }
  // An empty 2xx body keeps its old meaning (no fields, not an error).
  if (!raw && res.ok) return {}
  if (res.status === 413) return { error: UPLOAD_TOO_LARGE_ERROR, code: 'upload_too_large', retrySafe: true }
  if (res.status === 504 || !raw) return { error: UPLOAD_NO_RESPONSE_ERROR, code: 'upload_interrupted', retrySafe: true }
  return { error: `Server returned an unreadable response (HTTP ${res.status}).` }
}
