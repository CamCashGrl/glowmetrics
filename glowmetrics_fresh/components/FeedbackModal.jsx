'use client';

import { useState } from 'react';
import Button from './ui/Button';
import { track } from '../lib/track';

const SENTIMENTS = [
  { id: 'love_it', emoji: '😍', label: 'Love it' },
  { id: 'good', emoji: '🙂', label: 'Good' },
  { id: 'okay', emoji: '😐', label: "It's okay" },
  { id: 'frustrated', emoji: '😕', label: 'Frustrated' },
  { id: 'broken', emoji: '😡', label: 'Something is wrong' },
];

const CATEGORIES = [
  { id: 'bug', label: 'Bug' },
  { id: 'feature_request', label: 'Feature request' },
  { id: 'confusing', label: 'Confusing' },
  { id: 'performance', label: 'Performance' },
  { id: 'data_analytics', label: 'Data / analytics' },
  { id: 'ui_design', label: 'UI / design' },
  { id: 'other', label: 'Other' },
];

/**
 * FeedbackModal
 *
 * Self-contained feedback form, opened by FeedbackButton or
 * ContextualFeedbackPopup. Follows the same fixed-overlay pattern as
 * OnboardingExitSurvey.jsx rather than a shared modal library.
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - source: string — where the modal was opened from, for tracking (e.g.
 *     'floating_button' | 'contextual_popup')
 */
export default function FeedbackModal({ open, onClose, source = 'floating_button' }) {
  const [sentiment, setSentiment] = useState(null);
  const [category, setCategory] = useState(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [hasStarted, setHasStarted] = useState(false);

  if (!open) return null;

  const markStarted = () => {
    if (!hasStarted) {
      setHasStarted(true);
      track('feedback_started', { source });
    }
  };

  const reset = () => {
    setSentiment(null);
    setCategory(null);
    setMessage('');
    setStatus('idle');
    setHasStarted(false);
  };

  const handleClose = (dismissed) => {
    const wasSuccess = status === 'success';
    if (dismissed && !wasSuccess) {
      track('feedback_dismissed', { source });
    }
    reset();
    onClose?.(wasSuccess);
  };

  const submit = async () => {
    setStatus('submitting');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          sentiment,
          category,
          page_url: typeof window !== 'undefined' ? window.location.href : null,
          page_title: typeof document !== 'undefined' ? document.title : null,
        }),
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('success');
      track('feedback_submitted', { source, sentiment, category });
    } catch {
      setStatus('error');
    }
  };

  const canSubmit = message.trim().length > 0 && status !== 'submitting';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 11, 20, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: 16,
      }}
      onClick={() => handleClose(true)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#13151f',
          border: '1px solid #1f2233',
          borderRadius: 16,
          padding: 28,
          maxWidth: 440,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#F8FAFC',
          boxShadow: '0 0 40px rgba(0,229,204,0.08)',
        }}
      >
        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Thank you 💙</h3>
            <p style={{ color: '#94A3B8', fontSize: 14, marginTop: 10, lineHeight: 1.6 }}>
              Your feedback helps us make CamCash better for creators.
            </p>
            <Button
              onClick={() => handleClose(false)}
              style={{ marginTop: 20, width: '100%', padding: '12px' }}
            >
              Done
            </Button>
          </div>
        ) : (
          <>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Tell us what you think</h3>
            <p style={{ color: '#94A3B8', fontSize: 14, marginTop: 6, lineHeight: 1.6 }}>
              You're helping us build CamCash for cam models. What's one thing you wish CamCash
              did better?
            </p>

            <div style={{ marginTop: 20 }}>
              <div style={{ color: '#64748B', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                How are you feeling about CamCash?
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                {SENTIMENTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.label}
                    onClick={() => { markStarted(); setSentiment(s.id); }}
                    style={{
                      flex: 1,
                      fontSize: 22,
                      padding: '8px 0',
                      borderRadius: 10,
                      border: sentiment === s.id ? '1px solid #00e5cc' : '1px solid #1f2233',
                      background: sentiment === s.id ? 'rgba(0,229,204,0.08)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {s.emoji}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ color: '#64748B', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                What would you change or improve?
              </div>
              <textarea
                value={message}
                onChange={(e) => { markStarted(); setMessage(e.target.value); }}
                placeholder="Tell us anything — big or small."
                maxLength={2000}
                style={{
                  width: '100%',
                  minHeight: 90,
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid #1f2233',
                  background: '#0a0b14',
                  color: '#F8FAFC',
                  fontSize: 14,
                  resize: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { markStarted(); setCategory(category === c.id ? null : c.id); }}
                    style={{
                      textAlign: 'left',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: category === c.id ? '1px solid #00e5cc' : '1px solid #1f2233',
                      background: category === c.id ? 'rgba(0,229,204,0.08)' : 'transparent',
                      color: '#F8FAFC',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {status === 'error' && (
              <p style={{ color: '#f87171', fontSize: 13, marginTop: 14 }}>
                Something went wrong. Please try again.
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button
                onClick={() => handleClose(true)}
                disabled={status === 'submitting'}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 10,
                  border: '1px solid #1f2233',
                  background: 'transparent',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Maybe later
              </button>
              <Button
                onClick={submit}
                disabled={!canSubmit}
                loading={status === 'submitting'}
                style={{ flex: 1, padding: '11px' }}
              >
                {status === 'submitting' ? 'Sending...' : 'Send Feedback'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
