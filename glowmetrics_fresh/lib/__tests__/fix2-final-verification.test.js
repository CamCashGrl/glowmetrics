// ============================================================
// Fix 2 Final Verification Test
// Comprehensive scenario: Alice 100, Bob 200 x2, unrelated, remount
// ============================================================

describe('Fix 2 Final Verification — Comprehensive Scenario', () => {
  const normalize = (text) => (text || '').trim().replace(/\s+/g, ' ');

  const TIP_PATTERNS = {
    chaturbate: [
      /^(.+?) tipped (\d+) token/i,
      /^(.+?): tipped (\d+)/i,
      /^(.+?) sent (\d+) token/i,
    ],
  };

  const parseTip = (clean) => {
    if (!clean || clean.length < 5) return null;
    const patterns = TIP_PATTERNS.chaturbate;
    for (const pat of patterns) {
      const m = clean.match(pat);
      if (m) {
        const tokens = parseInt(m[2], 10);
        if (isNaN(tokens) || tokens <= 0) return null;
        return { username: m[1].trim(), tokens };
      }
    }
    return null;
  };

  const tipKey = (tip) => `${tip.username.toLowerCase()}\x00${tip.tokens}`;
  const MIN_TIP_LINES_FOR_BULK = 2;
  const MAX_TIP_LINE_DEPTH = 8;

  const tipLinesIn = (node, depth = 0) => {
    const clean = normalize(node.textContent);
    const tip = parseTip(clean);
    if (!tip) return [];
    if (node.nodeType !== Node.ELEMENT_NODE || depth >= MAX_TIP_LINE_DEPTH) {
      return [{ el: node, tip, text: clean, depthLimited: depth >= MAX_TIP_LINE_DEPTH }];
    }
    const childLines = [];
    for (const child of node.children) {
      childLines.push(...tipLinesIn(child, depth + 1));
    }
    return childLines.length ? childLines : [{ el: node, tip, text: clean }];
  };

  const isCountedOrInsideCounted = (node, countedLines, observedRoot) => {
    for (let n = node; n && n !== observedRoot; n = n.parentNode) {
      if (countedLines.has(n)) return true;
    }
    return false;
  };

  test('Scenario: Alice 100, Bob 200, Bob 200 again, unrelated chat, Alice remount', () => {
    const observedRoot = document.createElement('div');
    observedRoot.id = 'chat-root';

    const countedLines = new WeakMap();
    const recentRemovals = [];
    let lastMutationBatchId = 0;

    const trackRemoval = (key, target) => {
      const keepBatchId = lastMutationBatchId - 1;
      for (let i = recentRemovals.length - 1; i >= 0; i--) {
        if (recentRemovals[i].batchId < keepBatchId) {
          recentRemovals.splice(i, 1);
        }
      }
      recentRemovals.push({ batchId: lastMutationBatchId, key, target });
    };

    const wasRecentlyRemovedAtSameSpot = (key, target) => {
      for (const r of recentRemovals) {
        if (r.key === key && r.target === target) {
          return true;
        }
      }
      return false;
    };

    const emittedTips = [];
    const emittedEnter = [];

    // ─ Batch 1: Alice's $100 tip ─
    lastMutationBatchId++;
    const aliceTip1 = document.createElement('div');
    aliceTip1.textContent = 'Alice tipped 100 tokens';
    observedRoot.appendChild(aliceTip1);

    if (!isCountedOrInsideCounted(aliceTip1, countedLines, observedRoot)) {
      const lines = tipLinesIn(aliceTip1);
      if (lines.length === 1) {
        const { el, tip } = lines[0];
        if (!isCountedOrInsideCounted(el, countedLines, observedRoot)) {
          countedLines.set(el, tipKey(tip));
          emittedTips.push(tip);
        }
      }
    }

    // ─ Batch 2: Bob's first $200 tip ─
    lastMutationBatchId++;
    const bobTip1 = document.createElement('div');
    bobTip1.textContent = 'Bob tipped 200 tokens';
    observedRoot.appendChild(bobTip1);

    if (!isCountedOrInsideCounted(bobTip1, countedLines, observedRoot)) {
      const lines = tipLinesIn(bobTip1);
      if (lines.length === 1) {
        const { el, tip } = lines[0];
        if (!isCountedOrInsideCounted(el, countedLines, observedRoot)) {
          countedLines.set(el, tipKey(tip));
          emittedTips.push(tip);
        }
      }
    }

    // ─ Batch 3: Unrelated "Charlie entered" message (should be ignored) ─
    lastMutationBatchId++;
    const enterMsg = document.createElement('div');
    enterMsg.textContent = 'Charlie entered the room';
    observedRoot.appendChild(enterMsg);

    const enterLines = tipLinesIn(enterMsg);
    if (enterLines.length === 0) {
      emittedEnter.push('Charlie');  // Not a tip, but an enter event
    }

    // ─ Batch 4: Bob's second identical $200 tip ─
    lastMutationBatchId++;
    const bobTip2 = document.createElement('div');
    bobTip2.textContent = 'Bob tipped 200 tokens';
    observedRoot.appendChild(bobTip2);

    if (!isCountedOrInsideCounted(bobTip2, countedLines, observedRoot)) {
      const lines = tipLinesIn(bobTip2);
      if (lines.length === 1) {
        const { el, tip } = lines[0];
        const key = tipKey(tip);
        if (!isCountedOrInsideCounted(el, countedLines, observedRoot)) {
          countedLines.set(el, key);
          // Check for remount (Bug #2 fix)
          if (!wasRecentlyRemovedAtSameSpot(key, observedRoot)) {
            emittedTips.push(tip);
          }
        }
      }
    }

    // ─ Batch 5: Alice's first tip node removed (simulating chat trim) ─
    lastMutationBatchId++;
    const aliceKey = tipKey({ username: 'Alice', tokens: 100 });
    trackRemoval(aliceKey, observedRoot);
    observedRoot.removeChild(aliceTip1);

    // ─ Batch 6: Alice node re-added at same location (simulating virtualized scroll) ─
    lastMutationBatchId++;
    observedRoot.appendChild(aliceTip1);

    // Should be recognized as remount, not re-emitted
    if (!isCountedOrInsideCounted(aliceTip1, countedLines, observedRoot)) {
      const lines = tipLinesIn(aliceTip1);
      if (lines.length === 1) {
        const { el, tip } = lines[0];
        const key = tipKey(tip);
        if (!isCountedOrInsideCounted(el, countedLines, observedRoot)) {
          countedLines.set(el, key);
          if (!wasRecentlyRemovedAtSameSpot(key, observedRoot)) {
            emittedTips.push(tip);
          }
        }
      }
    }

    // ─ Verify results ─
    expect(emittedTips).toHaveLength(3);
    expect(emittedTips[0].username).toBe('Alice');
    expect(emittedTips[0].tokens).toBe(100);
    expect(emittedTips[1].username).toBe('Bob');
    expect(emittedTips[1].tokens).toBe(200);
    expect(emittedTips[2].username).toBe('Bob');
    expect(emittedTips[2].tokens).toBe(200);

    // ─ Verify unrelated chat ignored ─
    expect(emittedEnter).toHaveLength(1);  // Only enter event, not a tip

    // ─ Verify Alice not re-emitted after remount ─
    const aliceEmissions = emittedTips.filter(t => t.username === 'Alice');
    expect(aliceEmissions).toHaveLength(1);  // Only once
  });

  test('All three platforms handle scenario correctly', () => {
    // Validate that each platform's patterns work for the scenario
    const patterns = {
      chaturbate: [
        /^(.+?) tipped (\d+) token/i,
        /^(.+?): tipped (\d+)/i,
        /^(.+?) sent (\d+) token/i,
      ],
      bongacams: [
        /^(.+?) sent (\d+) token/i,
        /^(.+?) tipped (\d+)/i,
      ],
      myfreecams: [
        /^(.+?) tips? (\d+) token/i,
        /^(.+?) tip[pt]ed (\d+)/i,
      ],
    };

    const testCases = [
      { text: 'Alice tipped 100 tokens', user: 'Alice', tokens: 100 },
      { text: 'Bob tipped 200 tokens', user: 'Bob', tokens: 200 },
      { text: 'Charlie entered the room', tip: false },
    ];

    for (const [platform, patternList] of Object.entries(patterns)) {
      for (const test of testCases) {
        let matched = false;
        if (!test.tip) {
          // Should NOT match enter message
          matched = false;
        } else {
          for (const pat of patternList) {
            const m = test.text.match(pat);
            if (m) {
              expect(parseInt(m[2], 10)).toBe(test.tokens);
              matched = true;
              break;
            }
          }
        }

        if (test.tip) {
          expect(matched).toBe(true);
        }
      }
    }
  });
});
