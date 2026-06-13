import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ArticleLayout from '../../components/ArticleLayout'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function generateMetadata({ params }) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { title: 'Blog | CamCashGrl', description: 'Cam model tips, analytics guides, and earnings strategies.' }
    }
    const supabase = getSupabase()
    const { data } = await supabase
      .from('blog_posts')
      .select('title, meta_description, slug')
      .eq('slug', params.slug)
      .maybeSingle()
    if (!data) return { title: 'Blog | CamCashGrl', description: 'Cam model tips, analytics guides, and earnings strategies.' }
    return {
      title: data.title + ' | CamCash',
      description: data.meta_description,
      alternates: { canonical: `https://www.camcashgrl.com/blog/${data.slug}` },
    }
  } catch {
    return { title: 'Blog | CamCashGrl', description: 'Cam model tips, analytics guides, and earnings strategies.' }
  }
}

export default async function DynamicBlogPost({ params }) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      notFound()
    }
    const supabase = getSupabase()
    const { data: post } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', params.slug)
      .eq('published', true)
      .maybeSingle()

    if (!post) notFound()

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.meta_description,
      url: `https://www.camcashgrl.com/blog/${post.slug}`,
      datePublished: post.created_at,
      dateModified: post.updated_at,
      author: { '@type': 'Organization', name: 'CamCashGrl', url: 'https://www.camcashgrl.com' },
      publisher: { '@type': 'Organization', name: 'CamCashGrl', url: 'https://www.camcashgrl.com' },
    }

    return (
      <ArticleLayout
        schema={schema}
        breadcrumb={[{ label: 'Blog', href: '/blog' }, { label: post.title }]}
      >
        <div style={{ fontSize: '12px', color: '#475569', marginBottom: '28px', display: 'flex', gap: '16px' }}>
          <span>CamCashGrl</span>
          <span>{new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        </div>
        <h1 style={{ fontSize: '29px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2, marginBottom: '24px', letterSpacing: '-0.02em' }}>
          {post.title}
        </h1>
        <div
          style={{ fontSize: '15px', lineHeight: 1.75, color: '#94a3b8' }}
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </ArticleLayout>
    )
  } catch {
    notFound()
  }
}
