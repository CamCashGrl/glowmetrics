"use client"
import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DashboardPreview } from "../../dashboard/DashboardPreview"

const C = {
  bg:     "#050713",
  bg1:    "#080B1A",
  card:   "rgba(10,14,32,0.82)",
  border: "rgba(255,255,255,0.09)",
  cyan:   "#16F4FF",
  pink:   "#FF2BAE",
  purple: "#7C5CFF",
  gold:   "#FFC857",
  white:  "#FFFFFF",
  text:   "#D7D9EA",
  muted:  "#8D93AA",
}

const DASHBOARD_STAGES = [
  { id: "no-data",          label: "No Data",        color: C.muted  },
  { id: "tiny-import",      label: "Tiny Import",    color: C.gold   },
  { id: "first-valid-data", label: "First Data",     color: C.cyan   },
  { id: "growing-insights", label: "Growing",        color: C.purple },
  { id: "full-dashboard",   label: "Full Dashboard", color: C.white  },
  { id: "live-active",      label: "Live Active",    color: C.pink   },
]

const ONBOARDING_STEPS = [
  { id: "step-platform",  label: "1. Platform Picker"     },
  { id: "step-username",  label: "2. Username / Token"    },
  { id: "step-paste",     label: "3. Paste History"       },
  { id: "step-preview",   label: "4. Preview Import"      },
  { id: "step-done",      label: "5. Done / Dashboard"    },
]

function StageBtn({ label, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 16px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
      background: active ? `${color}22` : "rgba(255,255,255,0.04)",
      border: `1px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
      color: active ? color : C.muted,
      transition: "all 0.15s",
    }}>
      {label}
    </button>
  )
}

function AdminPreviewInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const initFlow     = searchParams.get("flow") || "dashboard"
  const initStage    = searchParams.get("stage") || "no-data"

  const [flow,        setFlow]        = useState(initFlow)
  const [dashStage,   setDashStage]   = useState(initStage)
  const [onbStep,     setOnbStep]     = useState("step-platform")
  const [previewData, setPreviewData] = useState(null)
  const [loading,     setLoading]     = useState(false)
  const iframeRef = useRef(null)

  useEffect(() => {
    if (!document.cookie.includes("gm_admin=")) { router.replace("/admin/login"); return }
  }, [])

  useEffect(() => {
    if (flow !== "dashboard") return
    setLoading(true)
    fetch(`/api/admin/preview-data?stage=${dashStage}`)
      .then(r => r.json())
      .then(d => { setPreviewData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dashStage, flow])

  const mockUser = { plan: "free", email: "preview@camcashgrl.com" }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Inter',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.bg1, padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, height: 52 }}>
          <button onClick={() => router.push("/admin")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ fontSize: 14, fontWeight: 800, background: `linear-gradient(90deg,${C.cyan},${C.pink})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Stage Previewer
          </div>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(22,244,255,0.1)", color: C.cyan, border: `1px solid ${C.cyan}33`, fontWeight: 700, letterSpacing: "0.08em" }}>
            ADMIN ONLY
          </span>
        </div>
      </div>

      {/* Flow Tabs */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.bg1, padding: "0 28px", display: "flex", gap: 0 }}>
        {[
          { id: "dashboard",  label: "Dashboard Stages"  },
          { id: "onboarding", label: "Onboarding Flow"   },
        ].map(t => (
          <button key={t.id} onClick={() => setFlow(t.id)} style={{
            padding: "10px 20px", background: "none", border: "none",
            borderBottom: flow === t.id ? `2px solid ${C.cyan}` : "2px solid transparent",
            color: flow === t.id ? C.cyan : C.muted,
            cursor: "pointer", fontSize: 13, fontWeight: flow === t.id ? 700 : 500,
            transition: "all 0.15s", marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 103px)" }}>

        {/* Sidebar */}
        <div style={{ width: 200, borderRight: `1px solid ${C.border}`, background: "rgba(6,9,20,0.6)", padding: "16px 12px", flexShrink: 0, overflowY: "auto" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
            {flow === "dashboard" ? "Dashboard Stages" : "Onboarding Steps"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {flow === "dashboard"
              ? DASHBOARD_STAGES.map(s => (
                  <StageBtn key={s.id} label={s.label} color={s.color} active={dashStage === s.id} onClick={() => setDashStage(s.id)} />
                ))
              : ONBOARDING_STEPS.map(s => (
                  <StageBtn key={s.id} label={s.label} color={C.cyan} active={onbStep === s.id} onClick={() => setOnbStep(s.id)} />
                ))
            }
          </div>

          {flow === "dashboard" && (
            <div style={{ marginTop: 20, padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Current Stage</div>
              {DASHBOARD_STAGES.filter(s => s.id === dashStage).map(s => (
                <span key={s.id} style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</span>
              ))}
            </div>
          )}

          {flow === "onboarding" && (
            <div style={{ marginTop: 16, padding: "10px 12px", background: "rgba(22,244,255,0.06)", borderRadius: 10, border: `1px solid ${C.cyan}22` }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Navigate through the real onboarding flow in the preview panel.</div>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          {flow === "dashboard" && (
            <>
              {loading && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, zIndex: 10 }}>
                  <div style={{ width: 32, height: 32, border: `3px solid rgba(255,255,255,0.1)`, borderTopColor: C.cyan, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                </div>
              )}
              {!loading && previewData && (
                <DashboardPreview
                  tips={previewData.tips || []}
                  analytics={previewData.analytics}
                  userPlan={mockUser.plan}
                  onAddHistory={() => {}}
                  onContinue={() => {}}
                  onUpgrade={() => {}}
                  onLiveMode={() => {}}
                />
              )}
            </>
          )}

          {flow === "onboarding" && (
            <iframe
              ref={iframeRef}
              src="/onboarding"
              style={{ width: "100%", height: "100%", border: "none" }}
              title="Onboarding Preview"
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminPreviewPage() {
  return (
    <Suspense fallback={null}>
      <AdminPreviewInner />
    </Suspense>
  )
}
