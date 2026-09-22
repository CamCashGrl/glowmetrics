"use client"
import { useEffect, useRef, useState } from "react"
import { FLOATING_DASHBOARD_PREVIEW_COLORS as T } from "@/lib/theme/colors"

// ─────────────────────────────────────────────────────────────────────────
// FloatingDashboardPreview — PURE MARKETING VISUAL for the landing page.
//
// Renders a floating, glassmorphic "dashboard preview" made of 2-3 layered
// cards with idle float motion, a soft glow pulse, and (on desktop) a
// light tilt-on-mouse-move effect. Every number/name below is
// MOCK / DEMO DATA — hardcoded for visual effect only. This component does
// NOT read Supabase, does NOT read real user/session data, and must never
// be wired up to the real dashboard, analytics, or onboarding code.
//
// Colors intentionally mirror the tokens already used elsewhere on
// app/landing/LandingClient.js (LiveDemoPanel / DashboardShowcasePanel) so
// this card matches the rest of the live landing page rather than
// introducing a second design system.
// ─────────────────────────────────────────────────────────────────────────


// MOCK/DEMO DATA — tips over the last few hours, purely illustrative.
const MOCK_TIP_BARS = [22, 38, 30, 54, 41, 63, 48, 72, 58, 85]

// MOCK/DEMO DATA — starting point for the ticking "live" viewer count.
const MOCK_VIEWER_BASE = 128

// MOCK/DEMO DATA — static demo stats shown on the main card.
const MOCK_STATS = {
  income: 342,
  delta: "+18% vs last night",
  topPlatform: "Chaturbate",
}

// MOCK/DEMO DATA — small floating side card.
const MOCK_TOP_TIP = { name: "user_diamondkingx", amount: 250 }

function useDesktopTilt(ref) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })

  useEffect(() => {
    const canTilt = typeof window !== "undefined" &&
      window.matchMedia?.("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (!canTilt) return

    const el = ref.current
    if (!el) return

    const handleMove = (e) => {
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width  // 0..1
      const py = (e.clientY - rect.top) / rect.height   // 0..1
      const ry = (px - 0.5) * 10   // rotateY range
      const rx = (0.5 - py) * 8    // rotateX range
      setTilt({ rx, ry })
    }
    const handleLeave = () => setTilt({ rx: 0, ry: 0 })

    el.addEventListener("mousemove", handleMove)
    el.addEventListener("mouseleave", handleLeave)
    return () => {
      el.removeEventListener("mousemove", handleMove)
      el.removeEventListener("mouseleave", handleLeave)
    }
  }, [ref])

  return tilt
}

// Ticking "live" viewer count — MOCK DATA, drifts randomly within a small
// band. Never touches Supabase or any real analytics source.
function useMockLiveViewers(base) {
  const [count, setCount] = useState(base)
  useEffect(() => {
    const id = setInterval(() => {
      setCount(prev => {
        const next = prev + Math.floor(Math.random() * 7) - 3
        return Math.max(base - 20, Math.min(base + 30, next))
      })
    }, 2200)
    return () => clearInterval(id)
  }, [base])
  return count
}

