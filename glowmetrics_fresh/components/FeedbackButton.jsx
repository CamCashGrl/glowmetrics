'use client';

import { useState } from 'react';
import FeedbackModal from './FeedbackModal';
import { track } from '../lib/track';

/**
 * FeedbackButton
 *
 * Persistent, compact glass-pill entry point into the feedback modal.
 * Self-contained — mount once inside the authenticated app (currently
 * app/dashboard/page.js) near the toast/footer area.
 */
export default function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          track('feedback_opened', { source: 'floating_button' });
        }}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9998,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '10px 16px',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(15,20,32,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          color: '#F8FAFC',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          transition: 'all 0.18s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.4)'; e.currentTarget.style.background = 'rgba(15,20,32,0.95)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(15,20,32,0.85)' }}
        aria-label="Give feedback"
      >
        💬 Feedback
      </button>

      <FeedbackModal open={open} onClose={() => setOpen(false)} source="floating_button" />
    </>
  );
}
