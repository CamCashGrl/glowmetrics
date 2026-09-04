"use client";

// The report's smaller building blocks, kept together because each is a few
// lines and they share one visual language.

export function SectionLabel({ children, delay = 0 }) {
  return (
    <h2
      className="report-rise mb-4 mt-12 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40"
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </h2>
  );
}

export function Surface({ children, highlight = false, className = "", delay = 0 }) {
  return (
    <div
      className={[
        "report-rise rounded-2xl transition-all duration-500",
        highlight
          ? "border border-cyan-300/15 bg-[#081522]/80 shadow-[0_0_35px_rgba(34,211,238,0.06)]"
          : "border border-white/[0.06] bg-[#08111d]/70 shadow-[0_15px_50px_rgba(0,0,0,0.18)]",
        className,
      ].join(" ")}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/** Period selector. */
export function ReportPeriod({ periods, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {periods.map((p) => {
        const on = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            aria-pressed={on}
            className={[
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-300",
              on
                ? "border border-cyan-300/30 bg-cyan-300/[0.07] text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.08)]"
                : "border border-white/[0.07] bg-white/[0.02] text-white/45 hover:border-white/15 hover:text-white/70",
            ].join(" ")}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/** Header. Restrained — the report is the content, not the title. */
export function ReportHeaderBar({ periods, period, onPeriodChange, updatedLabel }) {
  return (
    <header className="report-rise relative">
      <div className="pointer-events-none absolute -top-8 left-0 h-32 w-72 rounded-full bg-cyan-400/[0.05] blur-[90px]" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Creator Report</h1>
          <p className="mt-1 text-sm text-white/40">Your performance, patterns &amp; opportunities</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <ReportPeriod periods={periods} value={period} onChange={onPeriodChange} />
          {updatedLabel && <span className="text-[10px] text-white/25">{updatedLabel}</span>}
        </div>
      </div>
    </header>
  );
}

/** Session-length bands. The strongest band gets the glow. */
export function SessionBands({ data }) {
  if (!data) return null;
  const { bands, max, strongest } = data;
  return (
    <div className="space-y-3">
      {bands.map((b) => {
        const pct = max > 0 ? Math.max((b.avgUSD / max) * 100, b.count ? 4 : 0) : 0;
        const best = b.id === strongest.id && b.count > 0;
        return (
          <div key={b.id} className="flex items-center gap-4">
            <span className="w-24 shrink-0 text-xs text-white/40">{b.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className={[
                  "h-full rounded-full transition-all duration-700",
                  best
                    ? "bg-cyan-300/70 shadow-[0_0_16px_rgba(34,211,238,0.45)]"
                    : "bg-cyan-300/20",
                ].join(" ")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs text-white/45">
              {b.count ? `$${Math.round(b.avgUSD)} avg` : "no sessions"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Fan concentration distribution. */
export function FanDistribution({ dep }) {
  if (!dep) return null;
  const rows = [
    { label: "Top 1 fan", pct: dep.top1Pct },
    { label: "Top 3 fans", pct: dep.top3Pct },
    { label: "Top 5 fans", pct: dep.top5Pct },
    { label: "Everyone else", pct: Math.max(100 - (dep.top5Pct || 0), 0) },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.label} className="flex items-center gap-4">
          <span className="w-28 shrink-0 text-xs text-white/40">{r.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className="h-full rounded-full bg-cyan-300 transition-all duration-700"
              style={{ width: `${Math.max(r.pct || 0, 2)}%`, opacity: 0.7 - i * 0.13 }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-white/45">
            {r.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

/** Numbered next moves. */
export function NextMoves({ moves = [] }) {
  if (!moves.length) return null;
  return (
    <ol className="space-y-4">
      {moves.map((m, i) => (
        <li key={i} className="flex gap-4">
          <span className="mt-0.5 text-xs font-semibold tabular-nums text-cyan-300/50">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="text-sm leading-6 text-white/70">{m}</span>
        </li>
      ))}
    </ol>
  );
}

/** A short list of findings — used by What's Working and What To Work On. */
export function FindingList({ items = [], icon = "✦" }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-4">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 shrink-0 text-cyan-300/60">{icon}</span>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
              {it.label}
            </div>
            <div className="mt-1 text-sm leading-6 text-white/65">{it.text}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
