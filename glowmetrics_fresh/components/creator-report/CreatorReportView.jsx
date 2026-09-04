"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CREATOR REPORT — the reflective surface.
//
// Command Center: "your window starts in 42 minutes."
// Report:         "Thursday 8 PM is your strongest historical window."
//
// Same data, different question. Nothing here is live or countdown-shaped.
//
// It COMPUTES NOTHING. Every figure comes from lib/creatorReportData.js, which
// itself only reads aggregateRows() output. Changing the period re-runs the
// SAME engine over a date-bounded slice of the same rows, so a 30-day view can
// never disagree with all-time about what a session or an hourly rate is.
//
// Sections render only when their data exists. A creator with a thin history
// sees a short, honest report rather than a full-length one padded with
// hedged filler.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import {
  REPORT_PERIODS, splitByPeriod, buildKpis, buildSummary, buildPatterns,
  buildSessionBands, buildFanEconomy, buildTrajectory, buildWorking,
  buildWorkOn, buildNextMoves,
} from "../../lib/creatorReportData";
import ReportInsight from "./ReportInsight";
import ReportKpis from "./ReportKpis";
import {
  SectionLabel, Surface, ReportHeaderBar, SessionBands, FanDistribution,
  NextMoves, FindingList,
} from "./ReportSections";

