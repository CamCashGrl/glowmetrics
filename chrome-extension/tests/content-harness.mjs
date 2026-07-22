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
    window.chrome = {
      runtime: {
        sendMessage: (msg) => { window.__sent.push(msg); },
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

  // ---- Test 4: an exact duplicate chat line is not processed twice (dedupe by seenMsgs) ----
  {
    const page = await freshPage(browser);
    await appendChatLine(page, 'repeatuser tipped 10 tokens');
    await appendChatLine(page, 'repeatuser tipped 10 tokens'); // identical text again
    const sent = await page.evaluate(() => window.__sent);
    const tipCount = sent.filter(m => m.action === 'tip' && m.username === 'repeatuser').length;
    check('T4: exact duplicate chat line only produces one tip message', tipCount === 1);
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

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS CRASH:', e); process.exit(1); });
