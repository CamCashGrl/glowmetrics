/**
 * FanManagementUI Component
 *
 * Provides UI for:
 * - Archiving fans (non-destructive)
 * - Dismissing discoveries/alerts (non-destructive)
 * - Managing archived fans
 * - Restoring dismissed discoveries
 *
 * Does NOT modify fan data or tier/status
 */

import React, { useState } from 'react'
import Button from './ui/Button'

const C = {
  bg: '#040812',
  card: 'rgba(15,20,32,0.75)',
  border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7',
  cyan: '#22d3ee',
  white: '#f1f5f9',
  muted: '#94a3b8',
  red: '#f87171'
}

/**
 * Archive Button — adds fan to archive (non-destructive)
 * Usage: <ArchiveButton fanKey="twitch:username" onArchive={handleArchive} />
 */
export function ArchiveButton({ fanKey, isArchived, onArchive }) {
  return (
    <button
      onClick={() => onArchive(fanKey)}
      style={{
        padding: '6px 12px',
        fontSize: 12,
        background: isArchived ? 'rgba(100,100,100,0.3)' : 'rgba(168,85,247,0.2)',
        border: `1px solid ${isArchived ? C.muted : C.purple}`,
        color: isArchived ? C.muted : C.white,
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      title={isArchived ? 'Fan is archived' : 'Archive this fan (non-destructive)'}
    >
      {isArchived ? '📦 Archived' : '📦 Archive'}
    </button>
  )
}

/**
 * Dismiss Button — hides a discovery alert (non-destructive)
 * Usage: <DismissButton discoveryId="alert_id" onDismiss={handleDismiss} />
 */
export function DismissButton({ discoveryId, isDismissed, onDismiss }) {
  return (
    <button
      onClick={() => onDismiss(discoveryId)}
      style={{
        padding: '6px 12px',
        fontSize: 12,
        background: isDismissed ? 'rgba(100,100,100,0.3)' : 'rgba(236,72,153,0.2)',
        border: `1px solid ${isDismissed ? C.muted : C.red}`,
        color: isDismissed ? C.muted : C.white,
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      title={isDismissed ? 'Discovery is dismissed' : 'Dismiss this discovery (non-destructive)'}
    >
      {isDismissed ? '👁️ Dismissed' : '🙈 Dismiss'}
    </button>
  )
}

/**
 * ArchivedFansPanel — shows all archived fans with unarchive option
 * Usage: <ArchivedFansPanel archivedFans={fans} onUnarchive={handleUnarchive} />
 */
export function ArchivedFansPanel({ archivedFans, onUnarchive }) {
  if (!archivedFans || archivedFans.length === 0) {
    return (
      <div style={{
        padding: 20,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        color: C.muted,
        textAlign: 'center'
      }}>
        No archived fans
      </div>
    )
  }

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      overflow: 'hidden'
    }}>
      <div style={{
        padding: 16,
        borderBottom: `1px solid ${C.border}`,
        fontWeight: 600,
        color: C.white
      }}>
        Archived Fans ({archivedFans.length})
      </div>
      <div style={{ padding: 12 }}>
        {archivedFans.map(fan => (
          <div key={`${fan.platform}:${fan.username}`} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 12,
            borderBottom: `1px solid ${C.border}`,
            fontSize: 14
          }}>
            <div>
              <div style={{ color: C.white, fontWeight: 600 }}>
                {fan.username}
              </div>
              <div style={{ color: C.muted, fontSize: 12 }}>
                {fan.platform} • {fan.tier} • ${fan.totalUSD.toFixed(2)} lifetime
              </div>
            </div>
            <button
              onClick={() => onUnarchive(`${fan.platform}:${fan.username}`)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: 'rgba(16,185,129,0.2)',
                border: `1px solid #10b981`,
                color: '#10b981',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📦 Unarchive
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * DismissedDiscoveriesPanel — shows dismissed alerts with restore option
 * Usage: <DismissedDiscoveriesPanel discoveries={discoveries} onRestore={handleRestore} />
 */
export function DismissedDiscoveriesPanel({ dismissedDiscoveries, onRestore }) {
  if (!dismissedDiscoveries || dismissedDiscoveries.length === 0) {
    return (
      <div style={{
        padding: 20,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        color: C.muted,
        textAlign: 'center'
      }}>
        No dismissed discoveries
      </div>
    )
  }

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      overflow: 'hidden'
    }}>
      <div style={{
        padding: 16,
        borderBottom: `1px solid ${C.border}`,
        fontWeight: 600,
        color: C.white
      }}>
        Dismissed Discoveries ({dismissedDiscoveries.length})
      </div>
      <div style={{ padding: 12 }}>
        {dismissedDiscoveries.map(discovery => (
          <div key={discovery.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 12,
            borderBottom: `1px solid ${C.border}`,
            fontSize: 14
          }}>
            <div style={{ color: C.white }}>
              {discovery.message || discovery.type}
            </div>
            <button
              onClick={() => onRestore(discovery.id)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: 'rgba(34,211,238,0.2)',
                border: `1px solid ${C.cyan}`,
                color: C.cyan,
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              👁️ Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
