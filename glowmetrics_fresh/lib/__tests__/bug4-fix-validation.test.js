// ============================================================
// Bug #4 Fix Validation
// Verify Fix 4.1: Don't create replacement pools for bulk removals
// ============================================================

describe('Bug #4 Fix: Identical tips no longer dropped', () => {
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

  const tipLinesIn = (node, depth = 0) => {
    const clean = normalize(node.textContent);
    const tip = parseTip(clean);
    if (!tip) return [];
    if (node.nodeType !== Node.ELEMENT_NODE || depth >= 8) {
      return [{ el: node, tip, text: clean, depthLimited: depth >= 8 }];
    }
    const childLines = [];
    for (const child of node.children) {
      childLines.push(...tipLinesIn(child, depth + 1));
    }
    return childLines.length ? childLines : [{ el: node, tip, text: clean }];
  };

  const collectCountedKeys = (node, keys) => {
    for (const line of tipLinesIn(node)) {
      keys.push(tipKey(line.tip));
    }
  };

  // FIX 4.1: Only create pools for SINGLE removals, not bulk
  const buildReplacementPools = (mutations) => {
    const pools = [];
    for (const mut of mutations) {
      if (!mut.removedNodes.length) continue;
      const keys = [];
      for (const removed of mut.removedNodes) collectCountedKeys(removed, keys);
      // FIX 4.1: Only create pool if single tip removed (1 key)
      // Bulk removals (2+ keys) are history/ui-state, not tip replacements
      if (keys.length === 1) {
        pools.push({ mut, keys });
      }
    }
    return pools;
  };

  const takeReplacement = (pools, addMut, key) => {
    for (const pool of pools) {
      const r = pool.mut;
      const sameSpot = r === addMut || (
        r.target === addMut.target &&
        (r.previousSibling === addMut.previousSibling || r.nextSibling === addMut.nextSibling)
      );
      if (!sameSpot) continue;
      const i = pool.keys.indexOf(key);
      if (i !== -1) { pool.keys.splice(i, 1); return true; }
    }
    return false;
  };

  test('FIX 4.1 WORKS: Bulk removal does NOT create pool', () => {
    const historyContainer = document.createElement('div');

    const aliceTip = document.createElement('div');
    aliceTip.textContent = 'Alice tipped 100 tokens';
    historyContainer.appendChild(aliceTip);

    const bobTip = document.createElement('div');
    bobTip.textContent = 'Bob tipped 200 tokens';
    historyContainer.appendChild(bobTip);

    const observedRoot = document.createElement('div');
    observedRoot.appendChild(historyContainer);

    // Bulk removal (2 tips)
    const mut1 = {
      addedNodes: [],
      removedNodes: [historyContainer],
      target: observedRoot,
      previousSibling: null,
      nextSibling: null,
    };

    const pools = buildReplacementPools([mut1]);

    // FIX 4.1: NO POOL should be created because keys.length === 2
    expect(pools).toHaveLength(0);
  });

  test('FIX 4.1: Single removal STILL creates pool (correct behavior)', () => {
    const observedRoot = document.createElement('div');

    const singleTip = document.createElement('div');
    singleTip.textContent = 'Alice tipped 100 tokens';
    observedRoot.appendChild(singleTip);

    // Single removal (1 tip)
    const mut1 = {
      addedNodes: [],
      removedNodes: [singleTip],
      target: observedRoot,
      previousSibling: null,
      nextSibling: null,
    };

    const pools = buildReplacementPools([mut1]);

    // Pool SHOULD be created because keys.length === 1
    expect(pools).toHaveLength(1);
    expect(pools[0].keys).toEqual(['alice\x00100']);
  });

  test('After FIX 4.1: New identical tips after bulk removal are NOT dropped', () => {
    const observedRoot = document.createElement('div');
    const countedLines = new WeakMap();
    const emittedTips = [];

    // ─ Mutation 1: Bulk history removal (no pool created) ─
    const historyContainer = document.createElement('div');
    const aliceTip1 = document.createElement('div');
    aliceTip1.textContent = 'Alice tipped 100 tokens';
    historyContainer.appendChild(aliceTip1);

    const bobTip1 = document.createElement('div');
    bobTip1.textContent = 'Bob tipped 200 tokens';
    historyContainer.appendChild(bobTip1);

    observedRoot.appendChild(historyContainer);

    const mut1 = {
      addedNodes: [],
      removedNodes: [historyContainer],
      target: observedRoot,
      previousSibling: null,
      nextSibling: null,
    };

    const pools1 = buildReplacementPools([mut1]);
    expect(pools1).toHaveLength(0);  // FIX 4.1: No pool for bulk removal

    // ─ Mutation 2: New Alice 100 tip ─
    const newAliceTip = document.createElement('div');
    newAliceTip.textContent = 'Alice tipped 100 tokens';
    observedRoot.appendChild(newAliceTip);

    const mut2 = {
      addedNodes: [newAliceTip],
      removedNodes: [],
      target: observedRoot,
      previousSibling: null,
      nextSibling: null,
    };

    const lines2 = tipLinesIn(newAliceTip);
    if (lines2.length === 1) {
      const { el, tip } = lines2[0];
      const key = tipKey(tip);

      // Check against pools1 (which is EMPTY due to FIX 4.1)
      if (!takeReplacement(pools1, mut2, key)) {
        countedLines.set(el, key);
        emittedTips.push(tip);
      }
    }

    expect(emittedTips).toHaveLength(1);
    expect(emittedTips[0]).toEqual({ username: 'Alice', tokens: 100 });

    // ─ Mutation 3: New Bob 200 tip ─
    const newBobTip = document.createElement('div');
    newBobTip.textContent = 'Bob tipped 200 tokens';
    observedRoot.appendChild(newBobTip);

    const mut3 = {
      addedNodes: [newBobTip],
      removedNodes: [],
      target: observedRoot,
      previousSibling: newAliceTip,
      nextSibling: null,
    };

    const lines3 = tipLinesIn(newBobTip);
    if (lines3.length === 1) {
      const { el, tip } = lines3[0];
      const key = tipKey(tip);

      if (!takeReplacement(pools1, mut3, key)) {
        countedLines.set(el, key);
        emittedTips.push(tip);
      }
    }

    // AFTER FIX 4.1: Both tips counted!
    expect(emittedTips).toHaveLength(2);
    expect(emittedTips[0]).toEqual({ username: 'Alice', tokens: 100 });
    expect(emittedTips[1]).toEqual({ username: 'Bob', tokens: 200 });
  });

  test('Platform scenario: Bob tips 100 twice (separate nodes, different batches)', () => {
    const observedRoot = document.createElement('div');
    const countedLines = new WeakMap();
    const emittedTips = [];

    // Batch 1: Bob tips 100
    const bobTip1 = document.createElement('div');
    bobTip1.textContent = 'Bob tipped 100 tokens';
    observedRoot.appendChild(bobTip1);

    const mut1 = {
      addedNodes: [bobTip1],
      removedNodes: [],
      target: observedRoot,
      previousSibling: null,
      nextSibling: null,
    };

    const pools1 = buildReplacementPools([mut1]);
    const lines1 = tipLinesIn(bobTip1);
    if (lines1.length === 1) {
      const { el, tip } = lines1[0];
      const key = tipKey(tip);
      if (!takeReplacement(pools1, mut1, key)) {
        countedLines.set(el, key);
        emittedTips.push(tip);
      }
    }

    // Batch 2: Bob tips 100 again (no removal between them)
    const bobTip2 = document.createElement('div');
    bobTip2.textContent = 'Bob tipped 100 tokens';
    observedRoot.appendChild(bobTip2);

    const mut2 = {
      addedNodes: [bobTip2],
      removedNodes: [],
      target: observedRoot,
      previousSibling: bobTip1,
      nextSibling: null,
    };

    const pools2 = buildReplacementPools([mut2]);  // No removals
    const lines2 = tipLinesIn(bobTip2);
    if (lines2.length === 1) {
      const { el, tip } = lines2[0];
      const key = tipKey(tip);
      if (!takeReplacement(pools2, mut2, key)) {
        countedLines.set(el, key);
        emittedTips.push(tip);
      }
    }

    // Both tips counted (Bob tips twice)
    expect(emittedTips).toHaveLength(2);
    expect(emittedTips[0]).toEqual({ username: 'Bob', tokens: 100 });
    expect(emittedTips[1]).toEqual({ username: 'Bob', tokens: 100 });
  });
});
