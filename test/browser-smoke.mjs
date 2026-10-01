// Real-browser smoke test: loads the game in real browser engines (Chromium
// AND WebKit — WebKit is the same core as iOS Safari/WKWebView, the actual
// shipping target), plays a real session with real input events, and asserts
// zero console/page errors plus a sane frame rate. Run: npm run test:browser
// (requires: npx playwright install chromium-headless-shell webkit)
import {chromium, webkit, devices} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runEnemyAttackBrowserTests} from './browser-enemy-attacks.mjs';
import {runCampaignAssaultBrowserTests} from './browser-campaign-assault.mjs';
import {runBossVisualBrowserTests} from './browser-boss-visuals.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const url = 'file://' + path.join(ROOT, 'index.html');

async function runSession(engineName, launch) {
  const browser = await launch();
  const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});

const consoleErrors = [];
const pageErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => pageErrors.push(String(err)));

await page.goto(url);
await page.waitForFunction(() => window.render_game_to_text != null, null, {timeout: 10000});

const state = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const waitForPhase = phase =>
  page.waitForFunction(p => JSON.parse(window.render_game_to_text()).phase === p, phase, {timeout: 15000});

// Pixel-level render check: the canvas must actually draw (not blank/black).
const colorDiversity = () => page.evaluate(() => {
  const c = document.getElementById('gameCanvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 97) { // sample every 97th pixel
    seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (seen.size > 500) break;
  }
  return seen.size;
});
const btn = async name => {
  const b = await page.evaluate(n => window._getBtns()[n], name);
  if (!b) throw new Error('missing button ' + name);
  return b;
};
const clickBtn = async name => {
  const b = await btn(name);
  await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  await page.waitForTimeout(120);
};
const clickAt = async (x, y) => { await page.mouse.click(x, y); await page.waitForTimeout(120); };
// Fresh profiles see one-time mode briefings — dismiss when one opens.
const dismissBriefing = async () => {
  const m = await page.evaluate(() => window._getModal());
  if (m && m.btns && m.btns.yes) {
    await page.mouse.click(m.btns.yes.x + m.btns.yes.w / 2, m.btns.yes.y + m.btns.yes.h / 2);
    await page.waitForTimeout(120);
  }
  return !!m;
};

// Skip splash with a tap (also unlocks audio path).
await page.mouse.click(195, 400);
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'menu', null, {timeout: 6000});
// Wait for the first menu render to populate hitboxes (engine-dependent timing).
await page.waitForFunction(() => window._getBtns().menuPlay != null, null, {timeout: 10000});
// Visual render check: menu must actually paint (starfield, gradients, buttons).
const menuColors = await colorDiversity();
assert.ok(menuColors >= 50, `[${engineName}] menu looks blank: ${menuColors} colors sampled`);
console.log(`✓ [${engineName}] loaded in real browser, reached menu (${menuColors}+ colors rendered)`);

// --- Classic flow ---
await clickBtn('menuPlay');
await dismissBriefing();
await waitForPhase('mapSelect');
const map0 = await page.evaluate(() => window._getBtns().maps[0]);
await clickAt(map0.x + map0.w / 2, map0.y + map0.h / 2);
await waitForPhase('diffSelect');
const diff0 = await page.evaluate(() => window._getBtns().diffs[0]);
await clickAt(diff0.x + diff0.w / 2, diff0.y + diff0.h / 2);
await waitForPhase('heroSelect');
await clickBtn('heroNone');
await clickBtn('heroDeploy');
await waitForPhase('build');
console.log(`✓ [${engineName}] classic run started`);

// --- Place a tower via real taps (cell -> radial -> sentinel) ---
const L = await page.evaluate(() => window._getLayout());
await clickAt(L.offsetX + 3.5 * L.cellSize, L.offsetY + 2.5 * L.cellSize);
await page.waitForFunction(() => window._getBtns().radial && window._getBtns().radial.length > 0);
const sentinel = await page.evaluate(() => window._getBtns().radial.find(b => b.idx === 0));
await clickAt(sentinel.x, sentinel.y);
let s = await state();
assert.equal(s.towerCount, 1, 'tower placed in real browser');
console.log(`✓ [${engineName}] tower placed via radial menu`);

