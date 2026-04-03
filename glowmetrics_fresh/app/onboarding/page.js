"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // Auth guard — if not logged in, send to login
  // If already completed onboarding, skip straight to dashboard
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/login"); return }

      const { data: profile } = await supabase
        .from("beta_users")
        .select("onboarding_complete")
        .eq("user_id", user.id)
        .single()

      if (profile?.onboarding_complete) {
        router.replace("/dashboard")
        return
      }

      setChecking(false)
    }
    check()
  }, [router])

  const handleContinue = () => {
    setLoading(true)
    router.push("/onboarding/loading")
  }

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: "#05070f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#ec4899", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#05070f",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, sans-serif",
      color: "white",
      padding: 20
    }}>
      <div style={{
        width: 70, height: 70, borderRadius: 18,
        background: "linear-gradient(135deg, #22D3EE, #EC4899)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 34, fontWeight: 800, marginBottom: 24,
        boxShadow: "0 12px 30px rgba(34,211,238,0.25)"
      }}>$</div>

      <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12, textAlign: "center" }}>
        Welcome to CamCash 💸
      </h1>
      <p style={{ color: "#94a3b8", fontSize: 16, marginBottom: 32, textAlign: "center", maxWidth: 420 }}>
        Let's set up your dashboard. It only takes a minute — then you'll see exactly where your money is coming from.
      </p>

      <button
        onClick={handleContinue}
        disabled={loading}
        style={{
          padding: "14px 44px",
          borderRadius: 12,
          background: "linear-gradient(135deg, #3b82f6, #ec4899)",
          color: "white",
          fontWeight: 700,
          fontSize: 16,
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          boxShadow: "0 8px 25px rgba(236,72,153,0.3)"
        }}
      >
        {loading ? "Taking you there..." : "Set Up My Dashboard →"}
      </button>
    </div>
  )
}
