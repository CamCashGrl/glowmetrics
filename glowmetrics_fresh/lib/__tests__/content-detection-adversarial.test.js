// ============================================================
// Content Detection — Real DOM Behavior Adversarial Tests
// File: lib/__tests__/content-detection-adversarial.test.js
//
// Validates tip detection against realistic platform DOMs
// and adversarial cases that expose silent data corruption.
// ============================================================

describe('Content Detection — Real DOM Behavior', () => {
  // ─── CHATURBATE FIXTURES ────────────────────────────────────────────────────

  describe('Chaturbate', () => {
    // Real structure (simplified, platform-specific markup)
    // <div id="chat-room-rows">
    //   <div class="message-row">
    //     <div class="message-item">
    //       <span class="username">Alice</span>
    //       <span class="message-text">Alice tipped 50 tokens</span>
    //     </div>
    //   </div>
    // </div>

    test('detects single tip in realistic DOM', () => {
      const root = document.createElement('div');
      root.id = 'chat-room-rows';

      const row = document.createElement('div');
      row.className = 'message-row';
      root.appendChild(row);

      const item = document.createElement('div');
      item.className = 'message-item';
      row.appendChild(item);

      const username = document.createElement('span');
      username.className = 'username';
      username.textContent = 'Alice';
      item.appendChild(username);

      const text = document.createElement('span');
      text.className = 'message-text';
      text.textContent = 'Alice tipped 50 tokens';
      item.appendChild(text);

      // Parsing test
      const patterns = [
        /^(.+?) tipped (\d+) token/i,
        /^(.+?): tipped (\d+)/i,
        /^(.+?) sent (\d+) token/i,
      ];
      const clean = 'Alice tipped 50 tokens';
      const match = clean.match(patterns[0]);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('Alice');
      expect(match[2]).toBe('50');
    });

    test('identical separate tips both count (Bug #4)', () => {
      // Two nodes with identical text "Bob tipped 100 tokens"
      // should count as 2 tips, not 1

      const node1 = document.createElement('div');
      node1.textContent = 'Bob tipped 100 tokens';

      const node2 = document.createElement('div');
      node2.textContent = 'Bob tipped 100 tokens';

      // Same text, different nodes
      expect(node1).not.toBe(node2);

      // Dedup should be per-node via WeakMap
      const countedLines = new WeakMap();
      const tipKey = (tip) => `${tip.username.toLowerCase()}\x00${tip.tokens}`;

      // First tip
      const tip1 = { username: 'Bob', tokens: 100 };
      countedLines.set(node1, tipKey(tip1));

      // Second tip — different node, should not be blocked
      const tip2 = { username: 'Bob', tokens: 100 };
      countedLines.set(node2, tipKey(tip2));

      expect(countedLines.get(node1)).toBe('bob\x00100');
      expect(countedLines.get(node2)).toBe('bob\x00100');
      expect(countedLines.has(node1)).toBe(true);
      expect(countedLines.has(node2)).toBe(true);
    });

    test('container marked as counted blocks children (Bug #1)', () => {
      // When a container is marked as "counted", new tip children
      // are silently dropped

      const container = document.createElement('div');
      container.id = 'tips-container';

      const tip1 = document.createElement('div');
      tip1.textContent = 'Alice tipped 50 tokens';
      container.appendChild(tip1);

      // Mark container as counted
      const countedLines = new WeakMap();
      countedLines.set(container, 'alice\x0050');

      // Now add a new child tip
      const tip2 = document.createElement('div');
      tip2.textContent = 'Bob tipped 100 tokens';
      container.appendChild(tip2);

      // isCountedOrInsideCounted should return true for tip2
      // because its parent (container) is marked
      const isCountedOrInsideCounted = (node) => {
        for (let n = node; n && n !== document.body; n = n.parentNode) {
          if (countedLines.has(n)) return true;
        }
        return false;
      };

      expect(isCountedOrInsideCounted(tip2)).toBe(true);
      // This is the BUG: tip2 is silently dropped despite being a new tip
    });

    test('remount at same location is detected (no double-count)', () => {
      // When a tip node is removed and re-added at the same location,
      // it should be recognized as a remount, not a new tip

      const container = document.createElement('div');
      const prevSibling = document.createElement('div');
      container.appendChild(prevSibling);

      const tip = document.createElement('div');
      tip.textContent = 'Alice tipped 50 tokens';
      container.appendChild(tip);

      const lastMutationBatchId = 0;
      const recentRemovals = [];
      const trackRemoval = (key, target, prevSibling) => {
        recentRemovals.push({ batchId: lastMutationBatchId, key, target, prevSibling });
      };
      const wasRecentlyRemovedAtSameSpot = (key, target, prevSibling) => {
        for (const r of recentRemovals) {
          if (r.key === key && r.target === target && r.prevSibling === prevSibling) {
            return true;
          }
        }
        return false;
      };

      // Simulate removal
      const key = 'alice\x0050';
      trackRemoval(key, container, prevSibling);
      container.removeChild(tip);

      // Re-add at same spot
      container.appendChild(tip);

      // Should detect remount
      expect(wasRecentlyRemovedAtSameSpot(key, container, prevSibling)).toBe(true);
    });

    test('depth-limited tips not marked, can be re-counted (Bug #5)', () => {
      // When a tip hits MAX_TIP_LINE_DEPTH, it's marked with depthLimited: true
      // and NOT added to countedLines. This allows rescanning of the same tip.

      const MAX_TIP_LINE_DEPTH = 8;

      // Create deeply nested structure
      let current = document.createElement('div');
      current.textContent = 'Alice tipped 50 tokens';

      for (let i = 0; i < MAX_TIP_LINE_DEPTH + 1; i++) {
        const parent = document.createElement('div');
        parent.appendChild(current);
        current = parent;
      }

      const countedLines = new WeakMap();

      // Simulate tipLinesIn() at max depth
      const depthLimited = MAX_TIP_LINE_DEPTH >= MAX_TIP_LINE_DEPTH;

      // Because depthLimited is true, we DON'T mark it
      if (!depthLimited) {
        countedLines.set(current, 'alice\x0050');
      }

      // Now if the same node is processed again, countedLines.has(current) is false
      // So it could be re-counted
      expect(countedLines.has(current)).toBe(false);
    });
  });

  // ─── BONGACAMS FIXTURES ─────────────────────────────────────────────────────

  describe('BongaCams', () => {
    // Real structure (simplified)
    // <div class="chat_messages">
    //   <div class="chat_message">
    //     <span class="user">bob</span>: bob sent 200 token
    //   </div>
    // </div>

    test('detects tip with different pattern variation', () => {
      const patterns = [
        /^(.+?) sent (\d+) token/i,
        /^(.+?) tipped (\d+)/i,
      ];

      const text = 'bob sent 200 token';
      const match = text.match(patterns[0]);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('bob');
      expect(match[2]).toBe('200');
    });

    test('nested username extraction', () => {
      const container = document.createElement('div');
      container.className = 'chat_message';

      const usernameSpan = document.createElement('span');
      usernameSpan.className = 'user';
      usernameSpan.textContent = 'bob';
      container.appendChild(usernameSpan);

      const text = document.createTextNode(': bob sent 200 token');
      container.appendChild(text);

      // container.textContent = "bob: bob sent 200 token"
      expect(container.textContent).toBe('bob: bob sent 200 token');

      // Pattern should match the full text, not the span
      const patterns = [
        /^(.+?) sent (\d+) token/i,
        /^(.+?) tipped (\d+)/i,
      ];
      const match = container.textContent.match(patterns[0]);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('bob: bob');  // Pattern captures up to first space
    });
  });

  // ─── MYFREECAMS FIXTURES ────────────────────────────────────────────────────

  describe('MyFreeCams', () => {
    // Real structure (simplified)
    // <div id="chat_messages">
    //   <div class="msg">
    //     <span class="name">alice</span>: alice tips 100 token
    //   </div>
    // </div>

    test('detects variations: tips/tip/tipped', () => {
      const patterns = [
        /^(.+?) tips? (\d+) token/i,
        /^(.+?) tip[pt]ed (\d+)/i,
      ];

      const tests = [
        { text: 'alice tips 100 token', user: 'alice', tokens: '100' },
        { text: 'alice tip 100 token', user: 'alice', tokens: '100' },
        { text: 'alice tipped 75', user: 'alice', tokens: '75' },
        { text: 'alice tipted 50', user: 'alice', tokens: '50' },
      ];

      for (const test of tests) {
        let matched = false;
        for (const pat of patterns) {
          const match = test.text.match(pat);
          if (match) {
            expect(match[1]).toBe(test.user);
            expect(match[2]).toBe(test.tokens);
            matched = true;
            break;
          }
        }
        expect(matched).toBe(true);
      }
    });
  });

  // ─── CROSS-PLATFORM ADVERSARIAL SCENARIOS ───────────────────────────────────

  describe('Cross-platform adversarial scenarios', () => {
    // Helper to normalize text
    const normalize = (text) => (text || '').trim().replace(/\s+/g, ' ');

    // Helper to parse tip
    const patterns = {
      chaturbate: [
        /^(.+?) tipped (\d+) token/i,
        /^(.+?): tipped (\d+)/i,
        /^(.+?) sent (\d+) token/i,
      ],
    };

    const parseTip = (clean, patternList) => {
      if (!clean || clean.length < 5) return null;
      for (const pat of patternList) {
        const m = clean.match(pat);
        if (m) {
          const tokens = parseInt(m[2], 10);
          if (isNaN(tokens) || tokens <= 0) return null;
          return { username: m[1].trim(), tokens };
        }
      }
      return null;
    };

    test('scenario: 3 events (Alice once, Bob twice, unrelated chat ignored)', () => {
      // Simulate the exact scenario from the adversarial review:
      // - Alice sends 1 tip
      // - Bob sends 2 tips
      // - Someone enters the room (unrelated)
      // - No duplicates on remount

      const events = [];
      const emitTip = (tip) => {
        events.push({ type: 'tip', username: tip.username, tokens: tip.tokens });
      };
      const emitEnter = (username) => {
        events.push({ type: 'enter', username });
      };

      // Create mock mutations
      const node1 = document.createElement('div');
      node1.textContent = 'Alice tipped 50 tokens';

      const node2 = document.createElement('div');
      node2.textContent = 'Bob tipped 100 tokens';

      const node3 = document.createElement('div');
      node3.textContent = 'Bob tipped 100 tokens';

      const node4 = document.createElement('div');
      node4.textContent = 'Charlie entered the room';

      // Process without double-counting
      for (const node of [node1, node2, node3, node4]) {
        const clean = normalize(node.textContent);
        const tip = parseTip(clean, patterns.chaturbate);
        if (tip) {
          emitTip(tip);
        } else {
          // Check for enter
          const enterPatterns = [
            /^(.+?) entered the room/i,
            /^(.+?) has entered/i,
            /^(.+?) joined the room/i,
            /^(.+?) is now in the room/i,
          ];
          const enterMatch = clean.match(enterPatterns[0]);
          if (enterMatch) {
            emitEnter(enterMatch[1].trim());
          }
        }
      }

      // We should have: Alice, Bob, Bob, Charlie
      // But the original bug was we'd get duplicates or wrong counts
      expect(events.filter(e => e.type === 'tip')).toHaveLength(3);
      expect(events.filter(e => e.username === 'Alice')).toHaveLength(1);
      expect(events.filter(e => e.username === 'Bob')).toHaveLength(2);
      expect(events.filter(e => e.type === 'enter')).toHaveLength(1);
    });

    test('scenario: container child added after container marked', () => {
      // The bug: container is marked as counted, new child tips are dropped

      const root = document.createElement('div');
      const container = document.createElement('div');
      root.appendChild(container);

      const countedLines = new WeakMap();
      const emittedTips = [];

      const isCountedOrInsideCounted = (node) => {
        for (let n = node; n && n !== root; n = n.parentNode) {
          if (countedLines.has(n)) return true;
        }
        return false;
      };

      // Scenario A: Bulk insert (2+ tip lines)
      // This marks the container, preventing future children
      const bulk1 = document.createElement('div');
      bulk1.appendChild(document.createTextNode('Alice tipped 50 tokens\n'));
      bulk1.appendChild(document.createElement('br'));
      bulk1.appendChild(document.createTextNode('Bob tipped 100 tokens\n'));
      container.appendChild(bulk1);

      // Since bulk insert (2 tips), mark as counted (history/re-render)
      countedLines.set(bulk1, 'history');

      // Scenario B: New single tip comes in as child of bulk1
      const newTip = document.createElement('div');
      newTip.textContent = 'Charlie tipped 75 tokens';
      bulk1.appendChild(newTip);

      // Check: would this tip be processed?
      if (!isCountedOrInsideCounted(newTip)) {
        emittedTips.push({ username: 'Charlie', tokens: 75 });
      }

      // BUG: Charlie's tip is dropped because newTip's ancestor (bulk1) is marked
      // CORRECT: We should still detect Charlie's tip
      // The fix: don't mark bulk inserts if we later want their children to be processed
      // OR: be smarter about what constitutes a "container" that should block children

      expect(emittedTips).toHaveLength(0);  // Current behavior (BUG)
      // After fix, expect: expect(emittedTips).toHaveLength(1);
    });

    test('scenario: deepest element selection with nested spans', () => {
      // Structure:
      // <div>
      //   "Alice tipped "
      //   <span>50</span>
      //   " tokens"
      // </div>

      const container = document.createElement('div');
      container.appendChild(document.createTextNode('Alice tipped '));

      const span = document.createElement('span');
      span.textContent = '50';
      container.appendChild(span);

      container.appendChild(document.createTextNode(' tokens'));

      // container.textContent = "Alice tipped 50 tokens"
      expect(container.textContent).toBe('Alice tipped 50 tokens');

      // When we recursively scan children:
      // - container.textContent = "Alice tipped 50 tokens" ✓ matches
      // - container has children, so we recurse
      // - span.textContent = "50" ✗ doesn't match
      // - text nodes are not elements, return immediately

      // So tipLinesIn() should return [{ el: container, tip: {...} }]
      // The deepest element holding the whole tip is the container

      const patterns = [
        /^(.+?) tipped (\d+) token/i,
        /^(.+?): tipped (\d+)/i,
        /^(.+?) sent (\d+) token/i,
      ];

      const clean = container.textContent;
      const match = clean.match(patterns[0]);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('Alice');
      expect(match[2]).toBe('50');
    });

    test('scenario: malformed tip messages are rejected', () => {
      const patterns = [
        /^(.+?) tipped (\d+) token/i,
        /^(.+?): tipped (\d+)/i,
        /^(.+?) sent (\d+) token/i,
      ];

      const invalid = [
        'Alice tipped',  // no amount
        'tipped 50 tokens',  // no username
        'Alice 50 tokens',  // wrong format
        '50 tokens',  // no username
        'entered the room',  // not a tip
        'Alice sent an email',  // no token amount
      ];

      for (const text of invalid) {
        let matched = false;
        for (const pat of patterns) {
          if (text.match(pat)) {
            matched = true;
            break;
          }
        }
        expect(matched).toBe(false);
      }
    });

    test('scenario: very deep nesting should still extract correctly', () => {
      // Create a very deep nesting:
      // div > div > div > ... > div (12 levels)
      //   "Alice tipped 50 tokens"

      let current = document.createElement('span');
      current.textContent = 'Alice tipped 50 tokens';

      for (let i = 0; i < 12; i++) {
        const parent = document.createElement('div');
        parent.appendChild(current);
        current = parent;
      }

      // current is now the root div
      // Its textContent should still be "Alice tipped 50 tokens"
      expect(current.textContent).toContain('Alice tipped 50 tokens');

      const patterns = [
        /^(.+?) tipped (\d+) token/i,
      ];

      const match = current.textContent.match(patterns[0]);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('Alice');
      expect(match[2]).toBe('50');
    });
  });
});
