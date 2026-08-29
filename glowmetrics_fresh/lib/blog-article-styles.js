// Shared presentation for long-form blog articles.
//
// These styles were previously re-declared inside every article file, which
// made the posts look templated in the source as well as on the page. Content
// architecture is now decided per article by search intent; only the visual
// system is shared.

export const s = {
  h1: { fontSize: 29, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2, marginBottom: 14 },
  intro: { fontSize: 16, lineHeight: 1.75, color: '#cbd5e1', marginBottom: 32, paddingLeft: 14, borderLeft: '3px solid #22d3ee' },
  h2: { fontSize: 21, fontWeight: 700, color: '#e2e8f0', marginBottom: 10, marginTop: 40 },
  h3: { fontSize: 17, fontWeight: 700, color: '#e2e8f0', marginBottom: 8, marginTop: 28 },
  p: { fontSize: 15, lineHeight: 1.75, color: '#94a3b8', marginBottom: 14 },
  ul: { paddingLeft: 20, marginBottom: 16 },
  ol: { paddingLeft: 20, marginBottom: 16 },
  li: { fontSize: 15, lineHeight: 1.7, color: '#94a3b8', marginBottom: 8 },
  meta: { fontSize: 12, color: '#475569', marginBottom: 28, display: 'flex', gap: 16, flexWrap: 'wrap' },
  link: { color: '#67e8f9', textDecoration: 'none' },
  strong: { color: '#f1f5f9' },

  // Direct-answer block for question/snippet articles.
  answer: { padding: '18px 20px', borderRadius: 10, background: 'rgba(34,211,238,.08)', border: '1px solid rgba(34,211,238,.22)', marginBottom: 26, fontSize: 16, lineHeight: 1.7, color: '#e2e8f0' },

  // Cautionary/verify-this callout.
  note: { padding: '12px 16px', borderRadius: 8, background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.20)', marginBottom: 18, fontSize: 14.5, lineHeight: 1.7, color: '#cbd5e1' },

  // Numbered setup step.
  step: { padding: '16px 18px', borderRadius: 10, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.07)', marginBottom: 12 },
  stepNum: { display: 'inline-block', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: '#22d3ee', marginBottom: 6 },

  // Comparison / spec table.
  tableWrap: { overflowX: 'auto', marginBottom: 20, border: '1px solid rgba(255,255,255,.08)', borderRadius: 10 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 14.5 },
  th: { textAlign: 'left', padding: '10px 14px', color: '#94a3b8', fontWeight: 700, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.08)', whiteSpace: 'nowrap' },
  td: { padding: '10px 14px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,.04)', verticalAlign: 'top', lineHeight: 1.6 },

  cta: { background: 'linear-gradient(135deg,rgba(34,211,238,.1),rgba(124,92,255,.08))', border: '1px solid rgba(34,211,238,.22)', borderRadius: 14, padding: '26px 24px', margin: '40px 0 30px' },
  ctaTitle: { fontSize: 17, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 },
  ctaText: { fontSize: 14.5, lineHeight: 1.7, color: '#94a3b8', marginBottom: 16 },
  ctaBtn: { display: 'inline-block', padding: '11px 22px', borderRadius: 9, background: 'linear-gradient(135deg,#22d3ee,#7c5cff)', color: '#04121a', fontWeight: 800, fontSize: 14.5, textDecoration: 'none' },

  faq: { marginTop: 48, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,.06)' },
  faqItem: { marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,.04)' },
  faqQ: { fontSize: 15, fontWeight: 600, color: '#c7d2fe', marginBottom: 8 },
  faqA: { fontSize: 14, color: '#94a3b8', lineHeight: 1.75 },

  related: { marginTop: 44, paddingTop: 26, borderTop: '1px solid rgba(255,255,255,.06)' },
  relatedTitle: { fontSize: 13, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#64748b', marginBottom: 12 },
}

// Builds the Article + optional FAQPage JSON-LD for a post.
// Pass the same FAQ array that renders visibly so the two never drift.
export function articleSchema({ title, description, slug, faqs, datePublished = '2026-08-26', dateModified = '2026-08-26' }) {
  const url = `https://www.camcashgrl.com/blog/${slug}`
  const graph = [{
    '@type': 'Article',
    headline: title,
    description,
    url,
    datePublished,
    dateModified,
    author: { '@type': 'Organization', name: 'CamCash', url: 'https://www.camcashgrl.com' },
    publisher: { '@type': 'Organization', name: 'CamCash', url: 'https://www.camcashgrl.com' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }]
  if (faqs && faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    })
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}

// Standard metadata block. Titles must NOT end in "| CamCash" — the root
// layout applies a '%s | CamCash' template and would double it.
export function articleMeta({ title, description, slug }) {
  const url = `https://www.camcashgrl.com/blog/${slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | CamCash`, description, url, type: 'article',
      images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: `${title} | CamCash`, description },
  }
}
