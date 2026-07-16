"use client"
import { useEffect, useRef, useState } from 'react'
import { C } from '../theme'
import { InlineSpinner, timeAgo } from '../ui'
import { validateMessageInput } from '../../../lib/collab/validation'
import { getMessages, sendMessage, markMessagesRead, friendlyErrorMessage } from '../data'
import { supabase } from '../../../lib/supabase'

export default function ConversationPanel({ conversation, userId, onClose, onFlash }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    let active = true
    getMessages(conversation.id).then(rows => {
      if (!active) return
      setMessages(rows)
      setLoading(false)
      markMessagesRead(conversation.id, userId).catch(() => {})
    })

    const channel = supabase
      .channel(`collab_conversation_${conversation.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'collab_messages', filter: `conversation_id=eq.${conversation.id}` }, payload => {
        setMessages(prev => (prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]))
        if (payload.new.sender_user_id !== userId) markMessagesRead(conversation.id, userId).catch(() => {})
      })
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [conversation.id, userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend(e) {
    e.preventDefault()
    const { valid, errors, data } = validateMessageInput({ message: text })
    if (!valid) { onFlash?.('error', errors.message); return }

    setSending(true)
    try {
      const sent = await sendMessage(conversation.id, userId, data.message)
      setMessages(prev => [...prev, sent])
      setText('')
    } catch (err) {
      onFlash?.('error', friendlyErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 750, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, height: '80vh', maxHeight: 640, background: '#0b0f1c', border: `1px solid ${C.border}`, borderRadius: 18, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: C.white }}>Collaboration Conversation</div>
            <div style={{ fontSize: 11, color: C.muted }}>{conversation.collab_posts?.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && <div style={{ textAlign: 'center', color: C.muted, fontSize: 12, padding: 20 }}>Loading messages…</div>}
          {!loading && messages.length === 0 && (
            <div style={{ textAlign: 'center', color: C.muted, fontSize: 12.5, padding: '30px 10px' }}>
              No messages yet — say hello to get the conversation started.
            </div>
          )}
          {messages.map(m => {
            const mine = m.sender_user_id === userId
            return (
              <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                <div style={{
                  padding: '9px 13px', borderRadius: 14,
                  background: mine ? 'linear-gradient(90deg,#22D3EE,#a855f7)' : 'rgba(255,255,255,0.05)',
                  color: mine ? '#05070f' : C.white, fontSize: 13, lineHeight: 1.45, wordBreak: 'break-word',
                }}>
                  {m.message}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3, textAlign: mine ? 'right' : 'left' }}>{timeAgo(m.created_at)}</div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} style={{ padding: 12, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write a message…"
            maxLength={2000}
            style={{ flex: 1, padding: '10px 13px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: C.white, fontSize: 13, outline: 'none' }}
          />
          <button type="submit" disabled={sending || !text.trim()} style={{
            padding: '10px 16px', borderRadius: 10, border: 'none', cursor: sending ? 'wait' : 'pointer',
            background: 'linear-gradient(90deg,#22D3EE,#a855f7)', color: '#05070f', fontWeight: 800, fontSize: 12.5,
            display: 'flex', alignItems: 'center', gap: 6, opacity: text.trim() ? 1 : 0.5,
          }}>
            {sending ? <InlineSpinner size={12} /> : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