// --- Round 39: tower upgrades must visibly change the art on canvas ---
const towerCellColors = () => page.evaluate(() => {
  const L2 = window._getLayout();
  const c = document.getElementById('gameCanvas');
  const sc = c.width / 390;
  const x0 = Math.max(0, Math.floor((L2.offsetX + 3 * L2.cellSize) * sc) - 8);
  const y0 = Math.max(0, Math.floor((L2.offsetY + 2 * L2.cellSize) * sc) - 8);
  const w = Math.floor(L2.cellSize * sc * 1.9), h = Math.floor(L2.cellSize * sc * 1.9);
  const d = c.getContext('2d').getImageData(x0, y0, w, h).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  return seen.size;
});
// Let the Rapid-Deploy spin-up finish so the full lv0 body renders.
await page.waitForTimeout(1800);
const art0 = await towerCellColors();
await clickAt(L.offsetX + 3.5 * L.cellSize, L.offsetY + 2.5 * L.cellSize); // open info panel
await page.waitForFunction(() => window._getBtns().upgrade != null, null, {timeout: 5000});
await clickBtn('upgrade');
await page.waitForTimeout(400);
const art1 = await towerCellColors();
await page.waitForFunction(() => window._getBtns().upgrade != null, null, {timeout: 5000});
await clickBtn('upgrade');
await page.waitForTimeout(400);
const art2 = await towerCellColors();
assert.ok(art1 > art0 + 15, `[${engineName}] lv1 art richer than lv0 (${art0} -> ${art1} colors)`);
assert.ok(art2 > art1 + 15, `[${engineName}] lv2 art richer than lv1 (${art1} -> ${art2} colors)`);
console.log(`✓ [${engineName}] tower upgrade art escalates: lv0=${art0} lv1=${art1} lv2=${art2} colors`);
// Close the info panel so its hitboxes can't eat the wave-start tap.
const closeInfo = await page.evaluate(() => window._getBtns().closeInfo);
if (closeInfo) await clickAt(closeInfo.x + closeInfo.w / 2, closeInfo.y + closeInfo.h / 2);

// --- Start wave 1 and sample the frame rate during combat ---
await clickBtn('startWave');
await waitForPhase('wavePreview');
await clickAt(195, 400); // begin wave
await waitForPhase('wave');
const fps = await page.evaluate(() => new Promise(resolve => {
  let frames = 0;
  const t0 = performance.now();
  const tick = () => { frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else resolve(frames / 2); };
  requestAnimationFrame(tick);
}));
s = await state();
assert.ok(s.enemyCount > 0 || s.totalKills > 0, 'wave 1 should have activity');
const waveColors = await colorDiversity();
assert.ok(waveColors >= 50, `[${engineName}] battlefield looks blank: ${waveColors} colors sampled`);
console.log(`✓ [${engineName}] wave running: ${fps.toFixed(1)} fps, enemies=${s.enemyCount}, kills=${s.totalKills}, ${waveColors}+ colors`);
assert.ok(fps >= 15, `frame rate catastrophically low: ${fps.toFixed(1)} fps`);

// --- Pause -> quit -> store renders ---
await clickBtn('pause');
await waitForPhase('paused');
await clickBtn('quit');
await waitForPhase('menu');
await clickBtn('menuStore');
await waitForPhase('store');
const tabs = await page.evaluate(() => window._getBtns().storeTabs);
await clickAt(tabs[4].x + tabs[4].w / 2, tabs[4].y + tabs[4].h / 2); // CREDITS
await page.waitForTimeout(200);
const creditItem = await page.evaluate(() => window._getBtns().storeItems.find(i => i.type === 'credits'));
assert.ok(creditItem, 'credits tab renders in real browser');
console.log(`✓ [${engineName}] store renders with credit tiers`);

// --- Campaign menu renders ---
await clickBtn('storeBack');
await clickBtn('menuCampaign');
await dismissBriefing();
await waitForPhase('campaignMenu');
console.log(`✓ [${engineName}] campaign menu renders`);

// --- Legal pages load cleanly (linked from the in-game settings) ---
for (const page of ['privacy.html', 'terms.html']) {
  const p = await browser.newPage({viewport: {width: 390, height: 844}});
  const errs = [];
  p.on('pageerror', err => errs.push(String(err)));
  await p.goto(url.replace('index.html', page));
  await p.waitForLoadState('domcontentloaded');
  const title = await p.title();
  assert.ok(title.includes('Sector Defense'), `${page} should have a title`);
  assert.deepEqual(errs, [], `${page} should load without errors`);
  await p.close();
}
console.log(`✓ [${engineName}] legal pages (privacy/terms) load cleanly`);

await browser.close();

assert.deepEqual(pageErrors, [], `[${engineName}] no uncaught page errors`);
assert.deepEqual(consoleErrors, [], `[${engineName}] no console errors`);
console.log(`✓ [${engineName}] SMOKE PASSED — zero console/page errors`);
}

