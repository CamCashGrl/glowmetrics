// STAGING ONLY. Sessions tab adaptive layer: seeds five creators from
// glowmetrics_fresh/lib/sessions/__fixtures__/sessions-modes.json, opens the
// Sessions tab in a real browser, screenshots it, and checks every visible
// metric in the DOM against the raw-data values (hand-computed from the
// fixture rows; the same numbers are asserted against the helpers in
// lib/sessions/__tests__/sessions-modes-reconcile.test.js).
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const URL_ = process.env.SUPABASE_STAGING_URL;
const SERVICE = process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY;
const APP = process.env.CAMCASH_STAGING_BASE_URL;
const OUT = process.env.BROWSER_ARTIFACTS_DIR || path.resolve('browser-artifacts');
for (const [k, v] of Object.entries({ SUPABASE_STAGING_URL: URL_, SUPABASE_STAGING_SERVICE_ROLE_KEY: SERVICE, CAMCASH_STAGING_BASE_URL: APP })) {
  if (!v) { console.error(`❌ Missing ${k}`); process.exit(1); }
}
if (URL_.includes('hlsdlaibnayzbfflxclj') || /camcashgrl\.com/.test(APP)) { console.error('❌ FATAL: refusing to run against production'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, '../../glowmetrics_fresh/lib/sessions/__fixtures__/sessions-modes.json'), 'utf8'));

