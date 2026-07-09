'use client';

import { useState, useEffect, useCallback } from 'react';

const REASONS = [
  { id: 'confusing_step', label: "A step was confusing" },
  { id: 'cant_find_csv', label: "Couldn't find/export my CSV" },
  { id: 'platform_not_supported', label: "My platform isn't supported" },
  { id: 'ran_into_error', label: 'I ran into an error' },
  { id: 'just_browsing', label: 'Just browsing, not ready yet' },
  { id: 'other', label: 'Other' },
];

/**
 * OnboardingExitSurvey
 *
 * Isolated, self-contained exit-intent survey. Import into onboarding/page.js
 * and render once, near the top level of the onboarding component tree.
 *
 * Props:
 * - currentStep: number — current step index in the onboarding flow
 * - currentStepName: string — human-readable step name (e.g. "paste_tip_history")
 * - minStepToTrigger: number — step index at/after which the survey should
 *     be eligible to fire (per our discussion: past the platform picker,
 *     i.e. once they've reached the paste/CSV step)
 * - active: boolean — pass false to fully disable (e.g. after onboarding
 *     completes) so the beforeunload listener is removed
 * - onResolved: () => void — called once the user has dismissed or
 *     submitted the survey, so the caller can complete whatever exit
 *     action (e.g. router.push) it deferred to show this modal
 */
export default function OnboardingExitSurvey({
  currentStep,
  currentStepName,
  minStepToTrigger = 1,
  active = true,
  onResolved,
}) {
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const eligible = active && currentStep >= minStepToTrigger && !submitted;

  // Tab close / refresh detection
  useEffect(() => {
    if (!eligible) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [eligible]);

  // Call this from onboarding/page.js's existing "back" / "exit" button
  // handler, e.g.: onClick={() => { if (!handleExitAttempt()) return; ...existing logic } }
  // If it returns true, the caller's existing exit logic should proceed as normal
  // (this only intercepts the FIRST exit attempt to show the survey).
  const handleExitAttempt = useCallback(() => {
    if (!eligible) return true; // not eligible, let existing exit logic run untouched
    setVisible(true);
    return false; // block the original exit action until survey is dismissed/submitted
  }, [eligible]);

  // Expose the handler on window so it can be called from onboarding/page.js
  // without importing React context wiring into that file.
  useEffect(() => {
    window.__onboardingExitCheck = handleExitAttempt;
    return () => {
      delete window.__onboardingExitCheck;
    };
  }, [handleExitAttempt]);

  const submitFeedback = async (reason) => {
    setSubmitting(true);
    try {
      await fetch('/api/onboarding-exit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_number: currentStep,
          step_name: currentStepName,
          reason,
          free_text: freeText || null,
        }),
      });
    } catch {
      // Fail silently — a broken feedback submit should never block onboarding exit
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      setVisible(false);
      onResolved?.();
    }
  };

  const dismiss = () => {
    setSubmitted(true); // treat dismissal as "don't ask again this session"
    setVisible(false);
    onResolved?.();
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 11, 20, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: '#13151f',
          border: '1px solid #1f2233',
          borderRadius: '12px',
          padding: '28px',
          maxWidth: '420px',
          width: '90%',
          color: '#F8FAFC',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          Before you go — what stopped you?
        </h3>
        <p style={{ color: '#94A3B8', fontSize: '14px', marginTop: '6px' }}>
          Takes 5 seconds, helps us fix it.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '18px' }}>
          {REASONS.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedReason(r.id)}
              disabled={submitting}
              style={{
                textAlign: 'left',
                padding: '10px 14px',
                borderRadius: '8px',
                border: selectedReason === r.id ? '1px solid #00e5cc' : '1px solid #1f2233',
                background: selectedReason === r.id ? 'rgba(0,229,204,0.08)' : 'transparent',
                color: '#F8FAFC',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {selectedReason === 'other' && (
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Tell us more (optional)"
            maxLength={1000}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #1f2233',
              background: '#0a0b14',
              color: '#F8FAFC',
              fontSize: '13px',
              resize: 'none',
              minHeight: '60px',
            }}
          />
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={dismiss}
            disabled={submitting}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #1f2233',
              background: 'transparent',
              color: '#94A3B8',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Skip
          </button>
          <button
            onClick={() => selectedReason && submitFeedback(selectedReason)}
            disabled={!selectedReason || submitting}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: selectedReason ? '#00e5cc' : '#1f2233',
              color: selectedReason ? '#0a0b14' : '#94A3B8',
              cursor: selectedReason ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit & leave'}
          </button>
        </div>
      </div>
    </div>
  );
}
