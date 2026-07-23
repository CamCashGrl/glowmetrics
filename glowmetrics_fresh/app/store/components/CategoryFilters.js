'use client'

import { T } from './theme'
import { CATEGORIES } from '../../../lib/store/products'

export default function CategoryFilters({ active, onChange }) {
  return (
    <div
      id="category-filters"
      role="group"
      aria-label="Filter products by category"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        maxWidth: 1180,
        margin: '0 auto',
        padding: '0 32px 28px',
        scrollMarginTop: 88,
      }}
    >
      {CATEGORIES.map((cat) => {
        const isActive = cat === active
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            aria-pressed={isActive}
            style={{
              padding: '9px 18px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              border: isActive ? `1px solid ${T.pink}` : `1px solid ${T.border}`,
              background: isActive ? 'rgba(255,43,174,0.14)' : 'rgba(255,255,255,0.03)',
              color: isActive ? T.white : T.text,
              transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
            }}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}
