"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Button from "../../../components/ui/Button"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || "Invalid credentials")
        return
      }
      document.cookie = `gm_admin=${data.token};path=/;max-age=86400;SameSite=Strict`
      router.replace("/admin")
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#05050f", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono',monospace" }}>
      <div style={{ width:"100%", maxWidth:380, padding:"0 20px" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:48, height:48, borderRadius:12, background:"linear-gradient(135deg,#fbbf24,#fb923c)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, margin:"0 auto 16px", boxShadow:"0 0 24px #fbbf2440" }}>👑</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#faf5ff", letterSpacing:"-0.02em" }}>Admin Access</div>
          <div style={{ fontSize:12, color:"#5b4d7a", marginTop:4 }}>CamCash internal only</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:14 }}>
            <input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width:"100%", padding:"12px 14px", background:"#0e0e22", border:"1px solid #1a1a3e", borderRadius:10, color:"#faf5ff", fontSize:13, outline:"none", boxSizing:"border-box" }}
            />
          </div>
          <div style={{ marginBottom:20 }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width:"100%", padding:"12px 14px", background:"#0e0e22", border:"1px solid #1a1a3e", borderRadius:10, color:"#faf5ff", fontSize:13, outline:"none", boxSizing:"border-box" }}
            />
          </div>
          {error && (
            <div style={{ marginBottom:14, padding:"10px 14px", background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:8, fontSize:12, color:"#f87171" }}>
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} style={{ width:"100%" }}>
            {loading ? "Signing in…" : "Sign in →"}
          </Button>
        </form>
      </div>
    </div>
  )
}
