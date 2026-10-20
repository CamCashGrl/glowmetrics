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

test('HTTP 413 gets a retry-safe file-too-large response', async () => {
  const expected = { error: UPLOAD_TOO_LARGE_ERROR, code: 'upload_too_large', retrySafe: true }
  expect(await readUploadJson(res(413, 'Request Entity Too Large'))).toEqual(expected)
  expect(await readUploadJson(res(413, ''))).toEqual(expected)
})

test('an empty failed response is marked safe to retry', async () => {
  const expected = { error: UPLOAD_NO_RESPONSE_ERROR, code: 'upload_interrupted', retrySafe: true }
  expect(await readUploadJson(res(502, ''))).toEqual(expected)
  expect(await readUploadJson(res(500, ''))).toEqual(expected)
})

test('a 504 error page is marked safe to retry', async () => {
  expect(await readUploadJson(res(504, '<html>An error occurred</html>'))).toEqual({
    error: UPLOAD_NO_RESPONSE_ERROR,
    code: 'upload_interrupted',
    retrySafe: true,
  })
})

test('recovery copy explains that dedupe prevents duplicate tips', () => {
  expect(UPLOAD_TOO_LARGE_ERROR).toMatch(/already imported will be skipped, not duplicated/i)
  expect(UPLOAD_NO_RESPONSE_ERROR).toMatch(/already imported will be skipped/i)
})

test('other non-JSON failures name the HTTP status', async () => {
  expect(await readUploadJson(res(500, '<!DOCTYPE html>Internal Server Error')))
    .toEqual({ error: 'Server returned an unreadable response (HTTP 500).' })
})

test('an empty successful response is not turned into an error', async () => {
  expect(await readUploadJson(res(200, ''))).toEqual({})
})
