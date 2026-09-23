'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const C = {
  bg: '#05070f', card: '#0d1322', border: '#1e2d45',
  cyan: '#22D3EE', green: '#10B981', red: '#EF4444',
  white: '#F1F5F9', muted: '#475569', text: '#94A3B8',
}

const inputStyle = {
  padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.bg, color: C.white, fontSize: 14, width: '100%',
}
const buttonStyle = {
  padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: C.cyan, color: '#05070f', fontWeight: 700, fontSize: 13,
}

export default function StudioPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [studioName, setStudioName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [actionPending, setActionPending] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/studio')
    if (res.status === 401) {
      setData(null)
      setLoading(false)
      return
    }
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Failed to load Studio.')
    } else {
      setError(null)
      setData(json)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    load()
  }, [load])

  const createStudio = async (e) => {
    e.preventDefault()
    if (!studioName.trim()) return
    setActionPending(true)
    setError(null)
    const res = await fetch('/api/studio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: studioName.trim() }),
    })
    const json = await res.json()
    setActionPending(false)
    if (!res.ok) { setError(json.error); return }
    setStudioName('')
    await load()
  }

  const sendInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setActionPending(true)
    setError(null)
    const res = await fetch('/api/studio/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    })
    const json = await res.json()
    setActionPending(false)
    if (!res.ok) { setError(json.error); return }
    setInviteEmail('')
    await load()
  }

  const acceptInvite = async (id) => {
    setActionPending(true)
    await fetch('/api/studio/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studio_model_id: id }),
    })
    setActionPending(false)
    await load()
  }

  const revokeLink = async (id) => {
    setActionPending(true)
    await fetch('/api/studio/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studio_model_id: id }),
    })
    setActionPending(false)
    await load()
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: 40 }}>Loading…</div>
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.white, padding: 40 }}>
        Please sign in to manage your Studio.
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.white, padding: '40px 24px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Studio</h1>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: C.red, marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      {!data?.studio ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Create your Studio</h2>
          <form onSubmit={createStudio} style={{ display: 'flex', gap: 12 }}>
            <input
              style={inputStyle}
              placeholder="Studio name"
              value={studioName}
              onChange={(e) => setStudioName(e.target.value)}
              disabled={actionPending}
            />
            <button style={buttonStyle} disabled={actionPending} type="submit">Create</button>
          </form>
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{data.studio.name}</h2>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Status: {data.studio.status}</div>

          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Invite a model</h3>
          <form onSubmit={sendInvite} style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <input
              style={inputStyle}
              type="email"
              placeholder="Model's CamCash email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={actionPending}
            />
            <button style={buttonStyle} disabled={actionPending} type="submit">Invite</button>
          </form>

          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Linked models</h3>
          {data.models.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 13 }}>No models invited yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.models.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 14 }}>{m.display_name || 'Unknown'}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{m.status}</div>
                  </div>
                  {m.status !== 'revoked' && (
                    <button
                      style={{ ...buttonStyle, background: 'transparent', border: `1px solid ${C.red}`, color: C.red }}
                      onClick={() => revokeLink(m.id)}
                      disabled={actionPending}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {data?.invites?.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Studio invitations for you</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.invites.map((inv) => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 14 }}>{inv.studios?.name || 'Unknown studio'}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{inv.status}</div>
                </div>
                {inv.status === 'invited' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={buttonStyle} onClick={() => acceptInvite(inv.id)} disabled={actionPending}>Accept</button>
                    <button
                      style={{ ...buttonStyle, background: 'transparent', border: `1px solid ${C.red}`, color: C.red }}
                      onClick={() => revokeLink(inv.id)}
                      disabled={actionPending}
                    >
                      Decline
                    </button>
                  </div>
                )}
                {inv.status === 'accepted' && (
                  <button
                    style={{ ...buttonStyle, background: 'transparent', border: `1px solid ${C.red}`, color: C.red }}
                    onClick={() => revokeLink(inv.id)}
                    disabled={actionPending}
                  >
                    Leave studio
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
