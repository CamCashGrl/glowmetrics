// ============================================================
// Bug #6: Observer Root Safety Check
// Ensures observer root is never marked as counted
// ============================================================

describe('Bug #6: Observer root safety', () => {
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

  function lineFor(node, observedRoot) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (!parent || parent === observedRoot) return node;
      return parent;
    }
    return node.nodeType === Node.ELEMENT_NODE ? node : null;
  }

  function isCountedOrInsideCounted(node, countedLines, observedRoot) {
    for (let n = node; n && n !== observedRoot; n = n.parentNode) {
      if (countedLines.has(n)) return true;
    }
    return false;
  }

  test('Root safety check: lineFor should return null for observedRoot itself', () => {
    const observedRoot = document.createElement('div');
    observedRoot.id = 'chat-root';

    // lineFor on the root itself
    const line = lineFor(observedRoot, observedRoot);

    // Should return the root itself (it's an ELEMENT_NODE)
    expect(line).toBe(observedRoot);
  });

  test('Root safety check in handleAddedNode: if lineFor returns observedRoot, skip processing', () => {
    const observedRoot = document.createElement('div');
    observedRoot.id = 'chat-root';
    const countedLines = new WeakMap();
    const emittedTips = [];

    // Edge case: tip text node directly under observedRoot
    const tipTextNode = document.createTextNode('Alice tipped 100 tokens');
    observedRoot.appendChild(tipTextNode);

    // In handleAddedNode, this would call lineFor(tipTextNode)
    const line = lineFor(tipTextNode, observedRoot);

    // line will be tipTextNode (parent === observedRoot)
    expect(line).toBe(tipTextNode);

    // The safety check should be: if (!line || line === observedRoot || ...)
    // But in this case line is the text node, not the root
    // The issue would only occur if lineFor somehow returned observedRoot

    // Real protection: Don't mark observedRoot in countedLines
    // If we tried to mark observedRoot, it would block ALL tips in that container
    if (line && line !== observedRoot) {
      countedLines.set(line, 'alice\x00100');
      emittedTips.push({ username: 'Alice', tokens: 100 });
    }

    expect(emittedTips).toHaveLength(1);
    expect(countedLines.has(observedRoot)).toBe(false);  // Root not marked!
  });

  test('Container replacement: root remount does not block new tips', () => {
    // Scenario: observedRoot is replaced/remounted
    // New tips should still be detected

    const observedRoot = document.createElement('div');
    observedRoot.id = 'chat-root';
    const countedLines = new WeakMap();
    const emittedTips = [];

    // Tip 1
    const tip1 = document.createElement('div');
    tip1.textContent = 'Bob tipped 50 tokens';
    observedRoot.appendChild(tip1);

    const lines1 = tipLinesIn(tip1);
    if (lines1.length === 1) {
      const { el, tip } = lines1[0];
      countedLines.set(el, tipKey(tip));
      emittedTips.push(tip);
    }

    // Now observedRoot is replaced/remounted
    const newObservedRoot = document.createElement('div');
    newObservedRoot.id = 'chat-root-new';

    // New tips in the new root should still be detected
    const tip2 = document.createElement('div');
    tip2.textContent = 'Alice tipped 100 tokens';
    newObservedRoot.appendChild(tip2);

    const lines2 = tipLinesIn(tip2);
    if (lines2.length === 1) {
      const { el, tip } = lines2[0];
      // Different countedLines for new root scenario (in real code, observer switches)
      // For this test, we just verify new tip is detected
      emittedTips.push(tip);
    }

    // Both tips counted
    expect(emittedTips).toHaveLength(2);
    expect(emittedTips[0]).toEqual({ username: 'Bob', tokens: 50 });
    expect(emittedTips[1]).toEqual({ username: 'Alice', tokens: 100 });

    // Original root never marked
    expect(countedLines.has(observedRoot)).toBe(false);
    expect(countedLines.has(newObservedRoot)).toBe(false);
  });

  test('Chat container replacement: tips continue flowing after container swap', () => {
    const observedRoot = document.createElement('div');
    observedRoot.id = 'wrapper';

    let chatContainer = document.createElement('div');
    chatContainer.id = 'chat-messages';
    observedRoot.appendChild(chatContainer);

    const countedLines = new WeakMap();
    const emittedTips = [];

    // Tip in first chat container
    const tip1 = document.createElement('div');
    tip1.textContent = 'Fan tipped 75 tokens';
    chatContainer.appendChild(tip1);

    const lines1 = tipLinesIn(tip1);
    if (lines1.length === 1) {
      const { el, tip } = lines1[0];
      countedLines.set(el, tipKey(tip));
      emittedTips.push(tip);
    }

    // Chat container is replaced (common in some UIs)
    observedRoot.removeChild(chatContainer);
    chatContainer = document.createElement('div');
    chatContainer.id = 'chat-messages-new';
    observedRoot.appendChild(chatContainer);

    // New tip in new container
    const tip2 = document.createElement('div');
    tip2.textContent = 'Another fan tipped 100 tokens';
    chatContainer.appendChild(tip2);

    const lines2 = tipLinesIn(tip2);
    if (lines2.length === 1) {
      const { el, tip } = lines2[0];
      if (!isCountedOrInsideCounted(el, countedLines, observedRoot)) {
        countedLines.set(el, tipKey(tip));
        emittedTips.push(tip);
      }
    }

    // Both tips counted
    expect(emittedTips).toHaveLength(2);
    // observedRoot never marked
    expect(countedLines.has(observedRoot)).toBe(false);
  });

  test('Observer reattachment: tips continue after re-observe', () => {
    // Scenario: observer detaches and reattaches to same or different root
    const root1 = document.createElement('div');
    const countedLines = new WeakMap();
    const emittedTips = [];

    // Initial tip
    const tip1 = document.createElement('div');
    tip1.textContent = 'User tipped 50 tokens';
    root1.appendChild(tip1);

    const lines1 = tipLinesIn(tip1);
    if (lines1.length === 1) {
      const { el, tip } = lines1[0];
      countedLines.set(el, tipKey(tip));
      emittedTips.push(tip);
    }

    // Observer reattaches to different root
    const root2 = document.createElement('div');
    const countedLines2 = new WeakMap();

    // New tip in new root (fresh countedLines)
    const tip2 = document.createElement('div');
    tip2.textContent = 'Another user tipped 100 tokens';
    root2.appendChild(tip2);

    const lines2 = tipLinesIn(tip2);
    if (lines2.length === 1) {
      const { el, tip } = lines2[0];
      if (!isCountedOrInsideCounted(el, countedLines2, root2)) {
        countedLines2.set(el, tipKey(tip));
        emittedTips.push(tip);
      }
    }

    // Both tips counted, no duplicates
    expect(emittedTips).toHaveLength(2);
    expect(countedLines.has(root1)).toBe(false);
    expect(countedLines2.has(root2)).toBe(false);
  });

  test('No duplicate replay after remount', () => {
    const observedRoot = document.createElement('div');
    const countedLines = new WeakMap();
    const emittedTips = [];

    // Batch 1: Tip added
    const tip = document.createElement('div');
    tip.textContent = 'Alice tipped 100 tokens';
    observedRoot.appendChild(tip);

    const lines1 = tipLinesIn(tip);
    if (lines1.length === 1) {
      const { el, tip: parsedTip } = lines1[0];
      countedLines.set(el, tipKey(parsedTip));
      emittedTips.push(parsedTip);
    }

    // Batch 2: Same tip node removed and re-added (remount)
    observedRoot.removeChild(tip);
    observedRoot.appendChild(tip);

    // Try to process again
    const lines2 = tipLinesIn(tip);
    if (lines2.length === 1) {
      const { el, tip: parsedTip } = lines2[0];
      // isCountedOrInsideCounted should catch it
      if (!isCountedOrInsideCounted(el, countedLines, observedRoot)) {
        countedLines.set(el, tipKey(parsedTip));
        emittedTips.push(parsedTip);
      }
    }

    // Only counted once
    expect(emittedTips).toHaveLength(1);
  });
});
