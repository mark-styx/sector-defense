// Real-browser smoke test: loads the game in real browser engines (Chromium
// AND WebKit — WebKit is the same core as iOS Safari/WKWebView, the actual
// shipping target), plays a real session with real input events, and asserts
// zero console/page errors plus a sane frame rate. Run: npm run test:browser
// (requires: npx playwright install chromium-headless-shell webkit)
import {chromium, webkit} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

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

// Skip splash with a tap (also unlocks audio path).
await page.mouse.click(195, 400);
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'menu', null, {timeout: 6000});
// Wait for the first menu render to populate hitboxes (engine-dependent timing).
await page.waitForFunction(() => window._getBtns().menuPlay != null, null, {timeout: 10000});
console.log(`✓ [${engineName}] loaded in real browser, reached menu`);

// --- Classic flow ---
await clickBtn('menuPlay');
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
console.log(`✓ [${engineName}] wave running: ${fps.toFixed(1)} fps, enemies=${s.enemyCount}, kills=${s.totalKills}`);
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
await waitForPhase('campaignMenu');
console.log(`✓ [${engineName}] campaign menu renders`);

await browser.close();

assert.deepEqual(pageErrors, [], `[${engineName}] no uncaught page errors`);
assert.deepEqual(consoleErrors, [], `[${engineName}] no console errors`);
console.log(`✓ [${engineName}] SMOKE PASSED — zero console/page errors`);
}

await runSession('chromium', () => chromium.launch());
await runSession('webkit', () => webkit.launch()); // iOS Safari engine core
console.log('\nALL BROWSER ENGINES PASSED');