let pass = 0, fail = 0;
const table = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`✅ ${name}`); } else { fail++; console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`); }
};
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const NOW = Date.now();
const at = (daysAgo, hm) => {
  if (daysAgo === 0) return new Date(NOW - hm * 60000).toISOString();
  const d = new Date(NOW - daysAgo * 86400000);
  const [h, m] = hm.split(':').map(Number);
  d.setUTCHours(h, m, 0, 0);
  return d.toISOString();
};

// Raw-data expectations (DOM text), hand-computed from the fixture rows.
const EXPECT = {
  csvFree: {
    overall: {
      'overall-source': 'IMPORTED HISTORY', 'overall-total': '$69.00', 'overall-public': '$63.00', 'overall-private': '$6.00',
      'overall-tips': '11', 'overall-unique': '5', 'overall-meaningful': '5', 'overall-median': '$12.00',
      'overall-top-tipper': 'Ann', 'overall-largest': '$12.00',
      'perf-typical-median': '$12.00', 'perf-typical-count': '5', 'perf-typical-tips': '2', 'perf-audience-unique': '5',
      'perf-audience-top': 'Ann ($26.00), Ben ($13.00), Ola ($10.00)', 'perf-audience-share': '78%',
    },
    contains: { 'overall-history-note': 'last 31 days on every platform', 'perf-momentum': 'Not enough data yet' },
  },
  singleFree: {
    overall: {
      'overall-source': 'IMPORTED HISTORY', 'overall-total': '$140.00', 'overall-public': '$140.00', 'overall-private': '$0.00',
      'overall-tips': '14', 'overall-unique': '6', 'overall-meaningful': '7', 'overall-median': '$20.00',
      'overall-top-tipper': 'Ann', 'overall-largest': '$30.00',
      'perf-typical-median': '$20.00', 'perf-typical-count': '7', 'perf-momentum-delta': '↑ 133%',
      'perf-momentum-recent': '$23.33', 'perf-momentum-prior': '$10.00', 'perf-audience-unique': '6',
      'perf-audience-top': 'Ann ($86.00), Ben ($20.00), Cy ($10.00)', 'perf-audience-share': '83%',
    },
    contains: { 'overall-history-note': 'full history on Chaturbate' },
  },
  mixed: {
    today: {
      'today-total': '$13.00', 'today-public': '$13.00', 'today-private': '$0.00', 'today-tips': '3', 'today-unique': '3',
      'today-completed': '1', 'today-best-platform': 'Chaturbate',
    },
    todayContains: { 'today-streamed': '0m', 'today-by-platform': '$10.00' },
    overall: {
      'overall-source': 'LIVE + IMPORTED HISTORY', 'overall-total': '$38.00', 'overall-public': '$38.00', 'overall-tips': '7',
      'overall-unique': '6', 'overall-meaningful': '3', 'overall-median': '$10.00', 'overall-top-tipper': 'Ann', 'overall-largest': '$10.00',
    },
  },
  pro: {
    overall: {
      'overall-source': 'IMPORTED HISTORY', 'overall-total': '$65.00', 'overall-public': '$65.00', 'overall-tips': '8',
      'overall-unique': '4', 'overall-meaningful': '4', 'overall-median': '$12.50', 'overall-top-tipper': 'Ann', 'overall-largest': '$20.00',
      'perf-typical-median': '$12.50', 'perf-typical-count': '4', 'perf-audience-share': '88%',
    },
    contains: { 'overall-history-note': 'Full history on every platform' },
  },
  noData: { today: { 'today-total': '$0.00', 'today-tips': '0' }, present: ['history-empty'] },
};

async function makeUser(name, sc) {
  const email = `sessions-${name.toLowerCase()}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@staging.local`;
  const password = crypto.randomBytes(18).toString('hex');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`create ${name}: ${error.message}`);
  const id = data.user.id;
  const prof = { id, plan: sc.plan };
  if (sc.primary) { prof.primary_pro_platform = sc.primary; prof.streaming_platforms = [sc.primary]; }
  const { error: pErr } = await admin.from('profiles').upsert(prof);
  if (pErr) throw new Error(`profile ${name}: ${pErr.message}`);
  await admin.from('beta_users').insert({ user_id: id, email, onboarding_complete: true });
  if (sc.tips.length) {
    const { error: tErr } = await admin.from('tips').insert(sc.tips.map(([d, hm, platform, username, usd, source], i) => ({
      user_id: id, date_time: at(d, hm), platform, username, usd, tokens: 0,
      source, tip_ref: `sessions-modes-${name}-${i}-${id}`,
    })));
    if (tErr) throw new Error(`tips ${name}: ${tErr.message}`);
  }
  if (sc.paid.length) {
    const { error: sErr } = await admin.from('paid_sessions').insert(sc.paid.map(([d, hm, platform, username, usd, session_type]) => ({
      user_id: id, date_time: at(d, hm), platform, username, username_lower: username.toLowerCase(), usd, usd_rounded: usd, tokens: 0, session_type,
    })));
    if (sErr) throw new Error(`paid ${name}: ${sErr.message}`);
  }
  return { id, email, password };
}

async function signIn(page, u) {
  await page.goto(`${APP}/landing`, { waitUntil: 'networkidle' });
  const pw = page.locator('input[type="password"][placeholder="Password"]:visible').first();
  for (let i = 0; i < 120 && !(await pw.count()); i++) {
    if (i > 0 && i % 30 === 0) await page.goto(`${APP}/landing`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.getByRole('button', { name: 'Log In', exact: true }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  const form = page.locator('form', { has: pw }).first();
  await form.locator('input[type="email"]').fill(u.email);
  await pw.fill(u.password);
  await pw.press('Enter');
  await page.waitForURL(/\/dashboard/);
}

async function domCheck(page, name, scope, exact = {}, contains = {}) {
  for (const [id, want] of Object.entries(exact)) {
    const el = page.getByTestId(id).first();
    const got = (await el.count()) ? (await el.textContent()).trim() : '(missing)';
    table.push({ scenario: name, scope, metric: id, raw: want, dom: got });
    check(`${name} · ${id} = ${want}`, got === want, `DOM shows ${got}`);
  }
  for (const [id, want] of Object.entries(contains)) {
    const el = page.getByTestId(id).first();
    const got = (await el.count()) ? (await el.textContent()).trim() : '(missing)';
    table.push({ scenario: name, scope, metric: id, raw: `contains "${want}"`, dom: got.slice(0, 80) });
    check(`${name} · ${id} contains "${want}"`, got.includes(want), `DOM shows ${got}`);
  }
}

async function main() {
  const users = [];
  let browser;
  try {
    const launch = { headless: true, args: ['--no-sandbox'] };
    if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
    browser = await chromium.launch(launch);
    for (const [name, sc] of Object.entries(fixture.scenarios)) {
      console.log(`\n${name}`);
      const u = await makeUser(name, sc); users.push(u);
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'UTC' });
      const page = await ctx.newPage(); page.setDefaultTimeout(120_000);
      await signIn(page, u);
      await page.locator('text="Free Chat Sessions" >> visible=true').first().click();
      await page.getByTestId('sessions-overview').waitFor({ state: 'visible' });
      await page.waitForTimeout(2500);
      const e = EXPECT[name];
      const body = await page.getByTestId('sessions-overview').textContent();
      if (e.today) await domCheck(page, name, 'Today', e.today, e.todayContains || {});
      for (const id of e.present || []) check(`${name} · ${id} shown`, (await page.getByTestId(id).count()) > 0);
      if (name === 'mixed') {
        check('mixed · Today is the default scope', (await page.getByTestId('today-stats').count()) > 0);
        check('mixed · streamed time is Live-only; tip span labeled estimate', /est\. tip activity \(not stream time\)/.test(await page.getByTestId('today-streamed').locator('xpath=..').textContent()));
        await page.getByTestId('sessions-overview').screenshot({ path: path.join(OUT, `sessions-mixed-today.png`) });
        await page.getByTestId('scope-overall').locator('button').first().click().catch(async () => page.getByTestId('scope-overall').click());
        await page.getByTestId('overall-stats').waitFor({ state: 'visible' });
      }
      if (e.overall) await domCheck(page, name, 'Overall', e.overall, e.contains || {});
      if (name !== 'noData' && name !== 'mixed') {
        check(`${name} · CSV view has no $/hr, stream time, Best Day or Best Time`, !/\/hr|per hour|Streamed Time|Best Day|Best Time/i.test(body), body.match(/\/hr|per hour|Streamed Time|Best Day|Best Time/i)?.[0]);
        check(`${name} · no Today/range controls for imported-only data`, (await page.getByTestId('range-1').count()) === 0 && (await page.getByTestId('scope-switch').count()) === 0);
        check(`${name} · Session Performance cards replace platform comparison`, (await page.getByTestId('session-performance').count()) > 0 && (await page.getByTestId('today-by-platform').count()) === 0);
      }
      await page.getByTestId('sessions-overview').screenshot({ path: path.join(OUT, `sessions-${name}${name === 'mixed' ? '-overall' : ''}.png`) });
      await ctx.close();
    }
  } catch (err) {
    fail++;
    console.error('❌ Unhandled error:', err.message);
  } finally {
    if (browser) await browser.close();
    for (const u of users) {
      await admin.from('tips').delete().eq('user_id', u.id);
      await admin.from('paid_sessions').delete().eq('user_id', u.id);
      await admin.from('beta_users').delete().eq('user_id', u.id);
      await admin.from('profiles').delete().eq('id', u.id);
      await admin.auth.admin.deleteUser(u.id);
    }
  }
  console.log('\nRECONCILIATION (scenario | scope | metric | raw | DOM)');
  for (const r of table) console.log(`${r.raw === r.dom || r.dom.includes(String(r.raw).replace(/^contains "|"$/g, '')) ? 'OK ' : 'BAD'} | ${r.scenario} | ${r.scope} | ${r.metric} | ${r.raw} | ${r.dom}`);
  console.log(`\nResults: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
