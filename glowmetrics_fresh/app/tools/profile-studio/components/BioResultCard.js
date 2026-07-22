'use client'
import { useState } from 'react'
import { T, Card, Badge, SecondaryButton, TextArea } from './theme'
import { track } from '../../../../lib/track'

const STYLE_LABEL = { best_overall: 'Best Overall', playful: 'More Playful', direct: 'More Direct' }
const STYLE_COLOR = { best_overall: T.cyan, playful: T.pink, direct: T.gold }

export default function BioResultCard({ bio, isLoggedIn, onSave, onRegenerate, regenerating }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(bio.text)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editing ? draft : bio.text)
    track('result_copied', { type: 'bio', style: bio.style })
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(bio.id, draft)
      setEditing(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1800)
    } finally {
      setSaving(false)
    }
  }

  const displayText = editing ? draft : bio.text

  return (
    <Card highlight className="ps-fade" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <Badge color={STYLE_COLOR[bio.style] || T.cyan}>{STYLE_LABEL[bio.style] || bio.style}</Badge>
        <Badge color={T.muted}>{bio.platform}</Badge>
      </div>

      {editing ? (
        <TextArea value={draft} onChange={e => setDraft(e.target.value)} style={{ minHeight: 130 }} aria-label="Edit bio text" />
      ) : (
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: T.white, whiteSpace: 'pre-wrap', margin: 0 }}>{displayText}</p>
      )}

      <div style={{ fontSize: 11.5, color: T.faint, fontWeight: 600 }}>{displayText.length} characters</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <SecondaryButton onClick={handleCopy}>{copied ? '✓ Copied' : '📋 Copy'}</SecondaryButton>
        {editing ? (
          isLoggedIn ? (
            <SecondaryButton onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : savedFlash ? '✓ Saved' : '💾 Save edits'}</SecondaryButton>
          ) : (
            <SecondaryButton as="a" onClick={() => window.location.assign('/landing')}>🔓 Sign up to save</SecondaryButton>
          )
        ) : (
          <SecondaryButton onClick={() => { setDraft(bio.text); setEditing(true) }}>✏️ Edit</SecondaryButton>
        )}
        {!editing && (
          isLoggedIn ? (
            <SecondaryButton onClick={() => onSave(bio.id, bio.text)}>{savedFlash ? '✓ Saved' : '💾 Save'}</SecondaryButton>
          ) : (
            <SecondaryButton onClick={() => window.location.assign('/landing')}>🔓 Sign up to save</SecondaryButton>
          )
        )}
        <SecondaryButton onClick={onRegenerate} disabled={regenerating}>{regenerating ? 'Regenerating…' : '🔄 Regenerate'}</SecondaryButton>
      </div>
    </Card>
  )
}
