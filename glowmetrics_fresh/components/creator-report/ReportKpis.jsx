"use client";

// Four headline metrics, each with its period-over-period comparison where one
// is available. A missing comparison renders nothing rather than a zero — a
// creator with no prior period has not been flat, she has no prior period.

function Delta({ pct }) {
  if (pct == null) return <span className="text-[11px] text-white/25">no prior period</span>;
  if (pct === 0) return <span className="text-[11px] text-white/30">unchanged</span>;
  const up = pct > 0;
  return (
    <span className={`text-[11px] font-medium ${up ? "text-cyan-300/80" : "text-white/40"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

export default function ReportKpis({ kpis = [], comparisonLabel }) {
  if (!kpis.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.map((k, i) => (
        <div
          key={k.id}
          className="
            report-rise rounded-2xl border border-white/[0.06] bg-[#08111d]/70
            p-5 shadow-[0_15px_50px_rgba(0,0,0,0.18)]
            transition-all duration-500
            hover:-translate-y-px hover:border-cyan-300/15
          "
          style={{ animationDelay: `${60 + i * 60}ms` }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
            {k.label}
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {k.value}
          </div>
          <div className="mt-2 flex flex-col gap-0.5">
            <Delta pct={k.delta} />
            {k.delta != null && comparisonLabel && (
              <span className="text-[10px] text-white/25">vs previous {comparisonLabel}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
