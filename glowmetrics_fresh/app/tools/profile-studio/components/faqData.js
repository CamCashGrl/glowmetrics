// Plain data module (no 'use client') — importable from both the server
// page (for FAQPage JSON-LD) and the client FAQ accordion. A value export
// from a 'use client' module can't be read for its real content on the
// server side; Next's RSC bundler replaces it with an opaque client
// reference instead, so this has to live outside that boundary.
export const FAQS = [
  { q: 'Is the Bio Generator free?', a: 'Yes — generating bios and tip menus is free, with no account required. Creating an account only adds the ability to save and revisit your drafts.' },
  { q: 'Do I need to use my real name?', a: 'No. Use your display name or username — CamCash never asks for your legal name, address, or private contact details.' },
  { q: 'Will the generator include activities I did not select?', a: 'No. Output is checked server-side against your selected services and boundaries before it is shown to you.' },
  { q: 'How are tip-menu prices calculated?', a: 'Prices come from a deterministic pricing engine based on your chosen strategy, minimum/maximum price, and item count — the AI only writes the item names and descriptions, never the prices.' },
  { q: 'Can I make a non-nude tip menu?', a: 'Yes — choose non-nude-friendly categories in Step 3 and the menu will be built entirely around them.' },
  { q: 'Can I edit generated results?', a: 'Yes, every bio and tip menu item is editable after generation.' },
  { q: 'Can I create bios for multiple platforms?', a: 'Yes — pick a different platform format and generate again; your identity and persona details carry over.' },
  { q: 'Are my drafts saved?', a: 'Only when you are signed in. Signed-out generation works fully, but nothing is saved without an account.' },
  { q: 'What is included in Free?', a: 'Everything — bio generation, tip menu generation, editing, and export are all free right now.' },
  { q: 'What is included in Pro?', a: 'There is currently no paid tier for Creator Profile Studio — the full tool is free.' },
]

export const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}
