'use client'
import React, { useState } from 'react'

// Shared CamCash neon design tokens for Creator Profile Studio — matches the
// approved cyan/purple/pink gradient system used across onboarding + landing
// (see components/ui/Button.js GRADIENT).
export const T = {
  bg: '#050713',
  bgPanel: '#080B1A',
  card: 'rgba(13,17,38,0.78)',
  cardSoft: 'rgba(16,20,42,0.6)',
  input: 'rgba(5,9,24,0.72)',
  border: 'rgba(255,255,255,0.09)',
  borderSoft: 'rgba(255,255,255,0.06)',
  cyan: '#16F4FF',
  cyanSoft: '#48E9FF',
  pink: '#FF2BAE',
  purple: '#7C5CFF',
  gold: '#FFC857',
  green: '#22C55E',
  red: '#EF4444',
  white: '#FFFFFF',
  soft: '#D7D9EA',
  muted: '#8D93AA',
  faint: '#5E647C',
}

export const GRADIENT = 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)'

export function PageShell({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(circle at 15% 20%, rgba(22,244,255,0.14), transparent 34%),
        radial-gradient(circle at 85% 30%, rgba(255,43,174,0.14), transparent 36%),
        linear-gradient(135deg, #050713 0%, #080B1A 48%, #120719 100%)
      `,
      color: T.soft,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {children}
      <style>{`
        @keyframes psFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes psSpin { to{transform:rotate(360deg)} }
        @keyframes psPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .ps-fade { animation: psFadeUp 0.35s ease both; }
        .ps-input:focus { outline:none; border-color: rgba(22,244,255,0.75) !important; box-shadow: 0 0 0 3px rgba(22,244,255,0.12); }
        .ps-btn { transition: all 0.15s ease; }
        .ps-btn:hover { transform: translateY(-1px); }
        .ps-pill:hover { border-color: rgba(22,244,255,0.5) !important; }
        @media (max-width: 860px) { .ps-grid-2 { grid-template-columns: 1fr !important; } .ps-editor-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 900px) { .ps-wizard-layout { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px) { .ps-step-label { display: none !important; } }
      `}</style>
    </div>
  )
}

export function Card({ children, style, highlight, ...rest }) {
  return (
    <div
      style={{
        background: highlight
          ? `radial-gradient(circle at 0% 0%, rgba(22,244,255,0.12), transparent 42%), radial-gradient(circle at 100% 100%, rgba(255,43,174,0.10), transparent 46%), ${T.card}`
          : T.card,
        border: `1px solid ${highlight ? 'rgba(22,244,255,0.28)' : T.border}`,
        borderRadius: 20,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 34px rgba(0,0,0,0.28)',
        padding: 22,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

export function SectionLabel({ children, style }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.cyan, marginBottom: 10, ...style }}>
      {children}
    </div>
  )
}

export function FieldLabel({ children, hint, required, htmlFor }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 13, fontWeight: 700, color: T.soft, marginBottom: 6 }}>
      {children}{required ? <span style={{ color: T.pink }}> *</span> : null}
      {hint ? <span style={{ fontWeight: 400, color: T.faint, marginLeft: 6 }}>({hint})</span> : null}
    </label>
  )
}

const baseInputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 12,
  background: T.input,
  border: `1px solid ${T.border}`,
  color: T.white,
  fontSize: 14,
  fontFamily: 'inherit',
}

export function TextInput(props) {
  return <input {...props} className="ps-input" style={{ ...baseInputStyle, ...(props.style || {}) }} />
}

export function TextArea(props) {
  return <textarea {...props} className="ps-input" style={{ ...baseInputStyle, resize: 'vertical', minHeight: 80, ...(props.style || {}) }} />
}

export function Select(props) {
  return (
    <select {...props} className="ps-input" style={{ ...baseInputStyle, cursor: 'pointer', ...(props.style || {}) }}>
      {props.children}
    </select>
  )
}

export function Pill({ active, onClick, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ps-pill ps-btn"
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        border: `1px solid ${active ? 'rgba(22,244,255,0.85)' : T.border}`,
        background: active ? 'rgba(22,244,255,0.14)' : 'rgba(255,255,255,0.03)',
        color: active ? T.white : T.muted,
        boxShadow: active ? '0 0 14px rgba(22,244,255,0.18)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

export function PillGroup({ options, value = [], onToggle, max }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const id = typeof opt === 'string' ? opt : opt.id
        const label = typeof opt === 'string' ? opt : opt.label
        const active = value.includes(id)
        const disabled = !active && max && value.length >= max
        return <Pill key={id} active={active} disabled={disabled} onClick={() => onToggle(id)}>{label}</Pill>
      })}
    </div>
  )
}

export function SingleSelectPills({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const id = typeof opt === 'string' ? opt : opt.id
        const label = typeof opt === 'string' ? opt : opt.label
        return <Pill key={id} active={value === id} onClick={() => onChange(id)}>{label}</Pill>
      })}
    </div>
  )
}

export function PrimaryButton({ children, onClick, disabled, style, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="ps-btn"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '13px 26px', borderRadius: 14, border: 'none',
        background: disabled ? 'rgba(255,255,255,0.08)' : GRADIENT,
        color: disabled ? 'rgba(255,255,255,0.35)' : '#fff',
        fontWeight: 800, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 0 20px rgba(22,244,255,0.20), 0 0 30px rgba(255,43,174,0.16)',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, onClick, disabled, style, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="ps-btn"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '10px 16px', borderRadius: 12, border: `1px solid ${T.border}`,
        background: 'rgba(255,255,255,0.04)', color: T.soft, fontWeight: 700, fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function IconButton({ children, onClick, title, active, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="ps-btn"
      style={{
        width: 32, height: 32, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${danger ? 'rgba(239,68,68,0.4)' : T.border}`,
        background: active ? 'rgba(22,244,255,0.14)' : 'rgba(255,255,255,0.03)',
        color: danger ? T.red : T.muted, cursor: 'pointer', fontSize: 14,
      }}
    >
      {children}
    </button>
  )
}

