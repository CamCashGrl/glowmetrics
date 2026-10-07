// Automated harness for chrome-extension/content.js — loads the REAL,
// unmodified source in a real Chromium page (via Playwright) with a chat
// container already in the DOM and a mocked chrome.runtime.sendMessage, then
// simulates real chat messages arriving as DOM mutations (exactly how
// Chaturbate/BongaCams/MyFreeCams actually render new chat lines) and
// verifies the tip-parsing regex + dedupe logic behaves correctly.
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentJsPath = path.join(__dirname, '..', 'content.js');

// This sandbox's pre-installed Chromium — falls back to Playwright's own
// browser resolution (PLAYWRIGHT_BROWSERS_PATH / a local `npx playwright
// install`) when run somewhere else.
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOpts = { headless: true, args: ['--no-sandbox'] };
if (fs.existsSync(SANDBOX_CHROME)) launchOpts.executablePath = SANDBOX_CHROME;

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS:', name); }
  else { fail++; console.error('FAIL:', name); }
}

const html = `<!doctype html><html><body><div id="chat_area"></div></body></html>`;

async function freshPage(browser, url = 'https://chaturbate.com/testroom/') {
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));
  await page.route(url, (route) => route.fulfill({ body: html, contentType: 'text/html' }));
  await page.addInitScript(() => {
    window.__sent = [];
    // Number of upcoming deliveries that fail the way Chrome reports an
    // unreachable/restarting service worker (lastError set, no reply).
    window.__failNext = 0;
    window.chrome = {
      runtime: {
        lastError: null,
        sendMessage: (msg, cb) => {
          window.__sent.push(msg);
          if (typeof cb !== 'function') return;
          setTimeout(() => {
            if (window.__failNext > 0) {
              window.__failNext--;
              window.chrome.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
              cb(undefined);
              window.chrome.runtime.lastError = null;
            } else {
              cb(msg.action === 'tip' ? { queued: true } : undefined);
            }
          }, 0);
        },
        onMessage: { addListener: () => {} },
      },
    };
  });
  await page.goto(url);
  await page.addScriptTag({ path: contentJsPath });
  await page.waitForTimeout(50);
  return page;
}

async function appendChatLine(page, text) {
  await page.evaluate((text) => {
    const div = document.createElement('div');
    div.textContent = text;
    document.getElementById('chat_area').appendChild(div);
  }, text);
  await page.waitForTimeout(50);
}

