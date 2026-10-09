/**
 * /api/upload replies that are not our JSON (platform error pages, empty
 * bodies) must become a clear upload error, never a JSON parse crash or a
 * generic "Upload failed".
 */
import { readUploadJson, UPLOAD_TOO_LARGE_ERROR, UPLOAD_NO_RESPONSE_ERROR } from '../readUploadJson'

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => body })

test('valid JSON is returned as-is', async () => {
  expect(await readUploadJson(res(200, '{"inserted":5,"skipped":1}'))).toEqual({ inserted: 5, skipped: 1 })
  expect(await readUploadJson(res(400, '{"error":"No valid rows found. Check CSV format."}')))
    .toEqual({ error: 'No valid rows found. Check CSV format.' })
})

test('HTTP 413 gets its own file-too-large message', async () => {
  expect(await readUploadJson(res(413, 'Request Entity Too Large'))).toEqual({ error: UPLOAD_TOO_LARGE_ERROR })
  expect(await readUploadJson(res(413, ''))).toEqual({ error: UPLOAD_TOO_LARGE_ERROR })
})

test('an empty failed response reports the server stopped responding', async () => {
  expect(await readUploadJson(res(502, ''))).toEqual({ error: UPLOAD_NO_RESPONSE_ERROR })
  expect(await readUploadJson(res(500, ''))).toEqual({ error: UPLOAD_NO_RESPONSE_ERROR })
})

test('a 504 error page reports the server stopped responding', async () => {
  expect(await readUploadJson(res(504, '<html>An error occurred</html>'))).toEqual({ error: UPLOAD_NO_RESPONSE_ERROR })
})

test('other non-JSON failures name the HTTP status', async () => {
  expect(await readUploadJson(res(500, '<!DOCTYPE html>Internal Server Error')))
    .toEqual({ error: 'Server returned an unreadable response (HTTP 500).' })
})

test('an empty successful response is not turned into an error', async () => {
  expect(await readUploadJson(res(200, ''))).toEqual({})
})
