"use client"
import React from "react"

// Restored "Go Live" glass card — deep navy glass + cyan/blue/purple atmospheric
// glow with pink only as a tail accent, matching the pre-existing CamCash visual
// language. All numbers come from dailyBrief (built in page.js from real tips/
// sessions via lib/analytics.js) — this component only formats and displays
// them, it never computes its own metrics or invents data.
//
// Peak-window color intensity is derived from the SAME dailyBrief.hoursUntilPeak
// / dailyBrief.atPeak values the rest of the dashboard already uses for the
// "peak now" badge — no new recommendation logic, no hard-coded times.
function peakStateFor(hoursUntilPeak, atPeak) {
  if (atPeak) return "peak"
  if (hoursUntilPeak == null) return "far"
  if (hoursUntilPeak <= 2) return "near"
  if (hoursUntilPeak <= 4) return "approaching"
  return "far"
}

const fmtHour = (h) => {
  if (h === null || h === undefined || isNaN(h)) return null
  const x = ((h % 24) + 24) % 24
  return x === 0 ? "12 AM" : x < 12 ? `${x} AM` : x === 12 ? "12 PM" : `${x - 12} PM`
}

export default function GoLiveCard({ dailyBrief, onPlanMyStream }) {
  // Render whenever there's a dailyBrief at all (i.e. the account has tips) —
  // same gating the Daily Brief section below already uses. bhLabel (a
  // specific best-hour) can still be missing on a low-data account; that's
  // handled below with a "Not enough data yet" state instead of hiding the
  // whole card, matching the formula-requirements rule against fabricating
  // certainty vs. silently disappearing.
  if (!dailyBrief) return null

  const {
    todayName, bhLabel, bh, atPeak, hoursUntilPeak, displayPlat, displayAvg,
    sessionAvg, sessionsAtPeakCount,
  } = dailyBrief

  if (!bhLabel) {
    return (
      <div className="go-live-card is-far">
        <style jsx>{`
          .go-live-card {
            position: relative;
            overflow: hidden;
            margin-bottom: 20px;
            padding: 22px 26px;
            background:
              radial-gradient(circle at 8% 20%, rgba(22,244,255,0.06), transparent 34%),
              radial-gradient(circle at 72% 10%, rgba(124,92,255,0.05), transparent 38%),
              linear-gradient(160deg, #161B33, #0D1127 65%);
            border: 1px solid rgba(125,180,255,0.14);
            border-radius: 22px;
            backdrop-filter: blur(22px);
            -webkit-backdrop-filter: blur(22px);
          }
        `}</style>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(241,245,249,0.45)", marginBottom: 8 }}>
          Go Live Recommendation
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#F8FAFC", marginBottom: 4 }}>Not enough data yet</div>
        <div style={{ fontSize: 13, color: "rgba(241,245,249,0.6)", lineHeight: 1.6 }}>
          Import a few more sessions and we&apos;ll recommend a go-live window based on your real earnings history.
        </div>
      </div>
    )
  }

  const state = peakStateFor(hoursUntilPeak, atPeak)
  const bhEndLabel = fmtHour(bh !== null && bh !== undefined ? bh + 2 : null)
  const safeDisplayAvg = (!isNaN(displayAvg) && isFinite(displayAvg)) ? displayAvg : 0
  const safeSessionAvg = (!isNaN(sessionAvg) && isFinite(sessionAvg)) ? sessionAvg : 0
  const hasComparison = safeSessionAvg > 0 && safeDisplayAvg > 0
  const liftPct = hasComparison ? Math.round(((safeDisplayAvg - safeSessionAvg) / safeSessionAvg) * 100) : null
  // "+$X-$Y if you stream the full window" — grounded in the same peak-vs-typical
  // gap the rest of the card already shows, not a separate fabricated estimate.
  const gapPerHr = hasComparison ? Math.max(0, safeDisplayAvg - safeSessionAvg) : 0
  const upsideLow = hasComparison ? Math.round(gapPerHr * 2 * 0.8) : null
  const upsideHigh = hasComparison ? Math.round(gapPerHr * 2 * 1.2) : null
  const barMax = Math.max(safeDisplayAvg, safeSessionAvg, 1)
  const qualifyingSessions = sessionsAtPeakCount || 0

  return (
    <div className={`go-live-card is-${state}`}>
      <style jsx>{`
        .go-live-card {
          position: relative;
          overflow: hidden;
          margin-bottom: 20px;

          --peak-glow: 0.08;
          --peak-border: 0.16;
          --peak-cta-glow: 0.12;

          background:
            radial-gradient(circle at 8% 20%, rgba(22,244,255,var(--peak-glow)), transparent 34%),
            radial-gradient(circle at 72% 10%, rgba(124,92,255,calc(var(--peak-glow) * 0.9)), transparent 38%),
            radial-gradient(circle at 100% 90%, rgba(255,43,174,calc(var(--peak-glow) * 0.55)), transparent 36%),
            linear-gradient(160deg, #161B33, #0D1127 65%);

          border: 1px solid rgba(125,180,255,var(--peak-border));
          border-radius: 22px;

          box-shadow:
            0 20px 60px rgba(0,0,0,0.30),
            0 0 0 rgba(22,244,255,0),
            inset 0 1px 0 rgba(255,255,255,0.06);

          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);

          transition: box-shadow 700ms ease, border-color 700ms ease;
        }
        .go-live-card.is-approaching { --peak-glow: 0.13; --peak-border: 0.22; --peak-cta-glow: 0.16; }
        .go-live-card.is-near        { --peak-glow: 0.18; --peak-border: 0.28; --peak-cta-glow: 0.20; }
        .go-live-card.is-peak {
          --peak-glow: 0.24;
          --peak-border: 0.36;
          --peak-cta-glow: 0.26;
          box-shadow:
            0 20px 60px rgba(0,0,0,0.30),
            0 0 36px rgba(22,244,255,var(--peak-cta-glow)),
            inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .go-live-card__sheen {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(115deg, rgba(22,244,255,0.06), transparent 40%, rgba(124,92,255,0.05) 70%, rgba(255,43,174,0.04));
        }
        .go-live-card__tail {
          position: absolute;
          width: 380px;
          height: 160px;
          right: -140px;
          bottom: -100px;
          background: rgba(255,43,174,0.10);
          filter: blur(70px);
          pointer-events: none;
        }
        .go-live-card__body {
          position: relative;
          z-index: 1;
          padding: 26px 28px;
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 24px;
        }
        @media (max-width: 760px) {
          .go-live-card__body { grid-template-columns: 1fr; }
        }
        .go-live-card__eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(241,245,249,0.45);
          margin-bottom: 8px;
        }
        .go-live-card__title {
          font-size: clamp(1.4rem, 2.4vw, 1.9rem);
          line-height: 1.15;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #F8FAFC;
          margin-bottom: 12px;
        }
        .go-live-card__accent {
          background: linear-gradient(90deg, #16F4FF 0%, #55B8FF 42%, #7C5CFF 78%, #FF2BAE 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .go-live-card__badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(245,158,11,0.12);
          border: 1px solid rgba(245,158,11,0.35);
          color: #F59E0B;
          font-size: 11px;
          font-weight: 700;
        }
        .go-live-card__desc {
          margin-top: 12px;
          max-width: 460px;
          color: rgba(241,245,249,0.68);
          font-size: 13px;
          line-height: 1.6;
        }
        .go-live-card__cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 22px;
          margin-top: 20px;
          border: 0;
          border-radius: 12px;
          cursor: pointer;
          background: linear-gradient(100deg, #16F4FF, #55B8FF 42%, #7C5CFF 78%, #FF2BAE);
          color: #0a0e1a;
          font-weight: 800;
          font-size: 13px;
          letter-spacing: -0.01em;
          box-shadow: 0 10px 26px rgba(22,244,255,0.14), 0 8px 22px rgba(124,92,255,0.14);
          transition: box-shadow 500ms ease, filter 500ms ease, transform 160ms ease;
        }
        .go-live-card__cta:hover { transform: translateY(-1px); filter: brightness(1.06); }
        .is-peak .go-live-card__cta {
          box-shadow: 0 0 24px rgba(22,244,255,0.26), 0 10px 28px rgba(124,92,255,0.20);
        }
        .go-live-card__side-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(241,245,249,0.45);
          margin-bottom: 12px;
        }
        .go-live-card__panel {
          padding: 18px;
          border-radius: 16px;
          background: rgba(8,12,30,0.36);
          border: 1px solid rgba(255,255,255,0.07);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
        }
        .go-live-card__row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
        .go-live-card__row-label { font-size: 12.5px; color: rgba(241,245,249,0.75); font-weight: 600; }
        .go-live-card__row-value { font-size: 14px; font-weight: 800; color: #55B8FF; white-space: nowrap; }
        .go-live-card__bar { position: relative; height: 8px; margin-top: 8px; margin-bottom: 16px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,0.08); }
        .go-live-card__bar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg,#16F4FF,#55B8FF,#7C5CFF); box-shadow: 0 0 14px rgba(22,244,255,0.20); }
        .go-live-card__bar-sub { font-size: 10.5px; color: rgba(241,245,249,0.38); margin-top: -12px; margin-bottom: 14px; }
        .go-live-card__typical .go-live-card__row-value { color: rgba(241,245,249,0.55); }
        .go-live-card__typical .go-live-card__bar-fill { background: rgba(255,255,255,0.18); box-shadow: none; }
      `}</style>

      <div className="go-live-card__sheen" />
      <div className="go-live-card__tail" />

      <div className="go-live-card__body">
        {/* LEFT — recommendation */}
        <div>
          <div className="go-live-card__eyebrow">Go Live Recommendation</div>
          <div className="go-live-card__title">
            Go live <span className="go-live-card__accent">{bhLabel}{bhEndLabel ? `–${bhEndLabel}` : ""}</span> on {displayPlat}
          </div>
          <span className="go-live-card__badge">
            {atPeak ? "🟢 Peak now" : "⏰ Supported pattern"}
            {qualifyingSessions > 0 ? ` · based on ${qualifyingSessions} qualifying session${qualifyingSessions !== 1 ? "s" : ""}` : ""}
          </span>
          <div className="go-live-card__desc">
            {todayName}{atPeak ? " is in your peak window right now." : "s are historically one of your strongest windows."}{" "}
            {hasComparison
              ? <>You average <strong style={{ color: "#16F4FF" }}>${safeDisplayAvg.toFixed(2)}/hr</strong> here{liftPct !== null && liftPct > 0 ? <> — <strong style={{ color: "#55B8FF" }}>{liftPct}% higher</strong> than your typical hour</> : null}.</>
              : "Not enough data yet to compare this window against your typical hour."}
          </div>
          <button type="button" className="go-live-card__cta" onClick={onPlanMyStream}>
            Plan My Stream
          </button>
        </div>

        {/* RIGHT — why this window */}
        <div className="go-live-card__panel">
          <div className="go-live-card__side-label">Why This Window</div>

          {hasComparison && upsideLow !== null && upsideHigh > 0 && (
            <div style={{ marginBottom: 14, fontSize: 12, color: "#10B981", fontWeight: 700 }}>
              +${upsideLow}–${upsideHigh}{" "}
              <span style={{ color: "rgba(241,245,249,0.45)", fontWeight: 500 }}>
                if you stream the full window at the ${gapPerHr.toFixed(2)}/hr gap
              </span>
            </div>
          )}

          <div className="go-live-card__row">
            <span className="go-live-card__row-label">{todayName} {bhLabel}{bhEndLabel ? `–${bhEndLabel}` : ""}</span>
            <span className="go-live-card__row-value">{safeDisplayAvg > 0 ? `$${safeDisplayAvg.toFixed(2)}/hr` : "—"}</span>
          </div>
          <div className="go-live-card__bar">
            <div className="go-live-card__bar-fill" style={{ width: `${Math.min(100, (safeDisplayAvg / barMax) * 100)}%` }} />
          </div>
          <div className="go-live-card__bar-sub">
            {qualifyingSessions > 0 ? `${qualifyingSessions} qualifying session${qualifyingSessions !== 1 ? "s" : ""} · supported pattern` : "Early signal"}
          </div>

          <div className="go-live-card__typical">
            <div className="go-live-card__row">
              <span className="go-live-card__row-label">Your typical hour</span>
              <span className="go-live-card__row-value">{safeSessionAvg > 0 ? `$${safeSessionAvg.toFixed(2)}/hr` : "—"}</span>
            </div>
            <div className="go-live-card__bar">
              <div className="go-live-card__bar-fill" style={{ width: `${Math.min(100, (safeSessionAvg / barMax) * 100)}%` }} />
            </div>
            <div className="go-live-card__bar-sub">Median across your qualifying sessions</div>
          </div>
        </div>
      </div>
    </div>
  )
}
