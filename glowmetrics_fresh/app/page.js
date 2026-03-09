"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../lib/supabase"

export default function Root() {
  const router = useRouter()
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? "/dashboard" : "/landing")
    })
  }, [router])

  return (
    <div style={{ minHeight:"100vh", background:"#05050f", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        border: "2px solid transparent",
        borderTopColor: "#c084fc",
        animation: "spin 0.8s linear infinite"
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
