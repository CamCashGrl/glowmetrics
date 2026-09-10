'use client'
import { useEffect, useState } from 'react'
import { T, Card, SectionLabel, SecondaryButton, TextInput, EmptyState, Badge } from './theme'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function preview(draft, kind) {
  const raw = kind === 'bio' ? draft.text : draft.intro
  if (!raw) return ''
  return raw.length > 100 ? `${raw.slice(0, 100).trim()}…` : raw
}

function DraftRow({ draft, kind, onDelete, onDuplicate, onRename }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(draft.name || draft.title)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const previewText = preview(draft, kind)

  return (
    <div className="ps-fade" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 4px', borderBottom: `1px solid ${T.borderSoft}`, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {renaming ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <TextInput value={name} onChange={e => setName(e.target.value)} style={{ maxWidth: 240 }} />
            <SecondaryButton onClick={async () => { await onRename(draft.id, name); setRenaming(false) }}>Save</SecondaryButton>
            <SecondaryButton onClick={() => setRenaming(false)}>Cancel</SecondaryButton>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{draft.name || draft.title}</div>
            <div style={{ fontSize: 11.5, color: T.faint, marginTop: 2 }}>
              {kind === 'bio' ? <Badge color={T.cyan}>{draft.platform}</Badge> : <Badge color={T.pink}>{draft.style}</Badge>}
              {' '}Last edited {fmtDate(draft.updatedAt)}
            </div>
            {previewText && (
              <div style={{ fontSize: 12, color: T.muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>{previewText}</div>
            )}
          </>
        )}
      </div>
      {!renaming && !confirmingDelete && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <SecondaryButton onClick={() => setRenaming(true)}>Rename</SecondaryButton>
          <SecondaryButton onClick={() => onDuplicate(draft.id)}>Duplicate</SecondaryButton>
          <SecondaryButton onClick={() => setConfirmingDelete(true)} style={{ color: T.red, borderColor: 'rgba(239,68,68,0.35)' }}>Delete</SecondaryButton>
        </div>
      )}
      {confirmingDelete && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: T.red, fontWeight: 700 }}>Delete this {kind === 'bio' ? 'bio' : 'tip menu'}?</span>
          <SecondaryButton onClick={() => onDelete(draft.id)} style={{ color: T.red, borderColor: 'rgba(239,68,68,0.35)' }}>Confirm delete</SecondaryButton>
          <SecondaryButton onClick={() => setConfirmingDelete(false)}>Cancel</SecondaryButton>
        </div>
      )}
    </div>
  )
}

export default function DraftsPanel({ isLoggedIn }) {
  const [bios, setBios] = useState(null)
  const [menus, setMenus] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [bioRes, menuRes] = await Promise.all([
        fetch('/api/profile-studio/bios'),
        fetch('/api/profile-studio/tip-menus'),
      ])
      const bioData = await bioRes.json()
      const menuData = await menuRes.json()
      setBios(bioRes.ok ? bioData.bios : [])
      setMenus(menuRes.ok ? menuData.menus : [])
    } catch {
      setBios([])
      setMenus([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoggedIn) load()
    else setLoading(false)
  }, [isLoggedIn])

  if (!isLoggedIn) {
    return <EmptyState icon="📁" title="Sign in to see your drafts" description="Saved bios and tip menus will show up here once you're signed in." />
  }

  if (loading) return <div style={{ color: T.muted, fontSize: 13, padding: 20 }}>Loading your drafts…</div>

  const handleDeleteBio = async id => { await fetch(`/api/profile-studio/bios?id=${id}`, { method: 'DELETE' }); load() }
  const handleDuplicateBio = async id => { await fetch('/api/profile-studio/bios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'duplicate', id }) }); load() }
  const handleRenameBio = async (id, name) => { await fetch('/api/profile-studio/bios', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }) }); load() }

  const handleDeleteMenu = async id => { await fetch(`/api/profile-studio/tip-menus?id=${id}`, { method: 'DELETE' }); load() }
  const handleDuplicateMenu = async id => { await fetch('/api/profile-studio/tip-menus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'duplicate', id }) }); load() }
  const handleRenameMenu = async (id, name) => { await fetch('/api/profile-studio/tip-menus', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }) }); load() }

  return (
    <div className="ps-fade">
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Saved bios</SectionLabel>
        {bios?.length ? bios.map(b => (
          <DraftRow key={b.id} draft={b} kind="bio" onDelete={handleDeleteBio} onDuplicate={handleDuplicateBio} onRename={handleRenameBio} />
        )) : <div style={{ fontSize: 13, color: T.faint, padding: '8px 4px' }}>No saved bios yet.</div>}
      </Card>
      <Card>
        <SectionLabel>Saved tip menus</SectionLabel>
        {menus?.length ? menus.map(m => (
          <DraftRow key={m.id} draft={m} kind="menu" onDelete={handleDeleteMenu} onDuplicate={handleDuplicateMenu} onRename={handleRenameMenu} />
        )) : <div style={{ fontSize: 13, color: T.faint, padding: '8px 4px' }}>No saved tip menus yet.</div>}
      </Card>
    </div>
  )
}
