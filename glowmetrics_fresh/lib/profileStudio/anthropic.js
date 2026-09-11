// Server-side only. Never import this from a client component — it reads
// ANTHROPIC_API_KEY, which must never reach the browser bundle.
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-opus-4-8'

/**
 * Calls Claude with a JSON-schema-constrained output and returns the parsed
 * object. Throws a sanitized Error (safe to surface to the client as-is) on
 * any failure — never leaks the raw Anthropic error body or stack.
 */
export async function generateStructuredContent({ prompt, schema, maxTokens = 4096 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not configured')
    throw new Error('Generation is temporarily unavailable. Please try again shortly.')
  }

  let res
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        output_config: { format: { type: 'json_schema', schema } },
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (err) {
    console.error('Anthropic API request failed', err.message)
    throw new Error('Generation failed. Please try again.')
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('Anthropic API error', res.status, errText.slice(0, 500))
    throw new Error('Generation failed. Please try again.')
  }

  const data = await res.json()

  if (data.stop_reason === 'refusal') {
    throw new Error('This request could not be generated safely. Please adjust your inputs and try again.')
  }

  const text = data.content?.[0]?.text
  if (!text) {
    console.error('Anthropic API returned no text content', JSON.stringify(data).slice(0, 300))
    throw new Error('Generation returned an empty response. Please try again.')
  }

  try {
    return JSON.parse(text)
  } catch (err) {
    console.error('Failed to parse Anthropic JSON output', err.message)
    throw new Error('Generation returned an unexpected format. Please try again.')
  }
}