await runSession('chromium', () => chromium.launch());
await runSession('webkit', () => webkit.launch()); // iOS Safari engine core
await runEnemyAttackBrowserTests('chromium', chromium);
await runEnemyAttackBrowserTests('webkit', webkit);
await runCampaignAssaultBrowserTests('chromium', chromium);
await runCampaignAssaultBrowserTests('webkit', webkit);
await runBossVisualBrowserTests('chromium', chromium);
await runBossVisualBrowserTests('webkit', webkit);

// --- Touch-input session (the real iPhone modality: touchstart events) ---
// Runs in WebKit: iOS engine + iOS input = the shipping pairing.
{
  const browser = await webkit.launch();
  const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true});
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(String(err)));
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text != null, null, {timeout: 10000});
  const tapAt = async (x, y) => { await page.touchscreen.tap(x, y); await page.waitForTimeout(150); };
  const tapBtn = async name => {
    const b = await page.evaluate(n => window._getBtns()[n], name);
    if (!b) throw new Error('missing button ' + name);
    await tapAt(b.x + b.w / 2, b.y + b.h / 2);
  };
  const waitForPhase = phase =>
    page.waitForFunction(p => JSON.parse(window.render_game_to_text()).phase === p, phase, {timeout: 15000});

  await tapAt(195, 400); // skip splash via touch
  await page.waitForFunction(() => window._getBtns().menuPlay != null, null, {timeout: 10000});
  await tapBtn('menuPlay');
  { // dismiss the first-run briefing via touch
    const m = await page.evaluate(() => window._getModal());
    if (m && m.btns && m.btns.yes) await tapAt(m.btns.yes.x + m.btns.yes.w / 2, m.btns.yes.y + m.btns.yes.h / 2);
  }
  await waitForPhase('mapSelect');
  const map0 = await page.evaluate(() => window._getBtns().maps[0]);
  await tapAt(map0.x + map0.w / 2, map0.y + map0.h / 2);
  await waitForPhase('diffSelect');
  const diff0 = await page.evaluate(() => window._getBtns().diffs[0]);
  await tapAt(diff0.x + diff0.w / 2, diff0.y + diff0.h / 2);
  await waitForPhase('heroSelect');
  await tapBtn('heroNone');
  await tapBtn('heroDeploy');
  await waitForPhase('build');
  console.log('✓ [webkit-touch] full navigation via touch events (iOS input path)');

  // Resize mid-game (orientation/safe-area change) must not break anything.
  await page.setViewportSize({width: 428, height: 740});
  await page.waitForTimeout(300);
  const s = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  assert.equal(s.phase, 'build', 'phase survives viewport resize');
  assert.deepEqual(pageErrors, [], '[webkit-touch] no page errors');
  console.log('✓ [webkit-touch] viewport resize mid-game handled cleanly');

  await browser.close();
}

// --- Smallest supported device: iPhone SE (375x667) layout check ---
{
  const browser = await webkit.launch();
  const page = await browser.newPage({...devices['iPhone SE']});
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(String(err)));
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text != null, null, {timeout: 10000});
  await page.touchscreen.tap(187, 330); // skip splash
  await page.waitForFunction(() => window._getBtns().menuPlay != null, null, {timeout: 10000});
  // Fresh save -> 13 menu buttons incl. TUTORIAL: every hitbox must fit the viewport.
  const fit = await page.evaluate(() => {
    const btns = window._getBtns();
    const out = [];
    for (const [k, b] of Object.entries(btns)) {
      if (b && b.y !== undefined && b.h !== undefined && (b.y + b.h > innerHeight || b.y < 0)) out.push(k);
    }
    return {overflow: out, count: Object.keys(btns).length};
  });
  assert.deepEqual(fit.overflow, [], `buttons overflow iPhone SE viewport: ${fit.overflow.join(',')}`);
  const play = await page.evaluate(() => window._getBtns().menuPlay);
  await page.touchscreen.tap(play.x + play.w / 2, play.y + play.h / 2);
  await page.waitForTimeout(250); // let the synthesized click open the briefing
  { // dismiss first-run briefing modal via touch
    const m = await page.evaluate(() => window._getModal());
    if (m && m.btns && m.btns.yes)
      await page.touchscreen.tap(m.btns.yes.x + m.btns.yes.w / 2, m.btns.yes.y + m.btns.yes.h / 2);
  }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'mapSelect', null, {timeout: 10000});
  assert.deepEqual(pageErrors, [], '[iPhone SE] no page errors');
  console.log(`✓ [iPhone SE] all ${fit.count}+ menu buttons fit 375x667; navigation works`);
  await browser.close();
}

console.log('\nALL BROWSER ENGINES PASSED');
