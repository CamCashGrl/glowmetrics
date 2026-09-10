import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { name } = await req.json()
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `You are a creator branding expert. Analyze this cam model stage name: '${name}'. Respond in JSON only with this exact structure (no markdown, no code blocks, raw JSON only):
{"strengths":["strength1","strength2","strength3"],"weaknesses":["weakness1","weakness2"],"recommendation":"one sentence recommendation","best_for":"one sentence about ideal use case"}`,
        }],
      }),
    })

    if (!res.ok) throw new Error('Anthropic API error: ' + res.status)

    const data = await res.json()
    const text = data.content?.[0]?.text || '{}'
    const parsed = JSON.parse(text)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Branding advisor error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
