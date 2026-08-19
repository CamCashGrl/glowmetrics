'use client'
// ============================================================
// CAMCASH — SHARED LOCKED-STATE UI SYSTEM
//
// One rule governs every component in this file:
//
//     DO NOT HIDE THE PRODUCT. PREVIEW THE PRODUCT.
//
// The locked cards this replaces put a 4px blur and a centred lock icon over
// the whole card body. That reads as disabled software — the creator learns
// nothing about what they would be buying, only that they are being blocked.
// Here the visualisation keeps its real structure and real numbers; the lock
// is expressed as a soft fade toward the card's own background plus a small
// badge, so the card looks like a premium preview rather than a censored one.
//
// FOUR STATES, NOT ONE COMPONENT
// These are genuinely different situations and must never be collapsed:
//
//   A. saved     — the data is ALREADY stored. Pro analyses it, no re-upload.
//   B. pro       — a Pro-only insight. Preview the real visualisation.
//   C. (none)    — not enough data yet. NOT a paywall: see InsufficientData,
//                  which deliberately has no lock icon and no upgrade CTA.
//   D. platform  — rows were NOT stored (Free platform cap). These need a
//                  re-import after upgrading, so the "no re-upload" promise
//                  must never appear here.
//
// Nothing in this file computes analytics. Every number is passed in, already
// measured by app/api/upload/route.js or app/dashboard/page.js from the
// canonical engine.
// ============================================================

import Button from '../../../components/ui/Button'

