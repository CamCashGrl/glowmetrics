-- Create blog_posts table for storing blog content
-- Used by /api/blog-webhook and /app/blog/[slug]/page.js

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  meta_description text DEFAULT '',
  tags text[] DEFAULT '{}',
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX idx_blog_posts_published ON public.blog_posts(published);
CREATE INDEX idx_blog_posts_created_at ON public.blog_posts(created_at DESC);
CREATE INDEX idx_blog_posts_updated_at ON public.blog_posts(updated_at DESC);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Policies: Everyone can read published posts
CREATE POLICY "anyone_read_published_blog_posts"
  ON public.blog_posts
  FOR SELECT
  USING (published = true);

-- Service role can manage all blog posts (for webhook)
CREATE POLICY "service_role_manage_blog_posts"
  ON public.blog_posts
  USING (auth.role() = 'service_role');
