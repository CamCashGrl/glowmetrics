// Live Mode Preview — deterministic mock data only.
//
// STRICT ISOLATION: this file must never import supabase, fetch, or any
// /api/live/* route, and must never reference a real session id. It backs
// a fully local simulation (see usePreviewEngine.js) that demonstrates the
// real product's interaction shape without touching any backend.
//
// Prompt wording is copied from lib/coaching/triggers.js (the real,
// production coaching engine) so the preview never invents coaching
// behavior that doesn't exist — it only shortens copy where noted for
// readability in a compact card.

export const EXAMPLE_USERNAMES = ['ExampleFan88', 'ExampleTipper', 'ExampleViewer12', 'ExampleSupporter'];

// Each scenario is a short, deterministic burst of mock tips plus (usually)
// one coaching prompt — mirroring exactly one of the 9 real triggers in
// lib/coaching/triggers.js. `tips` are applied instantly when the scenario
// is selected; `prompt` becomes the new active prompt (previous active
// prompt, if unanswered, is auto-moved to history as 'unmarked', same as
// production's one-active-prompt-at-a-time rule).
export const SCENARIOS = {
  strong_activity: {
    id: 'strong_activity',
    label: 'Strong activity',
    tips: [
      { username: 'ExampleFan88', tokens: 40, usd: 2.0 },
      { username: 'ExampleTipper', tokens: 60, usd: 3.0 },
      { username: 'ExampleViewer12', tokens: 25, usd: 1.25 },
    ],
    prompt: {
      type: 'pace_above',
      icon: '🔥',
      level: 'success',
      title: 'Tip frequency is up — room energy is above your normal pace',
      // Shortened for the compact preview card; full production wording:
      // "Don't break the energy — keep doing exactly what you're doing"
      compactMessage: "Momentum building — don't break the energy, keep doing exactly what you're doing",
    },
  },
  quiet_period: {
    id: 'quiet_period',
    label: 'Quiet period',
    tips: [],
    prompt: {
      type: 'dead_air_high',
      icon: '⚠️',
      level: 'warning',
      title: '5 minutes since your last tip',
      compactMessage: '5 min since last tip — start a quick 200-token goal right now',
    },
  },
  coaching_prompt: {
    id: 'coaching_prompt',
    label: 'Coaching prompt',
    tips: [
      { username: 'ExampleTipper', tokens: 90, usd: 4.5 },
    ],
    prompt: {
      type: 'whale_dep',
      icon: '🐳',
      level: 'info',
      title: 'ExampleTipper is 45% of your session revenue',
      compactMessage: 'ExampleTipper is 45% of revenue — give them personal attention',
    },
  },
  returning_momentum: {
    id: 'returning_momentum',
    label: 'Returning momentum',
    tips: [
      { username: 'ExampleViewer12', tokens: 30, usd: 1.5 },
      { username: 'ExampleFan88', tokens: 45, usd: 2.25 },
    ],
    prompt: {
      type: 'pace_above',
      icon: '🔥',
      level: 'success',
      title: 'Tip frequency is recovering after a quiet stretch',
      compactMessage: "Momentum is back — don't break the energy, keep doing exactly what you're doing",
    },
  },
  end_stream: {
    id: 'end_stream',
    label: 'Ending the stream',
    tips: [],
    prompt: null,
  },
};

export const SCENARIO_ORDER = ['strong_activity', 'quiet_period', 'coaching_prompt', 'returning_momentum', 'end_stream'];

// Fixed starting example values shown the instant the simulated stream
// starts, before the user advances through any scenario — deliberately
// modest/realistic, never inflated.
export const PREVIEW_STARTING_STATE = {
  totalUsd: 12.50,
  totalTokens: 250,
  tipCount: 4,
  goalTokens: 1000,
};
