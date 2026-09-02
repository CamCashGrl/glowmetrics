"use client"
// ═══════════════════════════════════════════════════════════════════════════
// MASTER CARD TEMPLATE LIBRARY — visual test.
//
// Renders all eight templates together so the question that matters can be
// answered by looking: do these read as eight templates from ONE premium
// product? Judge the collection, not the individual cards.
//
// Every figure below is fixed demo content local to this preview. Nothing
// here touches analytics, Supabase or any production data path, and nothing
// here is rendered anywhere else in the app.
// ═══════════════════════════════════════════════════════════════════════════
import {
  StandardCard, MetricCard, SplitCard, InsightCard,
  ComparisonCard, FeatureCard, MilestoneCard, HeroCard,
} from "../../../components/ui/cards"

const DEMO = {
  fans:   { total: "1,284", delta: "↑ 12.6% this month", active: "642", fresh: "168" },
  earned: { value: "$2,481.42", delta: "↑ 18.4% this month", vs: "vs last month $2,096.33" },
  split:  { value: "$842", sub: "this month", rows: [
    { label: "Average / hour", value: "$38.22" },
    { label: "Sessions",       value: "22" },
    { label: "Best day",       value: "$126.40" },
    { label: "Tokens",         value: "16,840" },
  ]},
  platforms: [
    { key: "cb",  cells: { platform: "Chaturbate", earnings: "$1,284.50", rate: "$42.81", sessions: "26" } },
    { key: "mfc", cells: { platform: "MyFreeCams", earnings: "$842.10",   rate: "$31.22", sessions: "24" } },
    { key: "bc",  cells: { platform: "BongaCams",  earnings: "$432.75",   rate: "$18.45", sessions: "16" } },
    { key: "sc",  cells: { platform: "Stripchat",  earnings: "$287.20",   rate: "$12.31", sessions: "12" } },
  ],
  streak: [
    { day: "M", hit: true }, { day: "T", hit: true }, { day: "W", hit: true },
    { day: "T", hit: true }, { day: "F", hit: false }, { day: "S", hit: true }, { day: "S", hit: true },
  ],
}

const COLS = [
  { key: "platform", label: "Platform" },
  { key: "earnings", label: "Earnings" },
  { key: "rate",     label: "$/hr" },
  { key: "sessions", label: "Sessions" },
]

const Caption = ({ n, name, note }) => (
  <div style={{ margin: "10px 2px 0" }}>
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "#6f7b99" }}>
      <span style={{ color: "#FF2BAE" }}>{n}</span>  {name.toUpperCase()}
    </div>
    <div style={{ fontSize: 11.5, color: "#5f6a86", marginTop: 3 }}>{note}</div>
  </div>
)

export default function CardTemplateLibrary() {
  return (
    <div style={{ minHeight: "100vh", background: "#050713", padding: "36px 32px 70px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".2em", textTransform: "uppercase", color: "#6f7b99" }}>
          CamCashGrl · card template library
        </div>
        <h1 style={{ margin: "8px 0 4px", fontSize: 26, fontWeight: 800, color: "#f4f7ff", letterSpacing: "-0.02em" }}>
          8 master card templates
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "#8d93aa" }}>
          Each has a distinct purpose and layout, on one shared surface.
        </p>

        {/* Row 1 — the four everyday templates */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 26, alignItems: "start" }}>
          <div>
            <StandardCard eyebrow="Total fans" title="1,284" action="View all fans">
              <div style={{ marginTop: 14 }}>
                {[["Active fans", DEMO.fans.active], ["New fans", DEMO.fans.fresh]].map(([k, v]) => (
                  <div className="cc-t-split-row" key={k}><span>{k}</span><strong>{v}</strong></div>
                ))}
              </div>
            </StandardCard>
            <Caption n="01" name="Standard glass" note="Supporting information. The workhorse." />
          </div>

          <div>
            <MetricCard eyebrow="Total earnings" value={DEMO.earned.value} gradient
              delta={DEMO.earned.delta} footnote={DEMO.earned.vs} />
            <Caption n="02" name="Metric" note="One number deserves emphasis." />
          </div>

          <div>
            <SplitCard eyebrow="Estimated earnings" value={DEMO.split.value} valueSub={DEMO.split.sub}
              gradient rows={DEMO.split.rows} action="View full breakdown" onAction={() => {}} />
            <Caption n="03" name="Split / dashboard" note="A figure and what makes it up." />
          </div>

          <div>
            <InsightCard eyebrow="Your best window" icon="◴"
              headline="You're earning" figure="34% more" headlineAfter="between 8 PM – 11 PM."
              action="View streaming plan" onAction={() => {}}>
              Your highest performing window across the last 14 days of streaming.
            </InsightCard>
            <Caption n="04" name="Insight" note="Data turned into a takeaway." />
          </div>
        </div>

        {/* Row 2 — comparison, action, progress */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 16, marginTop: 26, alignItems: "start" }}>
          <div>
            <ComparisonCard eyebrow="Platform comparison" columns={COLS} rows={DEMO.platforms}
              topRowKey="cb" action="View all platforms" onAction={() => {}} />
            <Caption n="05" name="Comparison" note="Rankings and side-by-side performance." />
          </div>

          <div>
            <FeatureCard eyebrow="Creator Pro" headline={<>Turn your data<br />into a plan.</>}
              bullets={["Unlimited platform imports", "Advanced fan analytics", "Live mode + alerts"]}
              cta="Build My Plan →" onCta={() => {}}>
              Find your highest-value streaming windows.
            </FeatureCard>
            <Caption n="06" name="Feature / CTA" note="One important action per screen." />
          </div>

          <div>
            <MilestoneCard eyebrow="Monthly goal" value="$1,840" target="$2,500" percent={73}
              remaining="$660 to goal" streakLabel="7 day streaming streak" streak={DEMO.streak} />
            <Caption n="07" name="Milestone" note="Goals, progress, streaks." />
          </div>
        </div>

        {/* Row 3 — hero, rare by design */}
        <div style={{ marginTop: 26 }}>
          <HeroCard eyebrow="This month" headline="You are a" headlineAccent="top earner."
            stats={[{ value: "Top 12%", label: "On Chaturbate" }, { value: "$2,481", label: "This month" },
                    { value: "26", label: "Sessions" }, { value: "$42.81", label: "Best $/hr" }]}
            action="See what changed" onAction={() => {}}>
            You&apos;re in the top 12% of creators on Chaturbate this month, driven by a stronger
            hourly rate rather than more hours streamed.
          </HeroCard>
          <Caption n="08" name="Hero" note="Page-level emphasis. Rare by design." />
        </div>
      </div>
    </div>
  )
}
