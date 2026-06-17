"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { T } from '../../lib/tracking'
import ChaturbateTokenConnector from '../dashboard/components/ChaturbateTokenConnector'

const C = {
  bg: "#05070f", card: "#121826", border: "#1e2d45",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899",
  gold: "#F59E0B", green: "#10B981", red: "#F87171",
  white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

const PLATFORMS = [
  {
    name: "Chaturbate", emoji: "🟣", color: C.cyan,
    steps: [
      "Log into Chaturbate as a broadcaster",
      "Go to Stats & Data → Token Stats",
      "Set your date range (last 90 days works great)",
      'Click "Download CSV" or "Export"',
      "Upload that file below ↓"
    ],
    tip: "Look for a file named something like chaturbate_token_stats.csv"
  },
  {
    name: "BongaCams", emoji: "🔴", color: C.pink,
    steps: [
      "Log into your BongaCams model account",
      "Go to Statistics → Earnings History",
      "Select your date range and click Export",
      "Save the CSV file to your computer",
      "Upload that file below ↓"
    ],
    tip: "BongaCams exports include date, username, tokens, and USD"
  },
  {
    name: "MyFreeCams", emoji: "🟠", color: C.gold,
    steps: [
      "Log into your MFC model account",
      "Go to Model Admin → Token Stats",
      "Click Transaction History and set your date range",
      "Click Export CSV",
      "Upload that file below ↓"
    ],
    tip: "MFC exports are very detailed — all transaction types included"
  }
]

export default function OnboardingPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [step, setStep] = useState('csv') // 'csv' | 'chaturbate_token' | 'done'
  const [tokenConnected, setTokenConnected] = useState(false)
  const [eventsConnected, setEventsConnected] = useState(false)
  const [broadcasterType, setBroadcasterType] = useState('female')
  const [selectedPlatform, setSelectedPlatform] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadError, setUploadError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/login"); return }
      const { data: profile } = await supabase
        .from("beta_users")
        .select("onboarding_complete")
        .eq("user_id", user.id)
        .single()
      if (profile?.onboarding_complete) { router.replace("/dashboard"); return }
      setUser(user)
      setChecking(false)
    }
    check()
  }, [router])

  const handleFile = async (file) => {
    if (!file || !user) return
    T.csvUploadStarted()
    setUploading(true)
    setUploadError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setUploadError("Not logged in"); setUploading(false); return }
      const fd = new FormData()
      fd.append("file", file)
      fd.append("platform", PLATFORMS[selectedPlatform].name)
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        T.csvUploadFailed(result.error || "upload_failed")
        setUploadError(result.error || "Upload failed — check the platform selection and try again")
        setUploading(false)
        return
      }
      await supabase.from("beta_users").upsert({
        user_id: user.id, email: user.email,
        onboarding_complete: true, signed_up_at: user.created_at
      }, { onConflict: "user_id" })
      T.csvUploadCompleted(result?.inserted || 0, 0)
      setUploadResult(result)
      setUploadDone(true)
      setStep('chaturbate_token')
    } catch (err) {
      setUploadError(err.message || "Something went wrong")
    } finally {
      setUploading(false)
    }
  }

  const skipToLive = async () => {
    if (!user) return
    await supabase.from("beta_users").upsert({
      user_id: user.id, email: user.email,
      onboarding_complete: true, signed_up_at: user.created_at
    }, { onConflict: "user_id" })
    router.push("/dashboard?tab=live")
  }

  const goToDashboard = () => router.push("/dashboard")

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #1e2d45", borderTopColor: C.cyan, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  const plat = PLATFORMS[selectedPlatform]

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(circle at 20% 20%, rgba(34,211,238,0.12), transparent 40%),
                   radial-gradient(circle at 80% 80%, rgba(236,72,153,0.12), transparent 40%), ${C.bg}`,
      fontFamily: "'Inter', sans-serif", color: C.text,
      padding: "40px 20px 80px"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes checkPop{0%{transform:scale(0)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
        .upload-zone:hover{border-color:rgba(34,211,238,0.6)!important;background:rgba(34,211,238,0.07)!important}
        .plat-btn:hover{border-color:rgba(255,255,255,0.2)!important}
        .tool-card:hover{transform:translateY(-2px);border-color:rgba(124,92,255,0.4)!important}
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* HEADER */}
        <div style={{ textAlign: "center", marginBottom: 40, animation: "fadeUp 0.4s ease both" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: "linear-gradient(135deg, #22D3EE, #EC4899)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, fontWeight: 900, color: "#fff",
            margin: "0 auto 20px",
            boxShadow: "0 12px 32px rgba(34,211,238,0.25)"
          }}>$</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: C.white, marginBottom: 6, lineHeight: 1.2 }}>
            Let's get your stats loaded 💰
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 8 }}>
            Takes about 2 minutes
          </p>
          <p style={{ fontSize: 15, color: C.muted, maxWidth: 440, margin: "0 auto", lineHeight: 1.7 }}>
            Watch the video below, then upload your CSV — your full dashboard unlocks instantly.
          </p>
        </div>

        {/* PROGRESS BAR */}
        {(() => {
          const steps = ['Stats', 'Tips', 'Done']
          const currentStepIndex = step === 'chaturbate_token' ? 0 : step === 'csv' ? 1 : 2
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', justifyContent: 'center' }}>
              {steps.map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: i <= currentStepIndex ? '#a855f7' : 'rgba(255,255,255,0.1)',
                    color: i <= currentStepIndex ? '#fff' : '#64748b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: '700'
                  }}>{i + 1}</div>
                  <span style={{ fontSize: '13px', color: i <= currentStepIndex ? '#f1f5f9' : '#64748b' }}>{s}</span>
                  {i < steps.length - 1 && (
                    <div style={{ width: '40px', height: '1px', background: i < currentStepIndex ? '#a855f7' : 'rgba(255,255,255,0.1)' }} />
                  )}
                </div>
              ))}
            </div>
          )
        })()}

        {/* SUCCESS STATE */}
        {uploadDone && uploadResult && step !== 'done' && (
          <div style={{
            padding: 40, borderRadius: 20, textAlign: "center",
            background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)",
            animation: "fadeUp 0.4s ease both", marginBottom: 24
          }}>
            <div style={{ fontSize: 56, marginBottom: 16, animation: "checkPop 0.5s ease both" }}>🎉</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.white, marginBottom: 8 }}>
              {uploadResult.inserted} tips imported!
            </div>
            {uploadResult.skipped > 0 && (
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
                ({uploadResult.skipped} duplicates skipped — that's normal)
              </div>
            )}
            <div style={{ fontSize: 14, color: C.text, marginBottom: 28, lineHeight: 1.6 }}>
              Your dashboard is ready. You'll see your total earnings, top fans,<br />
              best hours to stream, and personalized insights.
            </div>
            <button onClick={goToDashboard} style={{
              padding: "14px 40px", borderRadius: 12,
              background: "linear-gradient(135deg, #10B981, #22D3EE)",
              border: "none", color: "#fff", fontSize: 16, fontWeight: 800,
              cursor: "pointer", boxShadow: "0 8px 28px rgba(16,185,129,0.35)"
            }}>
              View My Dashboard →
            </button>
          </div>
        )}

        {!uploadDone && (
          <>
            {/* VIDEO TUTORIAL */}
            <div style={{
              marginBottom: 28, borderRadius: 18, overflow: "hidden",
              border: "1px solid rgba(34,211,238,0.2)",
              boxShadow: "0 0 40px rgba(34,211,238,0.07)",
              animation: "fadeUp 0.4s ease 0.05s both"
            }}>
              <div style={{
                padding: "14px 20px",
                background: "rgba(15,20,32,0.9)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", gap: 10
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#EC4899,#7C5CFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>▶</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>How to upload your CSV</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Watch first — takes 2 minutes</div>
                </div>
              </div>
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, background: "#000" }}>
                <iframe
                  src="https://www.youtube.com/embed/IJyzM7Pntyc?rel=0&modestbranding=1&mute=1"
                  title="How to upload your CSV to CamCash"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{
                    position: "absolute", top: 0, left: 0,
                    width: "100%", height: "100%"
                  }}
                />
              </div>
            </div>

            {/* CSV UPLOAD */}
            <div style={{
              padding: 28, borderRadius: 18,
              background: "rgba(15,20,32,0.8)", backdropFilter: "blur(20px)",
              border: "1px solid rgba(34,211,238,0.25)",
              marginBottom: 16, animation: "fadeUp 0.4s ease 0.1s both"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #22D3EE, #7C5CFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📁</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.white }}>Upload your earnings CSV</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Select your platform then drop your file</div>
                </div>
              </div>

              {/* Platform Tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {PLATFORMS.map((p, i) => (
                  <button key={p.name} className="plat-btn" onClick={() => setSelectedPlatform(i)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", transition: "all 0.15s",
                    background: selectedPlatform === i ? `${p.color}20` : "rgba(255,255,255,0.03)",
                    border: selectedPlatform === i ? `1px solid ${p.color}60` : "1px solid rgba(255,255,255,0.08)",
                    color: selectedPlatform === i ? p.color : C.muted
                  }}>
                    {p.emoji} {p.name}
                  </button>
                ))}
              </div>

              {/* Steps */}
              <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 12, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 11, color: plat.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                  How to export from {plat.name}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {plat.steps.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        background: `${plat.color}20`, border: `1px solid ${plat.color}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800, color: plat.color, marginTop: 1
                      }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: i === plat.steps.length - 1 ? C.white : C.text, lineHeight: 1.5, fontWeight: i === plat.steps.length - 1 ? 600 : 400 }}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, padding: "7px 10px", borderRadius: 8, background: `${plat.color}0d`, border: `1px solid ${plat.color}25`, fontSize: 11, color: plat.color }}>
                  💡 {plat.tip}
                </div>
              </div>

              {/* Drop Zone */}
              <div
                className="upload-zone"
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: "28px 20px", borderRadius: 14, textAlign: "center",
                  border: `2px dashed ${dragOver ? "rgba(34,211,238,0.7)" : "rgba(34,211,238,0.25)"}`,
                  background: dragOver ? "rgba(34,211,238,0.08)" : "rgba(34,211,238,0.03)",
                  cursor: uploading ? "not-allowed" : "pointer", transition: "all 0.15s"
                }}
              >
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files[0]; if (f) handleFile(f) }} />
                {uploading ? (
                  <>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid rgba(34,211,238,0.2)", borderTopColor: C.cyan, animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                    <div style={{ fontSize: 14, color: C.cyan, fontWeight: 600 }}>Processing your file...</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 4 }}>Drop your CSV here</div>
                    <div style={{ fontSize: 13, color: C.muted }}>or click to browse</div>
                  </>
                )}
              </div>

              {uploadError && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", fontSize: 13, color: C.red }}>
                  ⚠️ {uploadError}
                </div>
              )}
            </div>

            {/* CHATURBATE LIVE SYNC STEP */}
            {step === 'chaturbate_token' ? (
              <div style={{ marginBottom: 24, animation: "fadeUp 0.4s ease both" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                  Step 2 of 2
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 6 }}>
                  Connect Chaturbate Live Sync <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>(Optional)</span>
                </div>
                <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.65 }}>
                  Get live tips pushed to your dashboard while you stream — no extension needed.
                </p>

                {/* Broadcaster type selector */}
                {(() => {
                  const types = [
                    { id: 'female', label: 'Female', emoji: '👩' },
                    { id: 'male',   label: 'Male',   emoji: '👨' },
                    { id: 'trans',  label: 'Trans',  emoji: '🏳️‍⚧️' },
                    { id: 'couple', label: 'Couple', emoji: '👫' },
                  ]
                  return (
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                        I broadcast as
                      </label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {types.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setBroadcasterType(t.id)}
                            style={{
                              padding: '8px 16px', borderRadius: '100px',
                              border: broadcasterType === t.id ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)',
                              background: broadcasterType === t.id ? 'rgba(168,85,247,0.15)' : 'transparent',
                              color: broadcasterType === t.id ? '#a855f7' : '#94a3b8',
                              fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                            }}
                          >
                            {t.emoji} {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Direct link to token page */}
                <a
                  href="https://chaturbate.com/statsapi/authtoken/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(168,85,247,0.15)',
                    border: '1px solid rgba(168,85,247,0.3)',
                    borderRadius: '10px', padding: '12px 16px',
                    color: '#a855f7', textDecoration: 'none',
                    fontSize: '14px', fontWeight: '600',
                    marginBottom: '20px'
                  }}
                >
                  🔗 Open token page (direct link)
                  <span style={{ fontSize: '11px', color: '#64748b' }}>chaturbate.com/statsapi/authtoken/</span>
                </a>

                <ChaturbateTokenConnector
                  user={user}
                  broadcasterType={broadcasterType}
                  onConnected={({ hasEventsToken } = {}) => { setTokenConnected(true); if (hasEventsToken) setEventsConnected(true); setStep('done') }}
                />

                {/* Trust section */}
                <div style={{
                  marginTop: '24px', padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px', fontWeight: '600' }}>
                    🔒 What CamCash can read with this token:
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px' }}>✅ Your tip history and token amounts</p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px' }}>✅ Your stream session times</p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0' }}>❌ Cannot send tips, change settings, or act on your account</p>
                </div>

                <button
                  onClick={() => setStep('done')}
                  style={{
                    marginTop: 14, background: "none", border: "none",
                    color: C.muted, fontSize: 13, cursor: "pointer",
                    textDecoration: "underline", padding: 0
                  }}
                >
                  Skip for now →
                </button>
              </div>
            ) : null}

            {/* BOTTOM TWO OPTIONS */}
            {step === 'csv' && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32, animation: "fadeUp 0.4s ease 0.15s both" }}>
              <div style={{ padding: 22, borderRadius: 16, background: "rgba(15,20,32,0.6)", border: "1px solid rgba(168,85,247,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #a855f7, #EC4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📡</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Live Mode Instead</div>
                </div>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, marginBottom: 14 }}>
                  Install the Chrome extension — tips get tracked automatically while you stream. No CSV needed.
                </p>
                <button onClick={() => { T.extensionInstallStart(); skipToLive() }} style={{
                  width: "100%", padding: "10px 0", borderRadius: 10,
                  background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)",
                  color: "#a855f7", fontSize: 13, fontWeight: 700, cursor: "pointer"
                }}>
                  Get Started with Live Mode →
                </button>
              </div>

              <div style={{ padding: 22, borderRadius: 16, background: "rgba(15,20,32,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🧰</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Free Tools</div>
                </div>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, marginBottom: 14 }}>
                  Room Title Generator and Token Calculator work right now — no data needed.
                </p>
                <button onClick={goToDashboard} style={{
                  width: "100%", padding: "10px 0", borderRadius: 10,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer"
                }}>
                  Explore Dashboard First →
                </button>
              </div>
            </div>
            )}
          </>
        )}

        {/* DONE / ALL SET — outside !uploadDone so it renders regardless */}
        {step === 'done' && (
          <div style={{ animation: "fadeUp 0.4s ease both", marginBottom: 24 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.white, marginBottom: 8 }}>You&apos;re all set!</div>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>Based on what you connected:</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {tokenConnected && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 14, color: C.white }}>
                  <span>✅</span> <span>Chaturbate tip history synced</span>
                </div>
              )}
              {eventsConnected && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 14, color: C.white }}>
                  <span>✅</span> <span>Live tip tracking ready</span>
                </div>
              )}
              {uploadDone && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 14, color: C.white }}>
                  <span>✅</span> <span>Tip history uploaded ({uploadResult?.inserted || 0} tips)</span>
                </div>
              )}
              {!tokenConnected && !eventsConnected && !uploadDone && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 13, color: C.muted }}>
                  → Upload a CSV or connect your token anytime from the dashboard
                </div>
              )}
            </div>

            <button onClick={goToDashboard} style={{
              width: "100%", padding: "15px 0", borderRadius: 12,
              background: "linear-gradient(135deg, #10B981, #22D3EE)",
              border: "none", color: "#fff", fontSize: 16, fontWeight: 800,
              cursor: "pointer", boxShadow: "0 8px 28px rgba(16,185,129,0.3)"
            }}>
              Go to Dashboard →
            </button>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: C.muted }}>
          🔒 Your data is stored securely and never shared with anyone.
        </div>
      </div>
    </div>
  )
}
