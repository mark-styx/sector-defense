// Capture screenshots for visual inspection (saved to test-artifacts/, gitignored).
import {webkit} from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const url = 'file://' + path.join(ROOT, 'index.html');
const outDir = path.join(ROOT, 'test-artifacts');
fs.mkdirSync(outDir, {recursive: true});

const browser = await webkit.launch();
const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
await page.goto(url);
await page.waitForFunction(() => window.render_game_to_text != null, null, {timeout: 10000});

const clickBtn = async name => {
  const b = await page.evaluate(n => window._getBtns()[n], name);
  if (!b) throw new Error('missing ' + name);
  await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  await page.waitForTimeout(150);
};
const clickAt = async (x, y) => { await page.mouse.click(x, y); await page.waitForTimeout(150); };

// 1. Menu (fresh save -> TUTORIAL entry visible)
await clickAt(195, 400);
await page.waitForFunction(() => window._getBtns().menuPlay != null, null, {timeout: 10000});
await page.waitForTimeout(800); // let animations settle
await page.screenshot({path: path.join(outDir, '01-menu.png')});

// 2. Gameplay: build phase with towers placed + info panel open
await clickBtn('menuPlay');
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'mapSelect');
const map0 = await page.evaluate(() => window._getBtns().maps[0]);
await clickAt(map0.x + map0.w / 2, map0.y + map0.h / 2);
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'diffSelect');
const diff0 = await page.evaluate(() => window._getBtns().diffs[0]);
await clickAt(diff0.x + diff0.w / 2, diff0.y + diff0.h / 2);
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'heroSelect');
await clickBtn('heroNone');
await clickBtn('heroDeploy');
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'build');
const L = await page.evaluate(() => window._getLayout());
// Place two sentinels.
for (const [col, row] of [[3, 2], [5, 2]]) {
  await clickAt(L.offsetX + (col + 0.5) * L.cellSize, L.offsetY + (row + 0.5) * L.cellSize);
  await page.waitForFunction(() => window._getBtns().radial && window._getBtns().radial.length > 0);
  const s = await page.evaluate(() => window._getBtns().radial.find(b => b.idx === 0));
  await clickAt(s.x, s.y);
}
await page.screenshot({path: path.join(outDir, '02-build.png')});

// 3. Mid-wave combat
await clickBtn('startWave');
await page.waitForTimeout(2500);
await page.screenshot({path: path.join(outDir, '03-combat.png')});

// 4. Store (hero skins tab)
while (JSON.parse(await page.evaluate(() => window.render_game_to_text())).phase === 'wave'
    || JSON.parse(await page.evaluate(() => window.render_game_to_text())).phase === 'wavePreview'
    || JSON.parse(await page.evaluate(() => window.render_game_to_text())).phase === 'waveSummary') {
  await clickAt(195, 400);
  await page.waitForTimeout(500);
}
await clickBtn('pause');
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'paused');
await clickBtn('quit');
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'menu');
await clickBtn('menuStore');
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'store');
await page.waitForTimeout(400);
await page.screenshot({path: path.join(outDir, '04-store.png')});
await clickBtn('storeBack');

// 5. Campaign menu
await clickBtn('menuCampaign');
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'campaignMenu');
await page.waitForTimeout(400);
await page.screenshot({path: path.join(outDir, '05-campaign-menu.png')});

await browser.close();
console.log('screenshots saved to', outDir);
