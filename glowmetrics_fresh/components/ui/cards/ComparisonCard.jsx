"use client"
import React from "react"
import Card from "../Card"
import { Eyebrow, CardAction } from "./parts"

// 05 COMPARISON — platforms, periods, categories side by side. Built as a
// real table on the flat surface: comparison needs density and aligned
// figures, and any glow behind a grid of numbers is noise.
//
// `topRowKey` marks the leading row. The PARENT decides which row leads,
// from its own data — this component never ranks anything itself.
export default function ComparisonCard({
  eyebrow, columns = [],   // [{ key, label, align }]
  rows = [],               // [{ key, cells: { [colKey]: value } }]
  topRowKey, topBadge = "TOP",
  action, onAction, variant = "flat", ...rest
}) {
  return (
    <Card variant={variant} {...rest}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table className="cc-t-table">
          <thead>
            <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={topRowKey && r.key === topRowKey ? "is-top" : undefined}>
                {columns.map((c, i) => (
                  <td key={c.key}>
                    {r.cells[c.key]}
                    {i === 0 && topRowKey && r.key === topRowKey && (
                      <span className="cc-t-badge">{topBadge}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {action && <CardAction onClick={onAction}>{action}</CardAction>}
    </Card>
  )
}
