// Master card template library. Every template composes the shared Card
// foundation (components/ui/Card.jsx) — surface, glow, hover, focus and
// reduced-motion live there; these own layout and hierarchy only.
export { default as StandardCard }   from "./StandardCard"
export { default as MetricCard }     from "./MetricCard"
export { default as SplitCard }      from "./SplitCard"
export { default as InsightCard }    from "./InsightCard"
export { default as ComparisonCard } from "./ComparisonCard"
export { default as FeatureCard }    from "./FeatureCard"
export { default as MilestoneCard }  from "./MilestoneCard"
export { default as HeroCard }       from "./HeroCard"
export * from "./parts"