export default function FloatingDashboardPreview() {
  const tiltRef = useRef(null)
  const { rx, ry } = useDesktopTilt(tiltRef)
  const viewers = useMockLiveViewers(MOCK_VIEWER_BASE)
  const maxBar = Math.max(...MOCK_TIP_BARS)

  return (
    <div className="cc-fdp-wrap">
      {/* Small floating side card — top tipper (MOCK DATA) */}
      <div className="cc-fdp-side cc-fdp-side-a" aria-hidden="true">
        <div className="cc-fdp-side-inner">
          <span className="cc-fdp-side-icon">🐳</span>
          <div>
            <div className="cc-fdp-side-label">Top tip tonight</div>
            <div className="cc-fdp-side-value">+{MOCK_TOP_TIP.amount} tokens</div>
          </div>
        </div>
      </div>

      {/* Small floating side card — live viewers (MOCK DATA) */}
      <div className="cc-fdp-side cc-fdp-side-b" aria-hidden="true">
        <div className="cc-fdp-side-inner">
          <span className="cc-fdp-dot" />
          <div>
            <div className="cc-fdp-side-label">Live viewers</div>
            <div className="cc-fdp-side-value">{viewers}</div>
          </div>
        </div>
      </div>

      {/* Main floating card */}
      <div
        ref={tiltRef}
        className="cc-fdp-main"
        style={{ transform: `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)` }}
      >
        <div className="cc-fdp-main-inner">
          <div className="cc-fdp-header">
            <span className="cc-fdp-dot" />
            <span className="cc-fdp-header-label">Live Preview</span>
            <span className="cc-fdp-header-tag">Demo data</span>
          </div>

          <div className="cc-fdp-income-row">
            <div className="cc-fdp-income-label">Tonight's income</div>
            <div className="cc-fdp-income-value">${MOCK_STATS.income}</div>
            <div className="cc-fdp-income-delta">{MOCK_STATS.delta}</div>
          </div>

          <div className="cc-fdp-chart">
            {MOCK_TIP_BARS.map((h, i) => (
              <div
                key={i}
                className="cc-fdp-bar"
                style={{
                  height: `${(h / maxBar) * 100}%`,
                  background: i === MOCK_TIP_BARS.length - 1
                    ? `linear-gradient(180deg, ${T.cyan}, ${T.purple})`
                    : "rgba(255,255,255,0.09)",
                }}
              />
            ))}
          </div>

          <div className="cc-fdp-footer">
            <span className="cc-fdp-footer-label">Top platform</span>
            <span className="cc-fdp-footer-value">{MOCK_STATS.topPlatform}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .cc-fdp-wrap {
          position: relative;
          width: 100%;
          max-width: 380px;
          margin: 0 auto;
          padding: 34px 26px;
        }

        .cc-fdp-main {
          border-radius: 22px;
          padding: 1px;
          background: ${T.panelBorderGradient};
          box-shadow: 0 0 40px -12px rgba(22,244,255,0.30), 0 24px 60px -20px rgba(0,0,0,0.6);
          animation: cc-fdp-float 6.5s ease-in-out infinite, cc-fdp-glow 4.5s ease-in-out infinite;
          transition: transform 0.15s ease-out;
          will-change: transform;
        }

        .cc-fdp-main-inner {
          border-radius: 21px;
          background: ${T.bgCard};
          backdrop-filter: blur(20px);
          padding: 20px 20px 18px;
        }

        .cc-fdp-header {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 16px;
        }

        .cc-fdp-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${T.cyan};
          box-shadow: 0 0 6px ${T.cyan};
          animation: cc-fdp-pulse 2s infinite;
          flex-shrink: 0;
        }

        .cc-fdp-header-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${T.cyanSoft};
        }

        .cc-fdp-header-tag {
          margin-left: auto;
          font-size: 9px;
          font-weight: 700;
          color: ${T.textFaint};
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 999px;
          padding: 2px 8px;
        }

        .cc-fdp-income-label {
          font-size: 11px;
          color: ${T.textMuted};
          margin-bottom: 4px;
        }

        .cc-fdp-income-value {
          font-size: 30px;
          font-weight: 900;
          color: white;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .cc-fdp-income-delta {
          font-size: 11.5px;
          font-weight: 700;
          color: ${T.green};
          margin-top: 4px;
        }

        .cc-fdp-chart {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 46px;
          margin: 16px 0 14px;
        }

        .cc-fdp-bar {
          flex: 1;
          border-radius: 2px 2px 0 0;
          transition: height 0.4s ease;
        }

        .cc-fdp-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,0.07);
        }

        .cc-fdp-footer-label {
          font-size: 11px;
          color: ${T.textFaint};
        }

        .cc-fdp-footer-value {
          font-size: 12px;
          font-weight: 800;
          color: ${T.cyanSoft};
        }

        .cc-fdp-side {
          position: absolute;
          z-index: 1;
          border-radius: 16px;
          padding: 1px;
          background: ${T.panelBorderGradient};
          box-shadow: 0 16px 34px -14px rgba(0,0,0,0.55);
        }

        .cc-fdp-side-a {
          top: -14px;
          right: -10px;
          animation: cc-fdp-float-side 7.5s ease-in-out infinite;
          animation-delay: -2.5s;
        }

        .cc-fdp-side-b {
          bottom: -10px;
          left: -16px;
          animation: cc-fdp-float-side 8.5s ease-in-out infinite;
          animation-delay: -5s;
        }

        .cc-fdp-side-inner {
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 15px;
          background: ${T.bgCardSoft};
          backdrop-filter: blur(16px);
          padding: 10px 13px;
          white-space: nowrap;
        }

        .cc-fdp-side-icon {
          font-size: 15px;
        }

        .cc-fdp-side-label {
          font-size: 9px;
          color: ${T.textFaint};
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .cc-fdp-side-value {
          font-size: 12.5px;
          font-weight: 800;
          color: white;
        }

        @keyframes cc-fdp-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-12px); }
        }

        @keyframes cc-fdp-float-side {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-7px); }
        }

        @keyframes cc-fdp-glow {
          0%, 100% { box-shadow: 0 0 40px -12px rgba(22,244,255,0.30), 0 24px 60px -20px rgba(0,0,0,0.6); }
          50%      { box-shadow: 0 0 54px -10px rgba(255,43,174,0.34), 0 24px 60px -20px rgba(0,0,0,0.6); }
        }

        @keyframes cc-fdp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(1.4); }
        }

        @media (max-width: 768px) {
          .cc-fdp-wrap { padding: 20px 14px 30px; max-width: 340px; }
          .cc-fdp-main { animation: none !important; transform: none !important; }
          .cc-fdp-side { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .cc-fdp-main, .cc-fdp-side-a, .cc-fdp-side-b, .cc-fdp-dot {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
