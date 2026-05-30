import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (token !== process.env.BLOG_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { title, content, slug, meta_description, tags } = body
    if (!title || !content) {
      return NextResponse.json({ error: 'Missing title or content' }, { status: 400 })
    }
    const cleanSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const { error } = await supabase
      .from('blog_posts')
      .upsert({
        title,
        slug: cleanSlug,
        content,
        meta_description: meta_description || '',
        tags: tags || [],
        published: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'slug' })
    if (error) throw error
    return NextResponse.json({ success: true, slug: cleanSlug })
  } catch (err) {
    console.error('Blog webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
