// Round 38: hero manual control + aimed abilities + art smoke.
// Covers: auto-pilot default, tap-hero toggle, manual move orders,
// auto-chase suppression + resume, aim mode gating (enter/cancel/cast),
// warden aimed wall placement, phantom snap strike + no-target guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, tapBtn, center} from './harness.mjs';

function state(g) { return JSON.parse(g.window.render_game_to_text()); }

// Boot → Outpost Alpha → Standard → hero[idx] deployed → build phase.
async function bootWithHero(idx) {
  const g = await boot();
  g.frame(5);
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  const mc = center(maps[0]); g.tap(mc.x, mc.y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  const dc = center(diffs[0]); g.tap(dc.x, dc.y); g.frame(2);
  const cards = g.window._getBtns().heroCards;
  const hc = center(cards[idx]); g.tap(hc.x, hc.y); g.frame(2);
  tapBtn(g, 'heroDeploy');
  g.frame(5);
  return g;
}

function startWave(g) {
  tapBtn(g, 'startWave');
  g.tap(195, 422); g.frame(2); // dismiss wave preview overlay
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('auto mode is the default: no manual flag, hero chases enemies', async () => {
  const g = await bootWithHero(0); // Vanguard
  const h0 = g.window._getHeroState();
  assert.equal(h0.deployed, true);
  assert.equal(h0.manual, false, 'fresh deploy must be auto-pilot');
  const end = g.window._getPathPts(0).at(-1);
  startWave(g);
  g.frame(120); // enemies marching away from the spawn
  const enemies = g.window._getEnemies().filter(e => e.alive);
  assert.ok(enemies.length > 0, 'enemies on field');
  const nearest = enemies.reduce((a, b) =>
    dist(g.window._getHeroState(), a) < dist(g.window._getHeroState(), b) ? a : b);
  const L = g.window._getLayout();
  const st = g.window._getHeroState();
  const targetGap = Math.hypot(st.tx - nearest.px, st.ty - nearest.py);
  assert.ok(targetGap < L.cellSize * 4,
    `auto chase target should track the nearest enemy, gap ${targetGap.toFixed(0)}px`);
  const d0 = dist(st, end);
  g.frame(300);
  const d1 = dist(g.window._getHeroState(), end);
  assert.ok(d1 < d0 - 20, `auto hero should close on the pack: ${d0.toFixed(0)} -> ${d1.toFixed(0)}`);
});

test('tapping the hero toggles manual control on and off', async () => {
  const g = await bootWithHero(0);
  const h = g.window._getHeroState();
  g.tap(h.x, h.y); g.frame(2);
  assert.equal(g.window._getHeroState().manual, true, 'first tap selects manual');
  const h2 = g.window._getHeroState();
  g.tap(h2.x, h2.y); g.frame(2);
  assert.equal(g.window._getHeroState().manual, false, 'second tap returns to auto');
});

test('manual mode suppresses auto-chase; hero holds position', async () => {
  const g = await bootWithHero(0);
  const h = g.window._getHeroState();
  g.tap(h.x, h.y); g.frame(2); // manual ON
  const end = g.window._getPathPts(0).at(-1);
  startWave(g);
  g.frame(30);
  const d0 = dist(g.window._getHeroState(), end);
  g.frame(300);
  const d1 = dist(g.window._getHeroState(), end);
  assert.ok(Math.abs(d1 - d0) < 25, `manual hero must hold: ${d0.toFixed(0)} -> ${d1.toFixed(0)}`);
  assert.equal(g.window._getHeroState().manual, true, 'still manual');
});

test('manual move order: tap non-buildable ground, hero walks there', async () => {
  const g = await bootWithHero(0);
  const h = g.window._getHeroState();
  g.tap(h.x, h.y); g.frame(2);
  const end = g.window._getPathPts(0).at(-1);
  startWave(g);
  g.frame(10);
  g.tap(end.x, end.y); g.frame(2); // path cell = non-buildable -> move order
  const st = g.window._getHeroState();
  assert.ok(Math.abs(st.tx - end.x) < 1 && Math.abs(st.ty - end.y) < 1, 'order target recorded');
  g.frame(600); // 10s march
  const d = dist(g.window._getHeroState(), end);
  assert.ok(d < 40, `hero should reach the ordered point, dist ${d.toFixed(0)}`);
  // Releasing control resumes chase
  const h2 = g.window._getHeroState();
  g.tap(h2.x, h2.y); g.frame(2);
  assert.equal(g.window._getHeroState().manual, false);
});

test('manual mode does not hijack tower placement on buildable cells', async () => {
  const g = await bootWithHero(0);
  const h = g.window._getHeroState();
  g.tap(h.x, h.y); g.frame(2); // manual ON
  const L = g.window._getLayout();
  const px = L.offsetX + 3 * L.cellSize + L.cellSize / 2;
  const py = L.offsetY + 2 * L.cellSize + L.cellSize / 2;
  g.tap(px, py); g.frame(2);
  assert.ok(g.window._getBtns().radial, 'buildable-cell tap must still open the tower radial');
});

test('aim mode: manual + aimable ability enters targeting, does not cast yet', async () => {
  const g = await bootWithHero(2); // Warden — block_path is aimable
  const h = g.window._getHeroState();
  g.tap(h.x, h.y); g.frame(2); // manual ON
  const ab = center(g.window._getBtns().heroAbility);
  g.tap(ab.x, ab.y); g.frame(2);
  assert.equal(g.window._getHeroStateExt().aim, 'ability', 'targeting mode armed');
  assert.equal(g.window._getHeroState().abCd, 0, 'no cooldown consumed while aiming');
  // Cancel by tapping the button again
  g.tap(ab.x, ab.y); g.frame(2);
  assert.equal(g.window._getHeroStateExt().aim, null, 'aim cancelled');
  assert.equal(g.window._getHeroState().abCd, 0, 'still no cooldown after cancel');
});

test('aimed warden wall lands on the path nearest the tap, cd applied', async () => {
  const g = await bootWithHero(2);
  const h = g.window._getHeroState();
  g.tap(h.x, h.y); g.frame(2);
  const pts = g.window._getPathPts(0);
  const target = pts[Math.floor(pts.length / 2)]; // far from the hero
  startWave(g);
  g.frame(5);
  const ab = center(g.window._getBtns().heroAbility);
  g.tap(ab.x, ab.y); g.frame(2);
  g.tap(target.x + 6, target.y - 6); g.frame(2); // sloppy tap near the path point
  assert.equal(g.window._getHeroStateExt().aim, null, 'aim consumed');
  const st = g.window._getHeroState();
  assert.ok(st.shield, 'wall placed');
  assert.ok(Math.abs(st.shield.x - target.x) < 1 && Math.abs(st.shield.y - target.y) < 1,
    'wall snaps to the path point nearest the tap');
  assert.ok(Math.abs(st.abCd - 40) < 0.05, `warden cd 40, got ${st.abCd}`);
});

test('auto mode (no manual) casts instantly at hero, no targeting step', async () => {
  const g = await bootWithHero(2); // warden again: aimable but manual OFF
  startWave(g);
  g.frame(5);
  const ab = center(g.window._getBtns().heroAbility);
  g.tap(ab.x, ab.y); g.frame(2);
  assert.equal(g.window._getHeroStateExt().aim, null, 'no aim step in auto mode');
  const st = g.window._getHeroState();
  assert.ok(st.shield, 'wall placed immediately');
  assert.ok(st.abCd > 0, 'cooldown started');
});

test('phantom aimed strike snaps to the enemy near the tap', async () => {
  const g = await bootWithHero(3); // Phantom — teleport_strike
  const h = g.window._getHeroState();
  g.tap(h.x, h.y); g.frame(2);
  startWave(g);
  g.frame(60); // let enemies march
  const enemies = g.window._getEnemies().filter(e => e.alive);
  assert.ok(enemies.length > 0, 'enemies on field');
  const e = enemies[0];
  const hp0 = e.hp;
  const ab = center(g.window._getBtns().heroAbility);
  g.tap(ab.x, ab.y); g.frame(2);
  assert.equal(g.window._getHeroStateExt().aim, 'ability');
  g.tap(e.px + 25, e.py); g.frame(2); // tap 25px off the enemy — snap range 80
  assert.equal(g.window._getHeroStateExt().aim, null);
  const after = g.window._getEnemies().find(x => x.id === e.id);
  assert.ok(!after || after.hp <= hp0 - 500, `strike damage applied: ${hp0} -> ${after && after.hp}`);
  assert.ok(Math.abs(g.window._getHeroState().abCd - 20) < 0.05, 'phantom cd 20');
});

test('phantom aimed strike with no enemy near the tap refunds the cooldown', async () => {
  const g = await bootWithHero(3);
  const h = g.window._getHeroState();
  g.tap(h.x, h.y); g.frame(2);
  const far = {x: 20, y: 20}; // HUD corner — no enemies there
  const ok = g.window._castHeroAimAt(far.x, far.y);
  assert.equal(ok, false, 'cast must fail with no target');
  assert.equal(g.window._getHeroState().abCd, 0, 'cooldown not consumed on miss');
});

test('hero roster renders all five new hero artworks without errors', async () => {
  const g = await boot();
  g.frame(5);
  tapBtn(g, 'menuHeroes');
  g.frame(120); // roster draws all 5 icons every frame
  assert.ok(true, 'no crash across 120 roster frames');
});