// ─────────────────────────────────────────────────────────────
// UnlockButton
//
// Reuses the app's signature gradient button (components/ui/Button.js, whose
// shimmer lives in globals.css as .lp-btn-primary) so a CTA here is visually
// identical to the landing page's. It adds only the arrow transition and the
// focus ring. It does NOT re-implement the gradient — one source of truth.
//
// Two weights on purpose. Making every unlock affordance a full gradient
// button is what produced the "repeated giant UNLOCK buttons" problem; the
// page gets ONE primary, and the per-card affordances are quiet.
// ─────────────────────────────────────────────────────────────
export function UnlockButton({
  children, onClick, variant = 'primary', size = 'md',
  surface, disabled = false, loading = false, style = {}, ...rest
}) {
  const pad = size === 'sm' ? '9px 15px' : size === 'lg' ? '15px 30px' : '13px 24px'
  const fs = size === 'sm' ? 12.5 : size === 'lg' ? 15.5 : 14.5

  if (variant === 'primary') {
    return (
      <Button
        className="cc-unlock cc-unlock--primary"
        onClick={onClick}
        disabled={disabled}
        loading={loading}
        data-cc-action={surface ? `upgrade_cta:${surface}` : undefined}
        style={{ padding: pad, fontSize: fs, borderRadius: 12, whiteSpace: 'nowrap', ...style }}
        {...rest}
      >
        <span className="cc-unlock-label">{children}</span>
        <span className="cc-unlock-arrow" aria-hidden="true">→</span>
      </Button>
    )
  }

  // Secondary: restrained by design. It must read as "there is more here"
  // without competing with the page's single primary action.
  return (
    <button
      type="button"
      className="cc-unlock cc-unlock--secondary"
      onClick={onClick}
      disabled={disabled}
      data-cc-action={surface ? `upgrade_cta:${surface}` : undefined}
      style={{ padding: size === 'sm' ? '7px 13px' : '9px 16px', fontSize: size === 'sm' ? 12 : 13, ...style }}
      {...rest}
    >
      <span className="cc-unlock-label">{children}</span>
      <span className="cc-unlock-arrow" aria-hidden="true">→</span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// LockedModule — states A, B and D
// ─────────────────────────────────────────────────────────────
export default function LockedModule({
  C,
  variant = 'pro',          // 'saved' | 'pro' | 'platform'
  title,
  description,
  icon,
  preview,                  // real visualisation; faded, never fully hidden
  lockedReason,             // short line under the preview
  value,                    // the creator's own measured figure
  valueLabel,
  stats,                    // [{ v, l }] — shown plainly, never blurred
  ctaLabel,
  onUpgrade,
  ctaVariant,               // override the variant's default CTA weight
  footnote,
  surface,
  compact = false,
  children,
}) {
  const V = VARIANTS[variant] || VARIANTS.pro
  const accent = V.accent(C)

  return (
    <section
      className={`cc-lock cc-lock--${variant}${compact ? ' cc-lock--compact' : ''}`}
      data-cc-surface={surface}
      style={{ '--cc-lock-accent': accent, borderColor: V.border, background: V.bg }}
      aria-label={V.aria(title)}
    >
      <header className="cc-lock-head">
        <div className="cc-lock-heading">
          {icon && <span className="cc-lock-icon" aria-hidden="true">{icon}</span>}
          <h3 className="cc-lock-title" style={{ color: C.white }}>{title}</h3>
        </div>
        {/* The badge carries the lock status as TEXT, not colour alone, so the
            state survives greyscale and screen readers (a11y §11). */}
        {V.badge && <span className="cc-lock-badge" style={{ color: accent, borderColor: V.border }}>{V.badge}</span>}
      </header>

      {/* The creator's own number. This is the whole argument in state A, so
          it leads rather than sitting under a preview as a footnote. */}
      {value != null && (
        <div className="cc-lock-value-wrap">
          <div className="cc-lock-value" style={{ color: accent }}>{value}</div>
          {valueLabel && <div className="cc-lock-value-label" style={{ color: C.muted }}>{valueLabel}</div>}
        </div>
      )}

      {/* Real figures, shown plainly. Blurring these was the old mistake: a
          creator cannot want what they cannot read. */}
      {stats?.length > 0 && (
        <div className="cc-lock-stats">
          {stats.map(s => (
            <div key={s.l} className="cc-lock-stat">
              <div className="cc-lock-stat-v" style={{ color: s.c || C.white }}>{s.v}</div>
              <div className="cc-lock-stat-l" style={{ color: C.muted }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* THE PREVIEW. Structure and real data stay legible; the fade is a mask
          toward the card background, not an opaque overlay. aria-hidden
          because it is decorative evidence — the description carries the
          meaning for assistive tech. */}
      {preview && (
        <div className="cc-lock-preview-wrap">
          <div className="cc-lock-preview" aria-hidden="true">{preview}</div>
          {lockedReason && (
            <div className="cc-lock-reason" style={{ color: C.text }}>{lockedReason}</div>
          )}
        </div>
      )}

      {description && <p className="cc-lock-desc" style={{ color: C.text }}>{description}</p>}
      {children}
      {footnote && <p className="cc-lock-foot" style={{ color: C.muted }}>{footnote}</p>}

      {ctaLabel && onUpgrade && (
        <div className="cc-lock-cta">
          <UnlockButton
            variant={ctaVariant || V.cta}
            size={compact ? 'sm' : 'md'}
            surface={surface}
            onClick={() => onUpgrade(surface)}
          >
            {ctaLabel}
          </UnlockButton>
        </div>
      )}
    </section>
  )
}

const VARIANTS = {
  // A — the data is already stored. The strongest conversion state we have,
  // so it gets the primary CTA weight and the green "money you already own"
  // treatment.
  saved: {
    accent: C => C.green,
    border: 'rgba(16,185,129,0.30)',
    bg: 'linear-gradient(135deg,rgba(16,185,129,0.11),rgba(34,211,238,0.06))',
    badge: 'ALREADY SAVED',
    cta: 'primary',
    aria: t => `${t} — already saved, unlocks with Pro`,
  },
  // B — a Pro-only insight. Quiet CTA: these are evidence for the page's one
  // primary action, not four competing ones.
  pro: {
    accent: C => C.indigo,
    border: 'rgba(124,92,255,0.22)',
    bg: 'rgba(10,14,32,0.72)',
    badge: 'PRO INSIGHT',
    cta: 'secondary',
    aria: t => `${t} — Pro insight, locked preview`,
  },
  // D — rows that were NOT stored. Amber separates it from the green "already
  // saved" language on sight, and the copy passed in must say so explicitly.
  platform: {
    accent: C => C.gold,
    border: 'rgba(245,158,11,0.26)',
    bg: 'linear-gradient(135deg,rgba(245,158,11,0.09),rgba(236,72,153,0.05))',
    badge: 'NOT SAVED',
    cta: 'primary',
    aria: t => `${t} — beyond your Free platform limit, rows not saved`,
  },
}

// ─────────────────────────────────────────────────────────────
// C — INSUFFICIENT DATA
//
// Deliberately NOT a LockedModule variant, because it is not a lock at all.
// No lock icon, no badge, no upgrade CTA — upgrading would not produce this
// number, so offering it would be a lie. It states the real threshold from
// the canonical rules and reads as "not yet", never as "broken" or "pay us".
// ─────────────────────────────────────────────────────────────
export function InsufficientData({ C, title, message, threshold, compact = false }) {
  return (
    <section className={`cc-nodata${compact ? ' cc-nodata--compact' : ''}`} aria-label={`${title} — not enough data yet`}>
      {title && <h3 className="cc-nodata-title" style={{ color: C.white }}>{title}</h3>}
      <div className="cc-nodata-chip" style={{ color: C.muted }}>Not enough activity yet</div>
      {message && <p className="cc-nodata-msg" style={{ color: C.text }}>{message}</p>}
      {threshold && <p className="cc-nodata-threshold" style={{ color: C.muted }}>{threshold}</p>}
    </section>
  )
}
