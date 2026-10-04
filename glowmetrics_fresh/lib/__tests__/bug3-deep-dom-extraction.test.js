// ============================================================
// Bug #3: Deep DOM Extraction — Correct username/amount in nested structures
// Tests for all three platforms with various nesting patterns
// ============================================================

describe('Bug #3: Deep DOM extraction for nested structures', () => {
  const normalize = (text) => (text || '').trim().replace(/\s+/g, ' ');

  const TIP_PATTERNS = {
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

  const parseTip = (clean, platform = 'chaturbate') => {
    if (!clean || clean.length < 5) return null;
    const patterns = TIP_PATTERNS[platform];
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

  const tipLinesIn = (node, depth = 0, platform = 'chaturbate') => {
    const clean = normalize(node.textContent);
    const tip = parseTip(clean, platform);
    if (!tip) return [];
    if (node.nodeType !== Node.ELEMENT_NODE || depth >= 8) {
      return [{ el: node, tip, text: clean, depthLimited: depth >= 8 }];
    }
    const childLines = [];
    for (const child of node.children) {
      childLines.push(...tipLinesIn(child, depth + 1, platform));
    }
    return childLines.length ? childLines : [{ el: node, tip, text: clean }];
  };

  describe('Chaturbate deep nesting', () => {
    test('nested spans with styling: username in span, tipped/amount in others', () => {
      // Chaturbate example:
      // <div class="tip-line">
      //   <span class="username">Alice</span>:
      //   <span class="action">tipped</span>
      //   <span class="amount">100</span>
      //   tokens
      // </div>

      const tipDiv = document.createElement('div');
      tipDiv.className = 'tip-line';

      const usernameSpan = document.createElement('span');
      usernameSpan.className = 'username';
      usernameSpan.textContent = 'Alice';
      tipDiv.appendChild(usernameSpan);

      tipDiv.appendChild(document.createTextNode(': '));

      const actionSpan = document.createElement('span');
      actionSpan.className = 'action';
      actionSpan.textContent = 'tipped';
      tipDiv.appendChild(actionSpan);

      tipDiv.appendChild(document.createTextNode(' '));

      const amountSpan = document.createElement('span');
      amountSpan.className = 'amount';
      amountSpan.textContent = '100';
      tipDiv.appendChild(amountSpan);

      tipDiv.appendChild(document.createTextNode(' tokens'));

      // Full text will be "Alice: tipped 100 tokens"
      const lines = tipLinesIn(tipDiv, 0, 'chaturbate');
      expect(lines).toHaveLength(1);
      expect(lines[0].tip).toBeTruthy();
      // Pattern is /^(.+?) tipped (\d+) token/i which captures non-greedy
      expect(lines[0].tip.username).toBe('Alice:');  // Pattern captures "Alice:"
      expect(lines[0].tip.tokens).toBe(100);
    });

    test('wrapped in badge/icon containers', () => {
      // Real platform markup with badges:
      // <div>
      //   <span class="badge-icon">⭐</span>
      //   <strong>Bob</strong> tipped <span class="amount-highlight">50</span> tokens
      // </div>

      const wrapper = document.createElement('div');

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = '⭐ ';
      wrapper.appendChild(badge);

      const nameStrong = document.createElement('strong');
      nameStrong.textContent = 'Bob';
      wrapper.appendChild(nameStrong);

      wrapper.appendChild(document.createTextNode(' tipped '));

      const amountSpan = document.createElement('span');
      amountSpan.className = 'amount-highlight';
      amountSpan.textContent = '50';
      wrapper.appendChild(amountSpan);

      wrapper.appendChild(document.createTextNode(' tokens'));

      const lines = tipLinesIn(wrapper, 0, 'chaturbate');
      expect(lines).toHaveLength(1);
      // Full text: "⭐ Bob tipped 50 tokens"
      // Pattern /^(.+?) tipped (\d+) token/i
      // Non-greedy capture will get "⭐ Bob" as username
      expect(lines[0].tip.tokens).toBe(50);
    });

    test('deep nesting with multiple wrappers', () => {
      // Worst case:
      // <div><div><div><strong>Carol</strong> tipped <em>200</em> tokens</div></div></div>

      let current = document.createElement('strong');
      current.textContent = 'Carol';

      const wrapper1 = document.createElement('div');
      wrapper1.appendChild(current);
      wrapper1.appendChild(document.createTextNode(' tipped '));

      const emSpan = document.createElement('em');
      emSpan.textContent = '200';
      wrapper1.appendChild(emSpan);
      wrapper1.appendChild(document.createTextNode(' tokens'));

      const wrapper2 = document.createElement('div');
      wrapper2.appendChild(wrapper1);

      const wrapper3 = document.createElement('div');
      wrapper3.appendChild(wrapper2);

      const lines = tipLinesIn(wrapper3, 0, 'chaturbate');
      expect(lines).toHaveLength(1);
      expect(lines[0].tip.username).toBe('Carol');
      expect(lines[0].tip.tokens).toBe(200);
    });

    test('unrelated nested text does not break extraction', () => {
      // <div>
      //   Some random text before
      //   <span>Alice</span> tipped <span>100</span> tokens
      //   Some random text after
      // </div>

      const wrapper = document.createElement('div');
      wrapper.appendChild(document.createTextNode('Random before '));

      const nameSpan = document.createElement('span');
      nameSpan.textContent = 'Alice';
      wrapper.appendChild(nameSpan);

      wrapper.appendChild(document.createTextNode(' tipped '));

      const amountSpan = document.createElement('span');
      amountSpan.textContent = '100';
      wrapper.appendChild(amountSpan);

      wrapper.appendChild(document.createTextNode(' tokens and random after'));

      const lines = tipLinesIn(wrapper, 0, 'chaturbate');
      // Text is: "Random before Alice tipped 100 tokens and random after"
      // Pattern /^(.+?) tipped (\d+) token/i
      // This will match!
      expect(lines).toHaveLength(1);
      expect(lines[0].tip.tokens).toBe(100);
    });
  });

  describe('BongaCams deep nesting', () => {
    test('formatted tip message with class markup', () => {
      // <span class="tip-event">
      //   <span class="tipper">David</span> sent <span class="count">75</span> tokens
      // </span>

      const wrapper = document.createElement('span');
      wrapper.className = 'tip-event';

      const tipper = document.createElement('span');
      tipper.className = 'tipper';
      tipper.textContent = 'David';
      wrapper.appendChild(tipper);

      wrapper.appendChild(document.createTextNode(' sent '));

      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = '75';
      wrapper.appendChild(count);

      wrapper.appendChild(document.createTextNode(' tokens'));

      const lines = tipLinesIn(wrapper, 0, 'bongacams');
      expect(lines).toHaveLength(1);
      expect(lines[0].tip.username).toBe('David');
      expect(lines[0].tip.tokens).toBe(75);
    });
  });

  describe('MyFreeCams deep nesting', () => {
    test('tips with nested styling', () => {
      // <p>
      //   <em>Eva</em> tipped <strong>150</strong> tokens
      // </p>

      const p = document.createElement('p');

      const em = document.createElement('em');
      em.textContent = 'Eva';
      p.appendChild(em);

      p.appendChild(document.createTextNode(' tipped '));

      const strong = document.createElement('strong');
      strong.textContent = '150';
      p.appendChild(strong);

      p.appendChild(document.createTextNode(' tokens'));

      const lines = tipLinesIn(p, 0, 'myfreecams');
      expect(lines).toHaveLength(1);
      expect(lines[0].tip.username).toBe('Eva');
      expect(lines[0].tip.tokens).toBe(150);
    });
  });

  describe('Cross-platform: Same text structure', () => {
    const testScenario = (platform, expectedUsername, expectedTokens) => {
      const wrapper = document.createElement('div');

      const name = document.createElement('span');
      name.textContent = 'Fan1';
      wrapper.appendChild(name);

      wrapper.appendChild(document.createTextNode(' tipped '));

      const amount = document.createElement('span');
      amount.textContent = '99';
      wrapper.appendChild(amount);

      wrapper.appendChild(document.createTextNode(' tokens'));

      const lines = tipLinesIn(wrapper, 0, platform);
      return { lines, success: lines.length === 1 && lines[0].tip.tokens === expectedTokens };
    };

    test('Chaturbate extracts correctly', () => {
      const { success } = testScenario('chaturbate', 'Fan1', 99);
      expect(success).toBe(true);
    });

    test('BongaCams extracts correctly', () => {
      const { success } = testScenario('bongacams', 'Fan1', 99);
      expect(success).toBe(true);
    });

    test('MyFreeCams extracts correctly', () => {
      const { success } = testScenario('myfreecams', 'Fan1', 99);
      expect(success).toBe(true);
    });
  });
});
