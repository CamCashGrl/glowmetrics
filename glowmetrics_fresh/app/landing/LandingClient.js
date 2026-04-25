export const metadata = {
  title: "Cam Model Tools & Analytics | Increase Tips & Earnings | CamCash",
  description:
    "Track your cam earnings, identify top spenders, and increase your tips with CamCash.",
};

"use client"
import { useState, useEffect } from "react"

export default function LandingPage() {

  const [msgIndex, setMsgIndex] = useState(0)
  const [titleIndex, setTitleIndex] = useState(0)
  const [copied, setCopied] = useState(false)

  const messages = [
    "Hey I've been thinking about you... I'm live tonight",
    "Miss you come make tonight fun",
    "It's been a while... come back",
  ]

  const titles = [
    "Come hang out with me tonight",
    "VIP show tonight don't miss it",
    "Feeling naughty come watch",
  ]

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#05070f", color: "white", fontFamily: "Inter, sans-serif" }}>

      {/* HERO */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 40 }}>

          {/* LEFT */}
          <div>

            <h1 style={{ fontSize: 48, fontWeight: 900, lineHeight: 1.1 }}>
              Turn Your Fans Into<br />
              <span style={{
                background: "linear-gradient(135deg,#3b82f6,#ec4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}>
                More Money
              </span>{" "}
              — Automatically
            </h1>

            <p style={{ marginTop: 20, color: "#94a3b8" }}>
              See your biggest spenders and exactly what to do next.
            </p>

            {/* 🔥 GENERATORS ABOVE THE FOLD */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 30 }}>

              {/* MESSAGE GENERATOR */}
              <div style={{ background: "#111", padding: 18, borderRadius: 12 }}>
                <div style={{ color: "#a855f7", fontWeight: 600 }}>Message Generator</div>
                <div style={{ marginTop: 10 }}>{messages[msgIndex]}</div>

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button onClick={() => setMsgIndex((msgIndex + 1) % messages.length)}>
                    Generate
                  </button>
                  <button onClick={() => handleCopy(messages[msgIndex])}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {/* ROOM TITLE GENERATOR */}
              <div style={{ background: "#111", padding: 18, borderRadius: 12 }}>
                <div style={{ color: "#a855f7", fontWeight: 600 }}>Room Title Generator</div>
                <div style={{ marginTop: 10 }}>{titles[titleIndex]}</div>

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button onClick={() => setTitleIndex((titleIndex + 1) % titles.length)}>
                    Generate
                  </button>
                  <button onClick={() => handleCopy(titles[titleIndex])}>
                    Copy
                  </button>
                </div>
              </div>

            </div>

            {/* 🔥 CTA BUTTONS */}
            <div style={{ display: "flex", gap: 16, marginTop: 30 }}>
              <button className="pulse-btn">Engage Now</button>
              <button className="pulse-btn alt">Message Now</button>
            </div>

          </div>

          {/* RIGHT AUTH PANEL */}
          <div style={{
            background: "#111",
            padding: 20,
            borderRadius: 12,
            height: "fit-content"
          }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Sign Up</div>
            <input placeholder="Email" style={{ width: "100%", marginBottom: 10 }} />
            <input placeholder="Password" style={{ width: "100%", marginBottom: 10 }} />
            <button style={{ width: "100%" }}>Start Free</button>
          </div>

        </div>
      </div>

      {/* ANIMATION */}
      <style jsx>{`
        .pulse-btn {
          padding: 12px 20px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg,#3b82f6,#ec4899);
          color: white;
          font-weight: 700;
          cursor: pointer;
          animation: pulse 2s infinite;
        }

        .pulse-btn.alt {
          background: #1e293b;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }

        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 380px"] {
            grid-template-columns: 1fr !important;
          }

          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

    </div>
  )
}