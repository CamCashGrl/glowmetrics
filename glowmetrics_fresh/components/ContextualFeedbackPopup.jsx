'use client';

import { useState, useEffect } from 'react';
import FeedbackModal from './FeedbackModal';
import { track } from '../lib/track';

const DISMISSED_KEY = 'camcash_feedback_popup_dismissed';
const SUBMITTED_KEY = 'camcash_feedback_popup_submitted';
const RESURFACE_DAYS = 30;

/**
 * ContextualFeedbackPopup
 *
 * One-time, conservative feedback prompt. Does not fetch its own data —
 * it is gated entirely on values the dashboard has already loaded and
 * already uses elsewhere (dashboardReadiness from getDashboardReadiness(),
 * the existing "does this user have enough data/usage to have an opinion"
 * rule), so no new engagement scoring or thresholds are introduced here.
 *
 * Props:
 * - user: the authenticated user object (needs user.id)
 * - readiness: the dashboardReadiness value already computed by
 *     app/dashboard/page.js via getDashboardReadiness()
 * - suppress: boolean — pass true to prevent showing over a critical
 *     workflow (e.g. Live Mode active, onboarding in progress)
 */
export default function ContextualFeedbackPopup({ user, readiness, suppress = false }) {
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!user?.id || suppress) return;
    if (readiness !== 'ready') return; // not enough usage yet to have a meaningful opinion

    try {
      if (localStorage.getItem(SUBMITTED_KEY)) return; // never show again once submitted

      const dismissedAt = localStorage.getItem(DISMISSED_KEY);
      if (dismissedAt) {
        const daysSince = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
        if (daysSince < RESURFACE_DAYS) return;
      }
    } catch {
      return; // if storage is unavailable, err on the side of not nagging
    }

    setVisible(true);
  }, [user?.id, readiness, suppress]);

  if (!visible && !modalOpen) return null;

  const dismiss = () => {
    setVisible(false);
    track('feedback_dismissed', { source: 'contextual_popup' });
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
  };

  const openModal = () => {
    setVisible(false);
    setModalOpen(true);
    track('feedback_opened', { source: 'contextual_popup' });
  };

  const closeModal = (submitted) => {
    setModalOpen(false);
    try {
      if (submitted) localStorage.setItem(SUBMITTED_KEY, 'true');
      else localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {}
  };

  return (
    <>
      {visible && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9997,
            maxWidth: 300,
            background: 'rgba(15,20,32,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14,
            padding: '16px 18px',
            color: '#F8FAFC',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>Quick question 💙</div>
          <p style={{ color: '#94A3B8', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
            You're helping us build CamCash for cam models. What's one thing you wish CamCash did
            better?
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={dismiss}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 8,
                border: '1px solid #1f2233',
                background: 'transparent',
                color: '#94A3B8',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Maybe later
            </button>
            <button
              onClick={openModal}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 8,
                border: 'none',
                background: '#00e5cc',
                color: '#0a0b14',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Tell us
            </button>
          </div>
        </div>
      )}

      <FeedbackModal
        open={modalOpen}
        onClose={(submitted) => closeModal(submitted)}
        source="contextual_popup"
      />
    </>
  );
}
