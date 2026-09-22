// Client-side export helpers for the Tip Menu Generator. Everything here is
// pure string formatting from data already in the client — no network call,
// no server round trip, nothing to leak.

import { TIP_MENU_EXPORT_THEMES as THEME_COLORS } from "@/lib/theme/colors"

const VISIBILITY_LABEL = {
  public: '',
  private_only: ' (private only)',
  approval_required: ' (custom — approval required)',
}

function fmtPrice(price, currencyType) {
  if (currencyType === 'dollars' || currencyType === 'custom') return `$${price}`
  return `${price} ${currencyType === 'credits' ? 'credits' : 'tokens'}`
}

function fmtDuration(seconds) {
  if (!seconds) return ''
  if (seconds < 60) return ` · ${seconds}s`
  return ` · ${Math.round(seconds / 60)}min`
}

function fmtCooldown(minutes) {
  if (!minutes) return ''
  return ` · once per ${minutes}min`
}

function groupByCategory(items) {
  const groups = new Map()
  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, [])
    groups.get(item.category).push(item)
  }
  return groups
}

export function toPlainText(menu) {
  const lines = []
  lines.push(menu.title || 'Tip Menu')
  if (menu.intro) lines.push(menu.intro)
  lines.push('')
  for (const [category, items] of groupByCategory(menu.items)) {
    lines.push(category.toUpperCase())
    for (const item of items) {
      lines.push(`${fmtPrice(item.price, menu.currencyType)} — ${item.name}${VISIBILITY_LABEL[item.visibility] || ''}`)
      if (item.description) lines.push(`  ${item.description}`)
    }
    lines.push('')
  }
  if (menu.rules?.length) {
    lines.push('RULES')
    for (const r of menu.rules) lines.push(`- ${r}`)
    lines.push('')
  }
  if (menu.closingCta) lines.push(menu.closingCta)
  return lines.join('\n').trim()
}

export function toFormattedText(menu) {
  const lines = []
  lines.push(`✨ ${menu.title || 'Tip Menu'} ✨`)
  if (menu.intro) lines.push(menu.intro)
  lines.push('')
  for (const [category, items] of groupByCategory(menu.items)) {
    lines.push(`── ${category} ──`)
    for (const item of items) {
      lines.push(`${fmtPrice(item.price, menu.currencyType)} — ${item.name}${VISIBILITY_LABEL[item.visibility] || ''}${fmtDuration(item.durationSeconds)}${fmtCooldown(item.cooldownMinutes)}`)
      if (item.description) lines.push(`   ${item.description}`)
    }
    lines.push('')
  }
  if (menu.rules?.length) {
    lines.push('📋 Rules')
    for (const r of menu.rules) lines.push(`• ${r}`)
    lines.push('')
  }
  if (menu.closingCta) lines.push(`💗 ${menu.closingCta}`)
  return lines.join('\n').trim()
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}


export function toHTML(menu, { themeId = 'dark_neon', customColors, brandName } = {}) {
  const c = themeId === 'custom' && customColors ? customColors : (THEME_COLORS[themeId] || THEME_COLORS.dark_neon)
  const categories = [...groupByCategory(menu.items).entries()]
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(menu.title || 'Tip Menu')}</title>
<style>
  body { background:${c.bg}; color:${c.text}; font-family: 'Segoe UI', Arial, sans-serif; margin:0; padding:32px 16px; }
  .wrap { max-width:640px; margin:0 auto; }
  h1 { font-size:26px; text-align:center; background:linear-gradient(90deg,${c.accent},${c.accent2}); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:6px; }
  .intro { text-align:center; color:${c.muted}; margin-bottom:24px; font-size:14px; }
  .cat { font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:${c.accent}; margin:20px 0 8px; font-weight:700; }
  .item { background:${c.card}; border:1px solid ${c.accent}33; border-radius:12px; padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; gap:12px; }
  .item .name { font-weight:700; }
  .item .desc { color:${c.muted}; font-size:13px; margin-top:2px; }
  .price { font-weight:800; color:${c.accent2}; white-space:nowrap; }
  .rules { margin-top:24px; font-size:13px; color:${c.muted}; }
  .cta { text-align:center; margin-top:28px; font-weight:700; color:${c.accent}; }
  .brand { text-align:center; font-size:11px; color:${c.muted}; margin-top:20px; letter-spacing:0.1em; text-transform:uppercase; }
</style></head>
<body><div class="wrap">
  <h1>${esc(menu.title || 'Tip Menu')}</h1>
  ${menu.intro ? `<div class="intro">${esc(menu.intro)}</div>` : ''}
  ${categories.map(([category, items]) => `
    <div class="cat">${esc(category)}</div>
    ${items.map(item => `
      <div class="item">
        <div><div class="name">${esc(item.name)}${VISIBILITY_LABEL[item.visibility] ? ` <em>${esc(VISIBILITY_LABEL[item.visibility])}</em>` : ''}</div>${item.description ? `<div class="desc">${esc(item.description)}</div>` : ''}</div>
        <div class="price">${esc(fmtPrice(item.price, menu.currencyType))}</div>
      </div>`).join('')}
  `).join('')}
  ${menu.rules?.length ? `<div class="rules"><strong>Rules:</strong> ${menu.rules.map(esc).join(' · ')}</div>` : ''}
  ${menu.closingCta ? `<div class="cta">${esc(menu.closingCta)}</div>` : ''}
  ${brandName ? `<div class="brand">${esc(brandName)}</div>` : ''}
</div></body></html>`
}

export function toRoomText(menu, platform) {
  // Compact single-block format for pasting into a room bio/topic field —
  // most cam platforms cap this at a few hundred characters, so keep it tight.
  const parts = menu.items.map(item => `${fmtPrice(item.price, menu.currencyType)}=${item.name}`)
  const header = platform ? `[${menu.title || 'Tip Menu'}] ` : `${menu.title || 'Tip Menu'} — `
  return `${header}${parts.join(' | ')}`
}

export function toSocialPost(menu, brandName) {
  const top = [...menu.items].sort((a, b) => a.price - b.price).slice(0, 5)
  const lines = [
    `${brandName ? brandName + ' — ' : ''}${menu.title || 'New Tip Menu'} is live! 💫`,
    '',
    ...top.map(item => `${fmtPrice(item.price, menu.currencyType)} — ${item.name}`),
    '',
    menu.closingCta || 'Come play! 💗',
  ]
  return lines.join('\n')
}

export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text)
}

export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
