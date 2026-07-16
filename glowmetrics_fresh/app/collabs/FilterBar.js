"use client"
import { useState } from 'react'
import { C } from './theme'
import { COLLAB_TYPES, PLATFORMS, PARTICIPATION_MODES, EXPERIENCE_LEVELS } from '../../lib/collab/constants'

const selectStyle = {
  padding: '9px 10px', borderRadius: 10, border: `1px solid ${C.border}`,
  background: 'rgba(255,255,255,0.03)', color: C.white, fontSize: 12.5, fontWeight: 600,
  outline: 'none', width: '100%',
}

const labelStyle = { fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }

export const DEFAULT_FILTERS = {
  search: '',
  collabType: '',
  platform: '',
  location: '',
  participationMode: '',
  creatorNiche: '',
  experiencePreference: '',
  verifiedOnly: false,
  sort: 'newest',
}

function FilterFields({ filters, setFilter }) {
  return (
    <>
      <div>
        <label style={labelStyle}>Collaboration Type</label>
        <select style={selectStyle} value={filters.collabType} onChange={e => setFilter('collabType', e.target.value)}>
          <option value="">All types</option>
          {COLLAB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Platform</label>
        <select style={selectStyle} value={filters.platform} onChange={e => setFilter('platform', e.target.value)}>
          <option value="">All platforms</option>
          {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Online / In-Person</label>
        <select style={selectStyle} value={filters.participationMode} onChange={e => setFilter('participationMode', e.target.value)}>
          <option value="">Either</option>
          {PARTICIPATION_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Location</label>
        <input style={selectStyle} placeholder="City or region" value={filters.location} onChange={e => setFilter('location', e.target.value)} />
      </div>
      <div>
        <label style={labelStyle}>Creator Niche</label>
        <input style={selectStyle} placeholder="e.g. cosplay, GFE, fitness" value={filters.creatorNiche} onChange={e => setFilter('creatorNiche', e.target.value)} />
      </div>
      <div>
        <label style={labelStyle}>Experience Level</label>
        <select style={selectStyle} value={filters.experiencePreference} onChange={e => setFilter('experiencePreference', e.target.value)}>
          <option value="">Any</option>
          {EXPERIENCE_LEVELS.filter(l => l.value !== 'any').map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Sort By</label>
        <select style={selectStyle} value={filters.sort} onChange={e => setFilter('sort', e.target.value)}>
          <option value="newest">Newest posts</option>
          <option value="upcoming">Upcoming collaboration date</option>
        </select>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.text, fontWeight: 600, cursor: 'pointer', paddingTop: 18 }}>
        <input type="checkbox" checked={filters.verifiedOnly} onChange={e => setFilter('verifiedOnly', e.target.checked)} />
        Verified creators only
      </label>
    </>
  )
}

export default function FilterBar({ filters, onChange }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  function setFilter(key, value) {
    onChange({ ...filters, [key]: value })
  }

  const activeCount = Object.entries(filters).filter(([k, v]) => k !== 'search' && k !== 'sort' && !!v && v !== false).length

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <input
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
          placeholder="Search collabs by title, description, or tag…"
          style={{ ...selectStyle, flex: 1, padding: '11px 14px', fontSize: 13.5 }}
        />
        <button
          onClick={() => setDrawerOpen(true)}
          className="collab-filter-toggle"
          style={{
            display: 'none', alignItems: 'center', gap: 6, padding: '11px 16px', borderRadius: 10,
            border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: C.white,
            fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          ⚙️ Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
      </div>

      <div className="collab-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <FilterFields filters={filters} setFilter={setFilter} />
      </div>

      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85vh', overflowY: 'auto',
            background: '#0b0f1c', borderTop: `1px solid ${C.border}`, borderRadius: '18px 18px 0 0', padding: '18px 18px 28px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.white }}>Filters</span>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FilterFields filters={filters} setFilter={setFilter} />
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              style={{ width: '100%', marginTop: 20, padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(90deg,#22D3EE,#a855f7)', color: '#05070f', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}
            >
              Show Results
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 860px) {
          .collab-filter-grid { display: none !important; }
          .collab-filter-toggle { display: inline-flex !important; }
        }
      `}</style>
    </div>
  )
}
