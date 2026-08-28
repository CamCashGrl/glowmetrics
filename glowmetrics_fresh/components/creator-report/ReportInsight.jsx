"use client";

// The report's one insight surface. `size="primary"` gives a single finding
// more visual weight than the supporting ones — the report should read as a
// story with a lead, not a wall of identical tiles.

export default function ReportInsight({
  type = "insight",
  label,
  title,
  description,
  metric,
  metricLabel,
  actionLabel,
  onAction,
  size = "default",
  delay = 0,
}) {
  const icons = {
    opportunity: "✦",
    performance: "↗",
    fan: "♡",
    warning: "△",
    timing: "◈",
    retention: "∞",
  };

  const primary = size === "primary";

  return (
    <article
      className={[
        "report-rise group relative overflow-hidden rounded-2xl",
        "transition-all duration-500",
        "hover:-translate-y-px",
        primary
          ? "border border-cyan-300/15 bg-[#081522]/80 p-7 shadow-[0_0_35px_rgba(34,211,238,0.06)] hover:border-cyan-300/25"
          : "border border-cyan-300/10 bg-[#08111d]/75 p-5 hover:border-cyan-300/20 hover:bg-[#0a1624]/85 hover:shadow-[0_0_35px_rgba(34,211,238,0.07)]",
      ].join(" ")}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div
        className={[
          "pointer-events-none absolute -right-20 -top-20 rounded-full blur-3xl",
          "transition-all duration-700",
          primary
            ? "h-64 w-64 bg-cyan-400/[0.085] group-hover:bg-cyan-400/[0.12]"
            : "h-48 w-48 bg-cyan-400/[0.055] group-hover:bg-cyan-400/[0.09]",
        ].join(" ")}
      />

      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/10 bg-cyan-300/[0.04] text-cyan-300">
            {icons[type] || "✦"}
          </div>

          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/65">
            {label}
          </span>
        </div>

        <h3
          className={[
            "mt-5 font-medium tracking-tight text-white",
            primary ? "text-2xl leading-8" : "text-lg",
          ].join(" ")}
        >
          {title}
        </h3>

        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            {description}
          </p>
        )}

        {metric && (
          <div className="mt-5 flex items-baseline gap-2">
            <span
              className={[
                "font-semibold tracking-tight text-white",
                primary ? "text-4xl" : "text-2xl",
              ].join(" ")}
            >
              {metric}
            </span>

            {metricLabel && (
              <span className="text-xs text-white/30">{metricLabel}</span>
            )}
          </div>
        )}

        {actionLabel && (
          <button
            type="button"
            onClick={() => onAction?.()}
            className="mt-5 text-xs font-medium text-cyan-300/80 transition-colors hover:text-cyan-200"
          >
            {actionLabel}
            <span className="ml-1">→</span>
          </button>
        )}
      </div>
    </article>
  );
}
