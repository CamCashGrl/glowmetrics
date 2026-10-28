'use client'
import { useState } from 'react'
import { allTimeZones, isValidTimeZone, timeZoneLabel } from '../lib/creatorTimezone'

// Searchable IANA timezone picker shared by onboarding Step 1 and the
// dashboard sidebar. Only ever emits valid IANA zones via onPick.
export default function TimezoneSelect({ value, onPick, fontSize = 12 }) {
  const [query, setQuery] = useState('')
  const zones = allTimeZones()
  const q = query.trim().toLowerCase().replace(/\s+/g, '_')
  const matches = q ? zones.filter(z => z.toLowerCase().includes(q) || timeZoneLabel(z).toLowerCase().replace(/\s+/g, '_').includes(q)) : zones
  const field = { width: '100%', background: 'rgba(4,6,18,0.92)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e2e8f0', fontSize }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search city or region…" aria-label="Search timezones" autoFocus
        style={{ ...field, padding: '8px 10px', color: '#f8fafc' }} />
      <select aria-label="Timezone" size={4} value={matches.includes(value) ? value : ''} onChange={e => { if (isValidTimeZone(e.target.value)) { onPick(e.target.value); setQuery('') } }}
        style={{ ...field, padding: 4 }}>
        {matches.map(z => (<option key={z} value={z}>{z.replace(/_/g, ' ')}</option>))}
      </select>
    </div>
  )
}