async function main() {
  const browser = await chromium.launch(launchOpts);

  // ---- Test 1: standard "X tipped N tokens" format is parsed correctly ----
  {
    const page = await freshPage(browser);
    await appendChatLine(page, 'shadowfax99 tipped 25 tokens');
    const sent = await page.evaluate(() => window.__sent);
    const tip = sent.find(m => m.action === 'tip');
    check('T1: tip message sent for standard format', !!tip);
    check('T1: username parsed correctly', tip?.username === 'shadowfax99');
    check('T1: token amount parsed correctly', tip?.tokens === 25);
    check('T1: platform tagged as chaturbate', tip?.platform === 'chaturbate');
    await page.close();
  }

  // ---- Test 2: colon-separated format also matches ----
  {
    const page = await freshPage(browser);
    await appendChatLine(page, 'bigwub: tipped 100');
    const sent = await page.evaluate(() => window.__sent);
    const tip = sent.find(m => m.action === 'tip');
    check('T2: colon-format tip parsed', tip?.username === 'bigwub' && tip?.tokens === 100);
    await page.close();
  }

  // ---- Test 3: room-entry message is detected as "entered", not a tip ----
  {
    const page = await freshPage(browser);
    await appendChatLine(page, 'newbie123 entered the room');
    const sent = await page.evaluate(() => window.__sent);
    check('T3: entry message sent as "entered", not "tip"', sent.some(m => m.action === 'entered' && m.username === 'newbie123'));
    check('T3: no tip message generated for an entry line', !sent.some(m => m.action === 'tip'));
    await page.close();
  }

  // ---- Test 4: two separate chat lines with identical text are two real tips ----
  // (Reverses the old seenMsgs behavior, which silently dropped the second.)
  {
    const page = await freshPage(browser);
    await appendChatLine(page, 'repeatuser tipped 10 tokens');
    await appendChatLine(page, 'repeatuser tipped 10 tokens'); // a second, separate line
    const sent = await page.evaluate(() => window.__sent);
    const tips = sent.filter(m => m.action === 'tip' && m.username === 'repeatuser');
    check('T4: two identical chat lines in separate nodes produce two tips', tips.length === 2);
    check('T4: each gets its own clientEventId', tips.length === 2 && tips[0].clientEventId !== tips[1].clientEventId);
    await page.close();
  }

  // ---- Test 5: a real second tip from the same user (different amount) IS processed ----
  {
    const page = await freshPage(browser);
    await appendChatLine(page, 'sameuser tipped 10 tokens');
    await appendChatLine(page, 'sameuser tipped 20 tokens'); // different text, should NOT be deduped
    const sent = await page.evaluate(() => window.__sent);
    const amounts = sent.filter(m => m.action === 'tip' && m.username === 'sameuser').map(m => m.tokens).sort();
    check('T5: two distinct tips from the same user both register', JSON.stringify(amounts) === JSON.stringify([10, 20]));
    await page.close();
  }

  // ---- Test 6: zero-token tips are rejected (guards against a malformed match) ----
  {
    const page = await freshPage(browser);
    await appendChatLine(page, 'zerouser tipped 0 tokens');
    const sent = await page.evaluate(() => window.__sent);
    check('T6: a 0-token "tip" is not forwarded as a real tip', !sent.some(m => m.action === 'tip' && m.username === 'zerouser'));
    await page.close();
  }

  // ---- Test 7: unrelated chat chatter produces no message at all ----
  {
    const page = await freshPage(browser);
    await appendChatLine(page, 'randomuser: hey everyone whats up');
    const sent = await page.evaluate(() => window.__sent);
    // "connected" fires once on init regardless (see T8) — only tip/entered are relevant here.
    check('T7: ordinary chat message produces no tip/entered message', !sent.some(m => m.action === 'tip' || m.action === 'entered'));
    await page.close();
  }

  // ---- Test 8: the "connected" signal fires once the chat container is found ----
  {
    const page = await freshPage(browser);
    const sent = await page.evaluate(() => window.__sent);
    check('T8: "connected" message sent once the chat container is located', sent.some(m => m.action === 'connected' && m.platform === 'chaturbate'));
    await page.close();
  }

  // ---- Test 9: BongaCams platform detection + its own tip pattern ----
  {
    const page = await freshPage(browser, 'https://bongacams.com/testroom/');
    await appendChatLine(page, 'bongafan sent 15 tokens');
    const sent = await page.evaluate(() => window.__sent);
    const tip = sent.find(m => m.action === 'tip');
    check('T9: BongaCams tip pattern parsed with correct platform tag', tip?.username === 'bongafan' && tip?.tokens === 15 && tip?.platform === 'bongacams');
    await page.close();
  }

  // ---- Test 10: rapid burst — 20 distinct tips fired back-to-back (no per-append wait) ----
  {
    const page = await freshPage(browser);
    await page.evaluate(() => {
      const div = document.getElementById('chat_area');
      for (let i = 0; i < 20; i++) {
        const el = document.createElement('div');
        el.textContent = `burstuser${i} tipped ${i + 1} tokens`;
        div.appendChild(el);
      }
    });
    await page.waitForTimeout(200);
    const sent = await page.evaluate(() => window.__sent);
    const tips = sent.filter(m => m.action === 'tip' && m.username?.startsWith('burstuser'));
    check('T10: all 20 rapid-fire tips are captured, none dropped', tips.length === 20);
    const amounts = tips.map(t => t.tokens).sort((a, b) => a - b);
    check('T10: no duplicate/garbled amounts under burst', JSON.stringify(amounts) === JSON.stringify(Array.from({ length: 20 }, (_, i) => i + 1)));
    await page.close();
  }

  // ══════════ Phase 1: per-node detection, event identity, delivery ══════════
  const tipsOf = (sent) => sent.filter((m) => m.action === 'tip');
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  // Each platform's own chat wording (patterns from content.js TIP_PATTERNS).
  const PLATFORMS = [
    { name: 'chaturbate', url: 'https://chaturbate.com/testroom/', line: (u, n) => `${u} tipped ${n} tokens` },
    { name: 'bongacams',  url: 'https://bongacams.com/testroom/',  line: (u, n) => `${u} sent ${n} tokens` },
    { name: 'myfreecams', url: 'https://www.myfreecams.com/testroom/', line: (u, n) => `${u} tipped ${n} tokens` },
  ];

  for (const p of PLATFORMS) {
    const P = p.name;

    // P1: same DOM node observed repeatedly -> exactly one tip
    {
      const page = await freshPage(browser, p.url);
      await page.evaluate((text) => {
        const area = document.getElementById('chat_area');
        const other = document.createElement('div');
        area.appendChild(other);
        const line = document.createElement('div');
        line.id = 'L';
        line.textContent = text;
        area.appendChild(line);
        window.__line = line;
      }, p.line('Bob', 50));
      await page.waitForTimeout(30);
      // Re-report the SAME node: detach + re-attach, move it, append into it.
      await page.evaluate(() => { const a = document.getElementById('chat_area'); a.removeChild(window.__line); a.appendChild(window.__line); });
      await page.waitForTimeout(30);
      await page.evaluate(() => { const a = document.getElementById('chat_area'); a.insertBefore(window.__line, a.firstChild); });
      await page.waitForTimeout(30);
      await page.evaluate(() => { window.__line.appendChild(document.createTextNode(' ')); const s = document.createElement('span'); s.textContent = '✓'; window.__line.appendChild(s); });
      await page.waitForTimeout(30);
      const tips = tipsOf(await page.evaluate(() => window.__sent));
      check(`${P} P1: same node re-attached/moved/appended-into -> 1 tip`, tips.length === 1);
      await page.close();
    }

    // P2: two separate nodes with identical text -> two tips (same batch and separate batches)
    {
      const page = await freshPage(browser, p.url);
      await appendChatLine(page, p.line('Bob', 50));
      await appendChatLine(page, p.line('Bob', 50));
      await page.evaluate((text) => {
        const a = document.getElementById('chat_area');
        for (let i = 0; i < 2; i++) { const d = document.createElement('div'); d.textContent = text; a.appendChild(d); }
      }, p.line('Bob', 50));
      await page.waitForTimeout(50);
      const tips = tipsOf(await page.evaluate(() => window.__sent));
      check(`${P} P2: 4 separate identical lines -> 4 tips`, tips.length === 4);
      check(`${P} P2: 4 distinct clientEventIds`, new Set(tips.map((t) => t.clientEventId)).size === 4);
      check(`${P} P2: parsed username/tokens/platform`, tips.every((t) => t.username === 'Bob' && t.tokens === 50 && t.platform === P));
      await page.close();
    }

    // P3: structured line (spans) and incremental rendering -> one tip each, correctly parsed
    {
      const page = await freshPage(browser, p.url);
      await page.evaluate((parts) => {
        const a = document.getElementById('chat_area');
        // <div><span>Alice</span> {verb} <b>75</b> tokens</div> built in one task
        const d = document.createElement('div');
        const u = document.createElement('span'); u.textContent = 'Alice';
        d.appendChild(u);
        d.appendChild(document.createTextNode(` ${parts.verb} `));
        const b = document.createElement('b'); b.textContent = '75';
        d.appendChild(b);
        d.appendChild(document.createTextNode(' tokens'));
        a.appendChild(d);
      }, { verb: P === 'bongacams' ? 'sent' : 'tipped' });
      await page.waitForTimeout(30);
      // Line element inserted empty, text filled in a later task.
      await page.evaluate(() => { const d = document.createElement('div'); d.id = 'late'; document.getElementById('chat_area').appendChild(d); });
      await page.waitForTimeout(30);
      await page.evaluate((text) => { document.getElementById('late').appendChild(document.createTextNode(text)); }, p.line('Carol', 30));
      await page.waitForTimeout(30);
      const tips = tipsOf(await page.evaluate(() => window.__sent));
      check(`${P} P3: span-structured line parsed (Alice 75)`, tips.some((t) => t.username === 'Alice' && t.tokens === 75));
      check(`${P} P3: line filled after insertion counted once (Carol 30)`, tips.filter((t) => t.username === 'Carol' && t.tokens === 30).length === 1);
      check(`${P} P3: exactly 2 tips total`, tips.length === 2);
      await page.close();
    }

    // P4: platform re-rendering existing lines (in place, and whole list) -> no new tips
    {
      const page = await freshPage(browser, p.url);
      await appendChatLine(page, p.line('Dan', 10));
      await appendChatLine(page, p.line('Eve', 20));
      await page.evaluate((text) => {
        const a = document.getElementById('chat_area');
        const old = a.lastChild;
        const fresh = document.createElement('div'); fresh.textContent = text;
        a.replaceChild(fresh, old); // re-render of Eve's line
      }, p.line('Eve', 20));
      await page.waitForTimeout(30);
      await page.evaluate(() => { const a = document.getElementById('chat_area'); a.innerHTML = a.innerHTML; }); // whole list re-rendered
      await page.waitForTimeout(30);
      const tips = tipsOf(await page.evaluate(() => window.__sent));
      check(`${P} P4: in-place and full-list re-renders add no tips (still 2)`, tips.length === 2);
      await page.close();
    }

    // P7: oldest identical line trimmed in one batch, the same fan tips the same amount in the next -> counted
    {
      const page = await freshPage(browser, p.url);
      await appendChatLine(page, p.line('Bob', 50));
      await appendChatLine(page, 'someone: hi');
      await page.evaluate(() => { const a = document.getElementById('chat_area'); a.removeChild(a.firstChild); });
      await page.waitForTimeout(30);
      await appendChatLine(page, p.line('Bob', 50));
      const tips = tipsOf(await page.evaluate(() => window.__sent));
      check(`${P} P7: identical tip after an earlier trim of the identical line is counted (2 tips)`, tips.length === 2);
      await page.close();
    }

    // P5: chat trimming the oldest identical line while the same fan tips again -> counted
    {
      const page = await freshPage(browser, p.url);
      await appendChatLine(page, p.line('Bob', 50));
      await appendChatLine(page, 'someone: hi');
      await page.evaluate((text) => {
        const a = document.getElementById('chat_area');
        const d = document.createElement('div'); d.textContent = text; a.appendChild(d);
        a.removeChild(a.firstChild); // trim oldest (an identical Bob line) in the same task
      }, p.line('Bob', 50));
      await page.waitForTimeout(30);
      const tips = tipsOf(await page.evaluate(() => window.__sent));
      check(`${P} P5: new identical tip during trim of the old identical line is counted (2 tips)`, tips.length === 2);
      await page.close();
    }

    // P6: one node holding several tip lines (history replay) -> not counted as new tips
    {
      const page = await freshPage(browser, p.url);
      await page.evaluate((lines) => {
        const wrap = document.createElement('div');
        for (const l of lines) { const d = document.createElement('div'); d.textContent = l; wrap.appendChild(d); }
        document.getElementById('chat_area').appendChild(wrap);
      }, [p.line('Old1', 10), p.line('Old2', 20), p.line('Old3', 30)]);
      await page.waitForTimeout(30);
      await appendChatLine(page, p.line('NewFan', 40));
      const tips = tipsOf(await page.evaluate(() => window.__sent));
      check(`${P} P6: bulk-inserted history lines not counted; next live tip is`, tips.length === 1 && tips[0].username === 'NewFan');
      await page.close();
    }
  }

  // E1: every tip carries a UUID v4 clientEventId and its detection time
  {
    const page = await freshPage(browser);
    const before = Date.now();
    await appendChatLine(page, 'idcheck tipped 5 tokens');
    const after = Date.now();
    const tip = tipsOf(await page.evaluate(() => window.__sent))[0];
    check('E1: clientEventId is a UUID v4', UUID_V4.test(tip?.clientEventId || ''));
    const d = Date.parse(tip?.detectedAt);
    check('E1: detectedAt is the detection time', d >= before - 5 && d <= after + 5);
    await page.close();
  }

  // E2: background unreachable twice -> same event resent until acknowledged
  {
    const page = await freshPage(browser);
    await page.evaluate(() => { window.__failNext = 2; });
    await appendChatLine(page, 'retryfan tipped 15 tokens');
    await page.waitForTimeout(2200); // retries at +500ms, +1000ms
    const sends = tipsOf(await page.evaluate(() => window.__sent));
    check('E2: tip delivery retried after failures (3 sends)', sends.length === 3);
    check('E2: every resend carries the SAME clientEventId', new Set(sends.map((t) => t.clientEventId)).size === 1);
    check('E2: every resend carries the SAME detectedAt', new Set(sends.map((t) => t.detectedAt)).size === 1);
    await page.close();
  }

  // S1: requested scenario — Alice 100 ($5), Bob 200 ($10), Bob 200 again ($10), Alice 400 ($20) on
  // Chaturbate, with observer noise: a re-attached node, text appended into a line, an in-place
  // re-render, and a full-list re-render. Expect exactly 4 tip events.
  {
    const page = await freshPage(browser);
    await appendChatLine(page, 'Alice tipped 100 tokens');
    await appendChatLine(page, 'Bob tipped 200 tokens');
    await appendChatLine(page, 'viewer1: nice');
    await appendChatLine(page, 'Bob tipped 200 tokens');
    await page.evaluate(() => { const a = document.getElementById('chat_area'); const n = a.children[1]; a.removeChild(n); a.appendChild(n); });
    await page.waitForTimeout(30);
    await page.evaluate(() => { const a = document.getElementById('chat_area'); const s = document.createElement('span'); s.textContent = ' ★'; a.children[0].appendChild(s); });
    await page.waitForTimeout(30);
    await appendChatLine(page, 'Alice tipped 400 tokens');
    await page.evaluate(() => { const a = document.getElementById('chat_area'); const last = a.lastChild; const f = document.createElement('div'); f.textContent = last.textContent; a.replaceChild(f, last); });
    await page.waitForTimeout(30);
    await page.evaluate(() => { const a = document.getElementById('chat_area'); a.innerHTML = a.innerHTML; });
    await page.waitForTimeout(30);
    const tips = tipsOf(await page.evaluate(() => window.__sent));
    const usd = (u) => tips.filter((t) => t.username === u).reduce((s, t) => s + t.tokens * 0.05, 0);
    check('S1: exactly 4 tip events', tips.length === 4);
    check('S1: 4 distinct clientEventIds', new Set(tips.map((t) => t.clientEventId)).size === 4);
    check('S1: both identical Bob tips counted ($20)', Math.abs(usd('Bob') - 20) < 1e-9);
    check('S1: Alice $25', Math.abs(usd('Alice') - 25) < 1e-9);
    check('S1: total $45', Math.abs(usd('Alice') + usd('Bob') - 45) < 1e-9);
    await page.close();
  }

  // ---- MP1: three cam-site tabs open at once, same chat line in each at the same moment ----
  // Each tab is its own content-script instance: its own platform, its own
  // seen-state. None may suppress another, and every event gets its own id.
  {
    const urls = {
      chaturbate: 'https://chaturbate.com/creatorroom/',
      bongacams: 'https://bongacams.com/creatorroom/',
      myfreecams: 'https://www.myfreecams.com/creatorroom/',
    };
    const pages = {};
    for (const [pf, url] of Object.entries(urls)) pages[pf] = await freshPage(browser, url);
    await Promise.all(Object.values(pages).map((pg) => appendChatLine(pg, 'SameFan tipped 100 tokens')));
    // and a genuine second identical tip on Chaturbate
    await appendChatLine(pages.chaturbate, 'SameFan tipped 100 tokens');
    const tipsBy = {};
    for (const [pf, pg] of Object.entries(pages)) tipsBy[pf] = (await pg.evaluate(() => window.__sent)).filter((m) => m.action === 'tip');
    const all = Object.values(tipsBy).flat();
    check('MP1: each tab reported its own tip (none suppressed by another tab)', tipsBy.bongacams.length === 1 && tipsBy.myfreecams.length === 1 && tipsBy.chaturbate.length === 2);
    check('MP1: every tip tagged with its own tab\'s platform', Object.entries(tipsBy).every(([pf, ts]) => ts.every((t) => t.platform === pf)));
    check('MP1: all 4 events have distinct clientEventIds', new Set(all.map((t) => t.clientEventId)).size === 4);
    check('MP1: every event has a detectedAt', all.every((t) => !Number.isNaN(Date.parse(t.detectedAt))));
    check('MP1: identical repeat tip on the same tab is counted, not dropped', tipsBy.chaturbate.length === 2);
    for (const pg of Object.values(pages)) await pg.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS CRASH:', e); process.exit(1); });
