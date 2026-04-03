"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../../lib/supabase"

export default function OnboardingLoadingPage() {
  const router = useRouter()
  const [status, setStatus] = useState("Setting up your dashboard...")

  useEffect(() => {
    const complete = async () => {
      try {
        // Get the current user — server-verified, never stale
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace("/login"); return }

        setStatus("Saving your progress...")

        // Mark onboarding complete directly in Supabase — no API route needed
        const { error } = await supabase
          .from("beta_users")
          .upsert(
            { user_id: user.id, email: user.email, onboarding_complete: true },
            { onConflict: "user_id" }
          )

        if (error) {
          console.error("Failed to mark onboarding complete:", error)
          // Still send them to dashboard — don't block on this
        }

        setStatus("You're all set! Taking you to your dashboard...")

        // Small delay so the message reads naturally
        await new Promise(r => setTimeout(r, 1200))

        router.replace("/dashboard")
      } catch (err) {
        console.error("Onboarding error:", err)
        // Fail safe — always push to dashboard
        router.replace("/dashboard")
      }
    }

    complete()
  }, [router])

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
      gap: 24
    }}>
      {/* Spinner */}
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        border: "3px solid rgba(255,255,255,0.08)",
        borderTopColor: "#ec4899",
        animation: "spin 0.8s linear infinite"
      }} />

      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 18, fontWeight: 600, color: "white", marginBottom: 8 }}>
          {status}
        </p>
        <p style={{ fontSize: 13, color: "#475569" }}>
          This only takes a second
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
