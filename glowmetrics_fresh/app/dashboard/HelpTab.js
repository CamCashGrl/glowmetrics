"use client"
import React from "react"
import { C, glassCard } from "./dashboardTheme"

export default function HelpTab() {
  return (
          <div style={{ maxWidth: 900 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>❓ How to Import Your Tips</h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>Follow these steps to get your tip data into CamCash in under 2 minutes</p>

            <div style={{ ...glassCard, borderRadius: 16, padding: 28, marginBottom: 32, border: "1px solid rgba(34,211,238,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #10B981, #22D3EE)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔍</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: C.white }}>How CamCash Actually Works</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { icon: "📁", title: "Your data, your files", body: "Everything you see in this dashboard comes directly from the CSV files you upload. We don't connect to Chaturbate, BongaCams, or any platform — you export the data yourself and bring it here." },
                  { icon: "💯", title: "100% real numbers", body: "Every dollar amount, tip count, fan name, and session shown is calculated from your actual CSV data. No estimates, no made-up stats. If it shows $1,700 — that's exactly what your CSV says you earned." },
                  { icon: "🐳", title: "Top Fans are your real tippers", body: "The fans listed under Top Fans are real usernames pulled from your tip history. Their totals, tip counts, and last tip dates all come directly from your uploaded data." },
                  { icon: "💌", title: "Message Generator — copy & paste only", body: "The 💌 Message button does NOT send messages. It generates a re-engagement message for you to copy, then go to that fan's profile on Chaturbate, BongaCams, or wherever they tipped you, and paste it yourself. CamCash has no access to any platform." },
                  { icon: "🔒", title: "Your data stays yours", body: "Your tip data is stored securely in your account only. It's never shared, sold, or visible to anyone else." },
                ].map(({ icon, title, body }) => (
                  <div key={title} style={{ display: "flex", gap: 14, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...glassCard, borderRadius: 16, padding: 28, marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #22D3EE, #7C5CFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: C.white }}>The Easiest Way — Works on Every Platform</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {[{ step: "1", icon: "🖱️", title: "Go to your platform", desc: "Log in and navigate to your earnings or tip history page" }, { step: "2", icon: "📋", title: "Select & copy the data", desc: "Choose your date range, highlight all tip rows and copy (Ctrl+C)" }, { step: "3", icon: "📄", title: "Paste into Google Sheets", desc: "Go to sheets.new and paste your data (Ctrl+V)" }, { step: "4", icon: "⬇️", title: "Download as CSV & import", desc: 'File → Download → "Comma Separated Values (.csv)" — then upload here' }].map(({ step, icon, title, desc }) => (
                  <div key={step} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 18, position: "relative", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ position: "absolute", top: 14, right: 14, width: 24, height: 24, borderRadius: "50%", background: "rgba(34,211,238,0.2)", border: "1px solid rgba(34,211,238,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.cyan }}>{step}</div>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 6 }}>{title}</div>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: 16, background: "rgba(0,0,0,0.3)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>💡</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 }}>Why Google Sheets?</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>Most cam platforms don't have a direct "Download CSV" button. Go to <span style={{ color: C.cyan, fontWeight: 600 }}>sheets.new</span> — opens instantly, no sign-in needed.</div>
                </div>
              </div>
            </div>

            <div style={{ ...glassCard, borderRadius: 14, padding: 24, marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 20 }}>🎬 Step-by-Step: Copy → Sheets → Download CSV</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[{ num: "01", color: C.cyan, text: "On your cam platform, find your tip/earnings history and set the date range you want" }, { num: "02", color: C.cyan, text: "Click the first row, scroll to the last row, hold Shift and click — then press Ctrl+C (Cmd+C on Mac)" }, { num: "03", color: C.indigo, text: "Open a new tab and go to sheets.new — a blank Google Sheet opens immediately" }, { num: "04", color: C.indigo, text: "Click cell A1 and press Ctrl+V — your data pastes in with columns already separated" }, { num: "05", color: C.pink, text: 'Click "File" in the top menu → hover "Download" → click "Comma Separated Values (.csv)"' }, { num: "06", color: C.green, text: 'The CSV file downloads to your computer — come back here, click "Import CSV", and select that file. Done! ✅' }].map(({ num, color, text }) => (
                  <div key={num} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color, minWidth: 28, paddingTop: 1 }}>{num}</div>
                    <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{text}</div>
                  </div>
                ))}
              </div>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 16 }}>📖 Platform-Specific Tips</h2>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Where to find the earnings data on each site before you copy it</p>
            {[{ emoji: "🟣", name: "Chaturbate", steps: ["Log into your Chaturbate broadcaster account", "Go to Stats & Data → Token Stats", "Select your date range (last 30 days, 90 days, or custom)", "Click \"Download CSV\" or \"Export\"", "Upload the CSV file to CamCash"], tip: "Chaturbate CSVs usually have \"Tip from:\" format" }, { emoji: "🔴", name: "BongaCams", steps: ["Log into your BongaCams model account", "Navigate to Statistics → Earnings History", "Select date range and filter by \"Tips\" or \"All Transactions\"", "Look for \"Export to Excel\" or \"Download CSV\" button", "Save the file and upload to CamCash"], tip: "BongaCams format: Date, Username, Type, Tokens, USD" }, { emoji: "🟠", name: "MyFreeCams (MFC)", steps: ["Log into your MFC model account at wiki.myfreecams.com", "Go to Model Admin → Token Stats", "Click \"Transaction History\" or \"Detailed Stats\"", "Select date range and click \"Export CSV\"", "Upload the exported file to CamCash"], tip: "MFC CSVs are usually very detailed with all transaction types" }, { emoji: "🟢", name: "CamSoda", steps: ["Log into your CamSoda broadcaster dashboard", "Navigate to Earnings → Transaction History", "Choose your date range (last week, month, or custom dates)", "Click \"Download\" or \"Export to CSV\"", "Save and upload to CamCash"], tip: "CamSoda exports include both tokens and USD amounts" }].map(({ emoji, name, steps, tip }) => (
              <div key={name} className="dash-card" style={{ ...glassCard, borderRadius: 14, padding: 24, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 32 }}>{emoji}</div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: C.white }}>{name}</h2>
                </div>
                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>
                  {steps.map((step, i) => <p key={i} style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step {i + 1}:</strong> {step}</p>)}
                  <div style={{ padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 10, marginTop: 8 }}>
                    <div style={{ fontSize: 13, color: C.text }}>💡 {tip}</div>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ background: "linear-gradient(135deg, rgba(124,92,255,0.15), rgba(236,72,153,0.15))", border: "1px solid rgba(236,72,153,0.3)", borderRadius: 14, padding: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 16 }}>💡 General Tips</h2>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>
                {[["Export regularly", "Download your data weekly or monthly"], ["Don't edit CSVs", "Upload the original file — we handle the formatting"], ["Multiple platforms", "Upload CSVs from different sites — we'll combine them"], ["Duplicates removed", "Don't worry about re-uploading the same data"], ["File size", "Most CSVs are under 5MB and upload instantly"]].map(([title, desc]) => (
                  <p key={title} style={{ marginBottom: 12 }}>✅ <strong style={{ color: C.white }}>{title}:</strong> {desc}</p>
                ))}
                <p>⚠️ <strong style={{ color: C.white }}>Privacy:</strong> Your data is encrypted and never shared</p>
              </div>
            </div>
          </div>
  )
}