export function Badge({ children, color = T.cyan, style }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: 999, color, background: `${color}22`, border: `1px solid ${color}44`,
      ...style,
    }}>
      {children}
    </span>
  )
}

// Shared "type and press Enter to add a tag" input — used by the tip menu
// wizard's boundary lists and Brand Studio's always-use/never-use word lists
// so there's exactly one implementation instead of one per screen.
export function TagInput({ value, onChange, placeholder, ariaLabel, badgeColor = T.pink }) {
  const [text, setText] = React.useState('')
  return (
    <div>
      <TextInput
        aria-label={ariaLabel || placeholder}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && text.trim()) {
            e.preventDefault()
            onChange([...value, text.trim()])
            setText('')
          }
        }}
        placeholder={placeholder}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {value.map((item, i) => (
          <Badge key={i} color={badgeColor}>
            {item}{' '}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: 4 }}>✕</button>
          </Badge>
        ))}
      </div>
    </div>
  )
}

export function StepDots({ steps, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 22, flexWrap: 'wrap' }}>
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800,
              background: i <= current ? T.cyan : 'rgba(255,255,255,0.06)',
              color: i <= current ? '#06101A' : T.muted,
              boxShadow: i === current ? '0 0 12px rgba(22,244,255,0.5)' : 'none',
            }}>{i + 1}</div>
            <span className="ps-step-label" style={{ fontSize: 11, fontWeight: 700, color: i <= current ? T.white : T.faint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
          </div>
          {i < steps.length - 1 && <div style={{ width: 16, height: 1, background: i < current ? T.cyan : T.border }} />}
        </React.Fragment>
      ))}
    </div>
  )
}

export function LoadingStaged({ messages, active }) {
  const [idx, setIdx] = useState(0)
  React.useEffect(() => {
    if (!active) { setIdx(0); return }
    const t = setInterval(() => setIdx(i => Math.min(i + 1, messages.length - 1)), 1100)
    return () => clearInterval(t)
  }, [active, messages.length])
  if (!active) return null
  return (
    <div className="ps-fade" style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ width: 44, height: 44, margin: '0 auto 18px', borderRadius: '50%', border: `3px solid rgba(255,255,255,0.08)`, borderTopColor: T.cyan, animation: 'psSpin 0.8s linear infinite' }} />
      <div style={{ fontSize: 15, fontWeight: 700, color: T.white, animation: 'psPulse 1.4s ease infinite' }}>{messages[idx]}</div>
      <div style={{ marginTop: 14, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', maxWidth: 260, margin: '14px auto 0', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: GRADIENT, width: `${((idx + 1) / messages.length) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="ps-fade" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12,
      padding: '12px 16px', marginBottom: 16, color: '#FCA5A5', fontSize: 13.5,
    }}>
      <span>{message}</span>
      {onDismiss && <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontSize: 16 }}>✕</button>}
    </div>
  )
}

export function EmptyState({ title, description, icon = '✨' }) {
  return (
    <div className="ps-fade" style={{ textAlign: 'center', padding: '48px 20px', border: `1px dashed ${T.border}`, borderRadius: 18, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: T.white, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: T.muted, maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>{description}</div>
    </div>
  )
}

export function GuidancePanel({ title = 'Why we ask this', children }) {
  return (
    <div style={{
      background: 'rgba(124,92,255,0.06)', border: '1px solid rgba(124,92,255,0.25)', borderRadius: 16,
      padding: 18, fontSize: 12.5, color: T.muted, lineHeight: 1.6, alignSelf: 'start',
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.purple, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

export function CompletionTracker({ percent, checklist }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.soft }}>Profile completeness</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.cyan }}>{percent}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ height: '100%', width: `${percent}%`, background: GRADIENT, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {checklist.map(c => (
          <span key={c.label} style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
            background: c.done ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${c.done ? 'rgba(34,197,94,0.4)' : T.border}`,
            color: c.done ? T.green : T.faint,
          }}>
            {c.done ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: T.soft, fontWeight: 600 }}>
      <span
        onClick={() => onChange(!checked)}
        style={{
          width: 38, height: 22, borderRadius: 999, position: 'relative', flexShrink: 0,
          background: checked ? GRADIENT : 'rgba(255,255,255,0.12)', transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 19 : 3, width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }} />
      </span>
      {label}
    </label>
  )
}
