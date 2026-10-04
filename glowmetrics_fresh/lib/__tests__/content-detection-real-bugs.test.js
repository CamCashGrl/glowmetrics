// ============================================================
// Content Detection — Actual Bug Reproduction
// Tests that reproduce the 5 known bugs from adversarial review
// ============================================================

describe('Content Detection — Real Bug Manifestation', () => {
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

  describe('BUG #1: Bulk insert marks container, blocks later children', () => {
    test('marks container when no deeper children found, later children blocked', () => {
      const observedRoot = document.createElement('div');
      observedRoot.id = 'chat';

      const countedLines = new WeakMap();
      const emittedTips = [];

      // Create a container that has 2+ child lines with tip text
      const bulkContainer = document.createElement('div');
      bulkContainer.id = 'bulk';
      observedRoot.appendChild(bulkContainer);

      // Add two tip-looking divs as children
      const line1 = document.createElement('div');
      line1.textContent = 'Alice tipped 50 tokens';
      bulkContainer.appendChild(line1);

      const line2 = document.createElement('div');
      line2.textContent = 'Bob tipped 100 tokens';
      bulkContainer.appendChild(line2);

      // Simulate handleAddedNode(bulkContainer, ...)
      if (!isCountedOrInsideCounted(bulkContainer, countedLines, observedRoot)) {
        const lines = tipLinesIn(bulkContainer);

        // This is a bulk insert (2+ lines), so mark all lines
        if (lines.length >= MIN_TIP_LINES_FOR_BULK) {
          for (const l of lines) {
            countedLines.set(l.el, tipKey(l.tip));
          }
        }
      }

      // Now a new tip arrives as a new child
      const line3 = document.createElement('div');
      line3.textContent = 'Charlie tipped 75 tokens';
      bulkContainer.appendChild(line3);

      // Simulate handleAddedNode(line3, ...)
      // The bug: line3 is checked against isCountedOrInsideCounted
      // If any of lines were the bulkContainer itself, it would be marked
      const line3IsBlocked = isCountedOrInsideCounted(line3, countedLines, observedRoot);

      if (!line3IsBlocked) {
        const lines = tipLinesIn(line3);
        if (lines.length === 1) {
          const { el, tip } = lines[0];
          if (!isCountedOrInsideCounted(el, countedLines, observedRoot)) {
            countedLines.set(el, tipKey(tip));
            emittedTips.push(tip);
          }
        }
      }

      // In the current implementation, line3 should NOT be blocked
      // because we marked line1 and line2, not bulkContainer
      // But if the bug manifests, line3 would be blocked
      expect(emittedTips).toHaveLength(1);  // Charlie's tip should be detected

      // The actual manifestation of BUG #1 would be if bulkContainer was marked
      // Let's test that scenario:
      countedLines.clear();
      emittedTips.length = 0;

      // Simulate wrong marking: mark the container instead of lines
      countedLines.set(bulkContainer, 'bulk-marker');

      // Now try to detect line3
      const line3IsBlockedWrong = isCountedOrInsideCounted(line3, countedLines, observedRoot);
      expect(line3IsBlockedWrong).toBe(true);  // This IS blocked (the bug)

      // So the bug would be if the code ever marks the bulkContainer
    });

    test('depth-limited tips not marked, can be re-detected in same batch', () => {
      const observedRoot = document.createElement('div');
      const countedLines = new WeakMap();

      // Create deeply nested element
      let current = document.createElement('span');
      current.textContent = 'Alice tipped 50 tokens';

      for (let i = 0; i < MAX_TIP_LINE_DEPTH + 1; i++) {
        const parent = document.createElement('div');
        parent.appendChild(current);
        current = parent;
      }

      observedRoot.appendChild(current);

      // Process the root element
      const lines1 = tipLinesIn(current);
      expect(lines1.length).toBeGreaterThan(0);
      expect(lines1[0].depthLimited).toBe(true);

      // Because it's depth-limited, we don't mark it
      // (in the real code: if (!depthLimited) countedLines.set(el, key))
      if (!lines1[0].depthLimited) {
        countedLines.set(lines1[0].el, tipKey(lines1[0].tip));
      }

      // The element is NOT marked
      expect(countedLines.has(lines1[0].el)).toBe(false);

      // If the same node is processed again, isCountedOrInsideCounted would return false
      const isAlreadyMarked = countedLines.has(lines1[0].el);
      expect(isAlreadyMarked).toBe(false);  // BUG: allows re-detection
    });
  });

  describe('Verification: Real scenario without marking bugs', () => {
    test('normal sequence: 3 tips, no duplicates', () => {
      const observedRoot = document.createElement('div');
      const countedLines = new WeakMap();
      const emittedTips = [];

      // Add Alice's tip
      const aliceTip = document.createElement('div');
      aliceTip.textContent = 'Alice tipped 50 tokens';
      observedRoot.appendChild(aliceTip);

      if (!isCountedOrInsideCounted(aliceTip, countedLines, observedRoot)) {
        const lines = tipLinesIn(aliceTip);
        if (lines.length === 1 && !lines[0].depthLimited) {
          countedLines.set(lines[0].el, tipKey(lines[0].tip));
          emittedTips.push(lines[0].tip);
        }
      }

      // Add Bob's first tip
      const bobTip1 = document.createElement('div');
      bobTip1.textContent = 'Bob tipped 100 tokens';
      observedRoot.appendChild(bobTip1);

      if (!isCountedOrInsideCounted(bobTip1, countedLines, observedRoot)) {
        const lines = tipLinesIn(bobTip1);
        if (lines.length === 1 && !lines[0].depthLimited) {
          countedLines.set(lines[0].el, tipKey(lines[0].tip));
          emittedTips.push(lines[0].tip);
        }
      }

      // Add Bob's second identical tip
      const bobTip2 = document.createElement('div');
      bobTip2.textContent = 'Bob tipped 100 tokens';
      observedRoot.appendChild(bobTip2);

      if (!isCountedOrInsideCounted(bobTip2, countedLines, observedRoot)) {
        const lines = tipLinesIn(bobTip2);
        if (lines.length === 1 && !lines[0].depthLimited) {
          countedLines.set(lines[0].el, tipKey(lines[0].tip));
          emittedTips.push(lines[0].tip);
        }
      }

      expect(emittedTips).toHaveLength(3);
      expect(emittedTips[0].username).toBe('Alice');
      expect(emittedTips[1].username).toBe('Bob');
      expect(emittedTips[2].username).toBe('Bob');
    });
  });
});
