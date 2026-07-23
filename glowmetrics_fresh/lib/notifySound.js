// Small attention-getting chime for the "are you still live?" prompt — a
// synthesized two-tone beep via the Web Audio API rather than a bundled
// audio file. Silently no-ops in any environment without one (SSR, an
// autoplay-blocked tab that's never had a user gesture yet, etc.) — a
// missed sound is never worth throwing over.
export function playStillLiveChime() {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = ctx.currentTime;
    playTone(880, now, 0.18);
    playTone(660, now + 0.2, 0.22);
    setTimeout(() => ctx.close?.(), 600);
  } catch (_) {
    // Autoplay policy or no audio hardware — never surfaced as an error.
  }
}