export default function CreatorReportView({
  tips = [],
  analytics,
  runEngine,
  timezone = "UTC",
  updatedLabel,
  onAction,
}) {
  const [period, setPeriod] = useState("30d");
  const meta = REPORT_PERIODS.find((p) => p.id === period) || REPORT_PERIODS[1];

  // All-time uses the analytics the dashboard already computed; a bounded
  // period re-runs the same engine over the slice. Memoised on the period so
  // switching does not re-run the engine on every render.
  const { current, previous } = useMemo(
    () => splitByPeriod(tips, meta.days),
    [tips, meta.days]
  );

  const a = useMemo(() => {
    if (!meta.days) return analytics;
    if (!runEngine || !current.length) return null;
    try { return runEngine(current, timezone); } catch { return null; }
  }, [meta.days, analytics, runEngine, current, timezone]);

  const prev = useMemo(() => {
    if (!meta.days || !runEngine || !previous.length) return null;
    try { return runEngine(previous, timezone); } catch { return null; }
  }, [meta.days, runEngine, previous, timezone]);

  const kpis = useMemo(() => buildKpis(a, prev), [a, prev]);
  const summary = useMemo(() => buildSummary(a, prev, meta.label), [a, prev, meta.label]);
  const patterns = useMemo(() => buildPatterns(a), [a]);
  const bands = useMemo(() => buildSessionBands(a), [a]);
  const fans = useMemo(() => buildFanEconomy(a), [a]);
  const trajectory = useMemo(() => buildTrajectory(a, prev, meta.label), [a, prev, meta.label]);
  const working = useMemo(() => buildWorking(a), [a]);
  const workOn = useMemo(() => buildWorkOn(a), [a]);
  const moves = useMemo(() => buildNextMoves(a), [a]);

  const hasAnything = (a?.totalTips || 0) > 0;
  const primary = patterns[0] || null;
  const supporting = patterns.slice(1);

  return (
    <div className="relative">
      {/* Atmospheric light. Barely visible on purpose. */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[12%] top-[8%] h-[450px] w-[450px] rounded-full bg-cyan-400/[0.025] blur-[140px]" />
        <div className="absolute right-[8%] top-[35%] h-[500px] w-[500px] rounded-full bg-blue-500/[0.018] blur-[150px]" />
      </div>

      <style>{`
        @keyframes report-rise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .report-rise { animation: report-rise 500ms cubic-bezier(0.22,1,0.36,1) both; }
        @media (prefers-reduced-motion: reduce) { .report-rise { animation: none; } }
      `}</style>

      <ReportHeaderBar
        periods={REPORT_PERIODS}
        period={period}
        onPeriodChange={setPeriod}
        updatedLabel={updatedLabel}
      />

      {!hasAnything ? (
        <Surface className="mt-8 p-8" delay={80}>
          <h2 className="text-lg font-medium text-white">Building your report</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-white/50">
            CamCash needs a little more history before it can identify reliable patterns
            {meta.days ? ` in the last ${meta.label.toLowerCase()}` : ""}. Keep importing your
            streams and stronger insights will appear here.
          </p>
        </Surface>
      ) : (
        <>
          <div className="mt-7">
            <ReportKpis kpis={kpis} comparisonLabel={meta.days ? meta.label.toLowerCase() : null} />
          </div>

          {summary && (
            <Surface highlight className="mt-4 p-6" delay={320}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/65">
                Your performance at a glance
              </div>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-white/75">{summary}</p>
            </Surface>
          )}

          {/* ── STRONGEST PATTERNS — one lead, then supporting ───────── */}
          {primary && (
            <>
              <SectionLabel>Your strongest patterns</SectionLabel>
              <ReportInsight
                size="primary"
                type={primary.type}
                label={primary.label}
                title={primary.title}
                description={
                  primary.note ? `${primary.description} ${primary.note}.` : primary.description
                }
                metric={primary.metric}
                metricLabel={primary.metricLabel}
              />
              {supporting.length > 0 && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {supporting.map((p, i) => (
                    <ReportInsight
                      key={p.id}
                      type={p.type}
                      label={p.label}
                      title={p.title}
                      description={p.note ? `${p.description} ${p.note}.` : p.description}
                      metric={p.metric}
                      metricLabel={p.metricLabel}
                      delay={60 + i * 60}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── SESSIONS ─────────────────────────────────────────────── */}
          {bands && (
            <>
              <SectionLabel>How your sessions perform</SectionLabel>
              <Surface className="p-6">
                <p className="mb-6 max-w-2xl text-sm leading-6 text-white/55">
                  <span className="text-white/80">{bands.strongest.label}</span> sessions
                  currently earn the most on average. This is what your own history shows —
                  not a target.
                </p>
                <SessionBands data={bands} />
              </Surface>
            </>
          )}

          {/* ── FAN ECONOMY ──────────────────────────────────────────── */}
          {(fans.economy?.multiplier || fans.concentration) && (
            <>
              <SectionLabel>Your fan economy</SectionLabel>
              <div className="grid gap-3 md:grid-cols-2">
                {fans.economy?.multiplier > 1 && (
                  <ReportInsight
                    type="retention"
                    label="Returning fans"
                    title={`Returning fans spend ${fans.economy.multiplier}× more`}
                    description={`${fans.economy.returningPct}% of your fans have come back to tip again, averaging $${fans.economy.avgReturnSpend} against $${fans.economy.avgNewSpend} from one-time tippers.`}
                  />
                )}
                {fans.concentration && (
                  <ReportInsight
                    type="fan"
                    label="Revenue concentration"
                    title={`Your top 3 fans generate ${fans.concentration.top3Pct}% of revenue`}
                    description="A committed group of repeat supporters is carrying a large share of your income."
                  />
                )}
              </div>
              {fans.concentration && (
                <Surface className="mt-3 p-6">
                  <FanDistribution dep={fans.concentration} />
                </Surface>
              )}
            </>
          )}

          {/* ── TRAJECTORY ───────────────────────────────────────────── */}
          {trajectory && (
            <>
              <SectionLabel>Your trajectory</SectionLabel>
              <Surface className="p-6" highlight={trajectory.dir === "up"}>
                <div className="flex items-baseline gap-3">
                  <span className="text-xl text-cyan-300/70">{trajectory.arrow}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/65">
                    {trajectory.word}
                  </span>
                </div>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-white/70">{trajectory.text}</p>
              </Surface>
            </>
          )}

          {/* ── WORKING / WORK ON ────────────────────────────────────── */}
          {(working.length > 0 || workOn.length > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              {working.length > 0 && (
                <div>
                  <SectionLabel>What&apos;s working</SectionLabel>
                  <Surface className="p-6">
                    <FindingList items={working} icon="✦" />
                  </Surface>
                </div>
              )}
              {workOn.length > 0 && (
                <div>
                  <SectionLabel>What to work on</SectionLabel>
                  <Surface className="p-6">
                    <FindingList items={workOn} icon="△" />
                  </Surface>
                </div>
              )}
            </div>
          )}

          {/* ── NEXT MOVES ───────────────────────────────────────────── */}
          {moves.length > 0 && (
            <>
              <SectionLabel>Your next moves</SectionLabel>
              <Surface className="p-6 mb-4">
                <NextMoves moves={moves} />
              </Surface>
            </>
          )}
        </>
      )}
    </div>
  );
}
