'use client'
import { useMemo, useState } from 'react'
import {
  T, Card, SectionLabel, FieldLabel, TextInput, TextArea, Select, SecondaryButton, PrimaryButton,
  IconButton, Badge, Toggle, ErrorBanner,
} from './theme'
import { TIP_MENU_CATEGORIES, MENU_THEMES } from '../../../../lib/profileStudio/constants'
import { toPlainText, toFormattedText, toHTML, toRoomText, toSocialPost, copyToClipboard, downloadFile } from '../lib/export'

function reindex(items) {
  return items.map((it, i) => ({ ...it, sortOrder: i }))
}

function ReviewPanel({ review, dismissed, onDismiss }) {
  if (!review) return null
  const items = (review.recommendations || []).filter(r => !dismissed.has(r))
  const scoreColor = review.score >= 80 ? T.green : review.score >= 60 ? T.gold : T.red
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionLabel style={{ marginBottom: 0 }}>Smart menu review</SectionLabel>
        <div style={{ fontSize: 20, fontWeight: 900, color: scoreColor }}>{review.score}<span style={{ fontSize: 11, color: T.faint, fontWeight: 600 }}>/100</span></div>
      </div>
      {review.issues?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {review.issues.map((issue, i) => (
            <div key={i} style={{ fontSize: 12.5, color: T.gold, marginBottom: 4 }}>⚠ {issue}</div>
          ))}
        </div>
      )}
      {items.length > 0 ? items.map((rec, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.borderSoft}` }}>
          <div style={{ fontSize: 12.5, color: T.soft, lineHeight: 1.5 }}>💡 {rec}</div>
          <button onClick={() => onDismiss(rec)} style={{ background: 'none', border: 'none', color: T.faint, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>Dismiss</button>
        </div>
      )) : <div style={{ fontSize: 12.5, color: T.faint }}>No open recommendations.</div>}
      {review.estimatedEarningPotential != null && (
        <div style={{ marginTop: 12, fontSize: 12, color: T.faint }}>Estimated earning potential if every item is tipped once: ${review.estimatedEarningPotential.toFixed(2)}</div>
      )}
    </Card>
  )
}

function ItemRow({ item, index, total, categories, onChange, onMove, onDuplicate, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="ps-fade" style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 10, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
          <IconButton title="Move up" onClick={() => onMove(index, -1)}>▲</IconButton>
          <IconButton title="Move down" onClick={() => onMove(index, 1)}>▼</IconButton>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{ flex: '2 1 160px' }}>
              <TextInput value={item.name} maxLength={80} onChange={e => onChange(index, { name: e.target.value })} placeholder="Item name" aria-label="Item name" />
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <TextInput type="number" min="0" value={item.price} onChange={e => onChange(index, { price: Number(e.target.value) || 0 })} aria-label="Price" />
            </div>
          </div>
          {!expanded ? (
            <p style={{ fontSize: 12.5, color: T.muted, margin: '0 0 6px' }}>{item.description}</p>
          ) : (
            <TextArea value={item.description} maxLength={300} onChange={e => onChange(index, { description: e.target.value })} style={{ minHeight: 60, marginBottom: 8 }} aria-label="Description" />
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge color={T.cyan}>{item.category}</Badge>
            <Badge color={item.visibility === 'public' ? T.green : item.visibility === 'private_only' ? T.pink : T.gold}>
              {item.visibility === 'public' ? 'Public' : item.visibility === 'private_only' ? 'Private only' : 'Approval required'}
            </Badge>
            <span style={{ fontSize: 11.5, color: T.faint }}>≈ ${Number(item.estimatedEarnings || 0).toFixed(2)} est. earnings</span>
          </div>

          {expanded && (
            <div className="ps-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <div>
                <FieldLabel>Category</FieldLabel>
                <Select aria-label={`Category for ${item.name}`} value={item.category} onChange={e => onChange(index, { category: e.target.value })}>
                  {[...new Set([item.category, ...categories])].map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <FieldLabel>Visibility</FieldLabel>
                <Select aria-label={`Visibility for ${item.name}`} value={item.visibility} onChange={e => onChange(index, { visibility: e.target.value })}>
                  <option value="public">Public</option>
                  <option value="private_only">Private only</option>
                  <option value="approval_required">Approval required</option>
                </Select>
              </div>
              <div>
                <FieldLabel hint="seconds, optional">Duration</FieldLabel>
                <TextInput aria-label={`Duration in seconds for ${item.name}`} type="number" min="0" value={item.durationSeconds ?? ''} onChange={e => onChange(index, { durationSeconds: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
              <div>
                <FieldLabel hint="minutes, optional">Cooldown / limit</FieldLabel>
                <TextInput aria-label={`Cooldown in minutes for ${item.name}`} type="number" min="0" value={item.cooldownMinutes ?? ''} onChange={e => onChange(index, { cooldownMinutes: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <SecondaryButton onClick={() => setExpanded(v => !v)}>{expanded ? 'Collapse' : 'Edit details'}</SecondaryButton>
            <SecondaryButton onClick={() => onDuplicate(index)}>⧉ Duplicate</SecondaryButton>
            <SecondaryButton onClick={() => onDelete(index)} style={{ color: T.red, borderColor: 'rgba(239,68,68,0.35)' }}>🗑 Delete</SecondaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function LivePreview({ menu, items, theme, hideEarnings }) {
  const grouped = useMemo(() => {
    const g = new Map()
    for (const it of items) {
      if (!g.has(it.category)) g.set(it.category, [])
      g.get(it.category).push(it)
    }
    return [...g.entries()]
  }, [items])

  const colors = {
    dark_neon: { bg: '#0a0b14', accent: T.cyan },
    pink_luxury: { bg: '#1a0b14', accent: T.pink },
    minimal_bw: { bg: '#0a0a0a', accent: '#fff' },
    soft_pastel: { bg: '#fdf6f9', accent: '#f472b6' },
  }[theme] || { bg: '#0a0b14', accent: T.cyan }

  return (
    <div style={{ background: colors.bg, borderRadius: 16, padding: 20, border: `1px solid ${T.border}`, maxHeight: 560, overflowY: 'auto' }}>
      <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 900, color: colors.accent, marginBottom: 4 }}>{menu.title}</div>
      {menu.intro && <div style={{ textAlign: 'center', fontSize: 12.5, color: T.muted, marginBottom: 16 }}>{menu.intro}</div>}
      {grouped.map(([category, catItems]) => (
        <div key={category} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.accent, marginBottom: 6 }}>{category}</div>
          {catItems.map(it => (
            <div key={it.id || it.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{it.name}{it.visibility !== 'public' ? <span style={{ color: T.faint, fontWeight: 500 }}> ({it.visibility === 'private_only' ? 'private' : 'approval'})</span> : ''}</div>
                {it.description && <div style={{ fontSize: 11.5, color: T.muted }}>{it.description}</div>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: colors.accent, whiteSpace: 'nowrap' }}>
                {it.price} {menu.currencyType === 'dollars' ? '' : menu.currencyType}
                {!hideEarnings && <div style={{ fontSize: 10, color: T.faint, fontWeight: 500 }}>≈${Number(it.estimatedEarnings || 0).toFixed(2)}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
      {menu.closingCta && <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: colors.accent, marginTop: 10 }}>{menu.closingCta}</div>}
    </div>
  )
}

export default function TipMenuEditor({ menu, isLoggedIn, onMenuUpdated }) {
  const [items, setItems] = useState(() => reindex(menu.items || []))
  const [title, setTitle] = useState(menu.title || '')
  const [intro, setIntro] = useState(menu.intro || '')
  const [closingCta, setClosingCta] = useState(menu.closingCta || '')
  const [rulesText, setRulesText] = useState((menu.rules || []).join('\n'))
  const [hideEarnings, setHideEarnings] = useState(!!menu.settings?.hideEarningsFromCustomer)
  const [theme, setTheme] = useState(menu.settings?.theme || 'dark_neon')
  const [dismissed, setDismissed] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [copiedKey, setCopiedKey] = useState('')

  const categories = useMemo(() => [...new Set([...TIP_MENU_CATEGORIES, ...items.map(i => i.category)])], [items])

  const updateItem = (index, patch) => setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  const moveItem = (index, dir) => setItems(prev => {
    const next = [...prev]
    const target = index + dir
    if (target < 0 || target >= next.length) return prev
    ;[next[index], next[target]] = [next[target], next[index]]
    return reindex(next)
  })
  const duplicateItem = index => setItems(prev => {
    const copy = { ...prev[index], id: undefined, name: `${prev[index].name} (copy)` }
    const next = [...prev]
    next.splice(index + 1, 0, copy)
    return reindex(next)
  })
  const deleteItem = index => setItems(prev => reindex(prev.filter((_, i) => i !== index)))
  const addItem = () => setItems(prev => reindex([...prev, {
    name: 'New Item', description: '', price: 25, estimatedEarnings: 0, category: categories[0] || 'Custom requests',
    visibility: 'public', durationSeconds: null, cooldownMinutes: null,
  }]))

  const isSavedToAccount = isLoggedIn && !String(menu.id).startsWith('local_')

  const handleSave = async () => {
    if (!isSavedToAccount) {
      window.location.assign('/landing')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/profile-studio/tip-menus', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: menu.id,
          title, intro, closingCta,
          rules: rulesText.split('\n').map(r => r.trim()).filter(Boolean),
          settings: { ...menu.settings, hideEarningsFromCustomer: hideEarnings, theme },
          items: items.map(it => ({
            name: it.name, description: it.description, price: it.price, estimatedEarnings: it.estimatedEarnings,
            category: it.category, visibility: it.visibility, durationSeconds: it.durationSeconds, cooldownMinutes: it.cooldownMinutes,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong saving your menu.')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
      onMenuUpdated?.({ id: menu.id, title, intro, closingCta, rules: data.menu.rules, items: data.menu.items })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const menuForExport = {
    ...menu, title, intro, closingCta,
    rules: rulesText.split('\n').map(r => r.trim()).filter(Boolean),
    items,
  }

  const doExport = async (kind) => {
    setCopiedKey(kind)
    setTimeout(() => setCopiedKey(''), 1800)
    if (kind === 'plain') return copyToClipboard(toPlainText(menuForExport))
    if (kind === 'formatted') return copyToClipboard(toFormattedText(menuForExport))
    if (kind === 'html') return downloadFile(`${title || 'tip-menu'}.html`, toHTML(menuForExport, { themeId: theme, brandName: title }), 'text/html')
    if (kind === 'chaturbate' || kind === 'myfreecams' || kind === 'bongacams') return copyToClipboard(toRoomText(menuForExport, kind))
    if (kind === 'social') return copyToClipboard(toSocialPost(menuForExport, title))
  }

  const review = menu.review

  return (
    <div>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <ReviewPanel review={review} dismissed={dismissed} onDismiss={r => setDismissed(prev => new Set(prev).add(r))} />

      <div className="ps-editor-grid" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, alignItems: 'start' }}>
        <div>
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Menu details</SectionLabel>
            <FieldLabel htmlFor="tme-title">Title</FieldLabel>
            <TextInput id="tme-title" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 10 }} />
            <FieldLabel htmlFor="tme-intro">Opening message</FieldLabel>
            <TextArea id="tme-intro" value={intro} maxLength={500} onChange={e => setIntro(e.target.value)} style={{ minHeight: 60, marginBottom: 10 }} />
            <FieldLabel htmlFor="tme-rules" hint="one per line">Rules</FieldLabel>
            <TextArea id="tme-rules" value={rulesText} onChange={e => setRulesText(e.target.value)} style={{ minHeight: 70, marginBottom: 10 }} />
            <FieldLabel htmlFor="tme-cta">Closing call to action</FieldLabel>
            <TextInput id="tme-cta" value={closingCta} maxLength={300} onChange={e => setClosingCta(e.target.value)} />
            <div style={{ marginTop: 14 }}>
              <Toggle checked={hideEarnings} onChange={setHideEarnings} label="Hide estimated earnings from customer-facing version" />
            </div>
          </Card>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <SectionLabel style={{ marginBottom: 0 }}>Items ({items.length})</SectionLabel>
            <SecondaryButton onClick={addItem}>+ Add item</SecondaryButton>
          </div>
          {items.map((item, i) => (
            <ItemRow
              key={item.id || i}
              item={item}
              index={i}
              total={items.length}
              categories={categories}
              onChange={updateItem}
              onMove={moveItem}
              onDuplicate={duplicateItem}
              onDelete={deleteItem}
            />
          ))}

          <div style={{ marginTop: 16 }}>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : isSavedToAccount ? '💾 Save changes' : '🔓 Sign up to save'}
            </PrimaryButton>
            {!isSavedToAccount && <div style={{ fontSize: 12, color: T.faint, marginTop: 8 }}>Exports below are free right now — sign up to keep this menu editable and reopen it later.</div>}
          </div>
        </div>

        <div>
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Live preview</SectionLabel>
            <FieldLabel htmlFor="tme-theme">Color theme</FieldLabel>
            <Select id="tme-theme" value={theme} onChange={e => setTheme(e.target.value)} style={{ marginBottom: 12 }}>
              {MENU_THEMES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
            <LivePreview menu={menuForExport} items={items} theme={theme} hideEarnings={hideEarnings} />
          </Card>

          <Card>
            <SectionLabel>Export</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <SecondaryButton onClick={() => doExport('plain')}>{copiedKey === 'plain' ? '✓ Copied' : '📋 Plain text'}</SecondaryButton>
              <SecondaryButton onClick={() => doExport('formatted')}>{copiedKey === 'formatted' ? '✓ Copied' : '📋 Formatted text'}</SecondaryButton>
              <SecondaryButton onClick={() => doExport('html')}>⬇ HTML</SecondaryButton>
              <SecondaryButton onClick={() => doExport('chaturbate')}>{copiedKey === 'chaturbate' ? '✓ Copied' : '📋 Chaturbate room text'}</SecondaryButton>
              <SecondaryButton onClick={() => doExport('myfreecams')}>{copiedKey === 'myfreecams' ? '✓ Copied' : '📋 MyFreeCams room text'}</SecondaryButton>
              <SecondaryButton onClick={() => doExport('bongacams')}>{copiedKey === 'bongacams' ? '✓ Copied' : '📋 BongaCams room text'}</SecondaryButton>
              <SecondaryButton onClick={() => doExport('social')}>{copiedKey === 'social' ? '✓ Copied' : '📋 Social media post'}</SecondaryButton>
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <SecondaryButton disabled title="Coming soon">🖼 PNG image <Badge color={T.gold} style={{ marginLeft: 6 }}>Soon</Badge></SecondaryButton>
              <SecondaryButton disabled title="Coming soon">📄 Printable PDF <Badge color={T.gold} style={{ marginLeft: 6 }}>Soon</Badge></SecondaryButton>
              <SecondaryButton disabled title="Coming soon">🎨 Canva layout <Badge color={T.gold} style={{ marginLeft: 6 }}>Soon</Badge></SecondaryButton>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
