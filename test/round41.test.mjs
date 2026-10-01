// ROUND 41 quality pass regressions: damage-economy consistency.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, startClassic, tapBtn, center} from './harness.mjs';

function state(g) { return JSON.parse(g.window.render_game_to_text()); }
const cell = (g, col, row) => {
  const L = g.window._getLayout();
  return {x: L.offsetX + (col + 0.5) * L.cellSize, y: L.offsetY + (row + 0.5) * L.cellSize};
};

async function startWave1(g) {
  tapBtn(g, 'startWave');
  g.tap(195, 422); g.frame(2);
}

test('oracle passive amplifies damage income, no time drip', async () => {
  const g = await boot();
  // Deploy Zara Prime (oracle, heroCards[4]) and enter wave 1.
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  g.tap(center(maps[0]).x, center(maps[0]).y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  g.tap(center(diffs[0]).x, center(diffs[0]).y); g.frame(2);
  const cards = g.window._getBtns().heroCards;
  g.tap(center(cards[4]).x, center(cards[4]).y); g.frame(2);
  tapBtn(g, 'heroDeploy');
  await startWave1(g);
  // Wait for the first enemy.
  let id = -1;
  for (let i = 0; i < 120 && id < 0; i++) { g.frame(1); const e = g.window._getEnemies()[0]; if (e) id = e.id; }
  assert.ok(id >= 0, 'enemy spawned');
  const eco0 = g.window._getEconomy().earned;
  // With no combat yet, a pure 60-frame idle must NOT accrue time income.
  for (let i = 0; i < 60; i++) g.frame(1);
  assert.ok(g.window._getEconomy().earned - eco0 < 0.01, 'oracle must not drip nexium over time');
  // Damage income is amplified by +12% (level-1 passiveStr 0).
  const bank0 = g.window._getEconomy().earned;
  const credited = g.window._awardNexiumForDamage(id, 10);
  const gained = g.window._getEconomy().earned - bank0;
  const expected = 10 * 0.30 * (1.0 / 1.15) * 1.12;
  assert.ok(Math.abs(gained - expected) < 0.02,
    `oracle amplifies damage income: got ${gained.toFixed(3)}, expected ${expected.toFixed(3)}`);
});

test('offense-mode kills mint zero nexium (reward-0 kicker fix)', async () => {
  const g = await boot();
  tapBtn(g, 'menuOffense');
  const maps = g.window._getBtns().offenseMaps;
  g.tap(center(maps[0]).x, center(maps[0]).y); g.frame(2);
  assert.equal(state(g).phase, 'offenseGame');
  g.window._spawnOffense('skitterling');
  // Map-0 towers shred skitterlings quickly; once everything is dead the
  // economy must show zero income for the whole exchange.
  for (let i = 0; i < 60 * 20; i++) {
    g.frame(1);
    if (i > 30 && g.window._getEnemies().every(e => !e.alive)) break;
  }
  assert.ok(g.window._getEnemies().every(e => !e.alive), 'unit should die to defense');
  assert.equal(g.window._getEconomy().earned, 0, 'offense kills must not credit nexium');
});

test('hivemind swarmers inherit the classic wave ramp', async () => {
  const g = await boot();
  await startClassic(g);
  // Wave 16 (index 15) leads with hiveminds; their spawnCD is ~4s.
  g.window._setGameState('wave', 15);
  tapBtn(g, 'startWave'); g.frame(2);
  g.tap(195, 422); g.frame(2);
  let sw = null;
  for (let i = 0; i < 60 * 30 && state(g).phase === 'wave'; i++) {
    g.frame(1);
    sw = g.window._getEnemies().find(e => e.type === 'swarmer' && e.alive);
    if (sw) break;
  }
  assert.ok(sw, 'hivemind should spit swarmers');
  const wm = g.window._getWaveHpMult(15);
  assert.equal(sw.hp, Math.round(15 * 1.15 * wm), 'swarmer HP carries the wave ramp');
});

test('vanguard aura and ultimate actually modify tower stats (dead-wiring fix)', async () => {
  const g = await boot();
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  g.tap(center(maps[0]).x, center(maps[0]).y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  g.tap(center(diffs[0]).x, center(diffs[0]).y); g.frame(2);
  const cards = g.window._getBtns().heroCards;
  g.tap(center(cards[0]).x, center(cards[0]).y); g.frame(2); // Commander Vex
  tapBtn(g, 'heroDeploy');
  // Pin the hero in manual mode so its position is deterministic.
  const hs = g.window._getHeroState();
  g.tap(hs.x, hs.y); g.frame(2);
  assert.equal(g.window._getHeroState().manual, true, 'hero pinned');
  // Place a sentinel on the buildable cell nearest the hero.
  const L = g.window._getLayout();
  const cells = g.window._getValidCells().map(c => ({c, d: Math.hypot(
    (L.offsetX + (c.col + 0.5) * L.cellSize) - hs.x,
    (L.offsetY + (c.row + 0.5) * L.cellSize) - hs.y)})).sort((a, b) => a.d - b.d);
  assert.ok(cells.length && cells[0].d < 3.5 * L.cellSize, 'a buildable cell near the hero');
  const pick = cells[0].c;
  g.tap(L.offsetX + (pick.col + 0.5) * L.cellSize, L.offsetY + (pick.row + 0.5) * L.cellSize); g.frame(2);
  const radial = g.window._getBtns().radial;
  const sentinel = radial.find(r => r.idx === 0);
  g.tap(sentinel.x, sentinel.y); g.frame(2);
  const s = g.window._getTowerStatsFor(0);
  // Base lv0 sentinel: damage 8, fireRate 0.25. Battle Cry (1.15x) applies.
  assert.equal(s.damage, 9, 'aura-boosted damage round(8*1.15)');
  assert.ok(Math.abs(s.fireRate - 0.25) < 1e-9, 'fire rate untouched without ult');
  // Total War: fire 2x while the ult runs.
  g.window._setHeroUltActive(10);
  const s2 = g.window._getTowerStatsFor(0);
  assert.equal(s2.damage, 9, 'ult is fire-rate only (no damage double-dip)');
  assert.ok(Math.abs(s2.fireRate - 0.125) < 1e-9, 'Total War halves cooldowns (fire 2x)');
  g.window._setHeroUltActive(0);
});

test('technomancer overclock fires end-to-end through the ability button', async () => {
  const g = await boot();
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  g.tap(center(maps[0]).x, center(maps[0]).y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  g.tap(center(diffs[0]).x, center(diffs[0]).y); g.frame(2);
  const cards = g.window._getBtns().heroCards;
  g.tap(center(cards[1]).x, center(cards[1]).y); g.frame(2); // Dr. Lyra Sol
  tapBtn(g, 'heroDeploy');
  // Pin the hero, place a sentinel on the nearest buildable cell.
  const hs = g.window._getHeroState();
  g.tap(hs.x, hs.y); g.frame(2);
  assert.equal(g.window._getHeroState().manual, true, 'hero pinned');
  const L = g.window._getLayout();
  const cells = g.window._getValidCells().map(c => ({c, d: Math.hypot(
    (L.offsetX + (c.col + 0.5) * L.cellSize) - hs.x,
    (L.offsetY + (c.row + 0.5) * L.cellSize) - hs.y)})).sort((a, b) => a.d - b.d);
  assert.ok(cells.length && cells[0].d < 3.5 * L.cellSize, 'buildable cell near hero');
  const pick = cells[0].c;
  g.tap(L.offsetX + (pick.col + 0.5) * L.cellSize, L.offsetY + (pick.row + 0.5) * L.cellSize); g.frame(2);
  const radial = g.window._getBtns().radial;
  const sentinel = radial.find(r => r.idx === 0);
  g.tap(sentinel.x, sentinel.y); g.frame(2);
  const s0 = g.window._getTowerStatsFor(0);
  assert.ok(Math.abs(s0.fireRate - 0.25) < 1e-9, 'base fire rate');
  // Overclock is not aimable — the hero ability button casts it instantly.
  const hb = g.window._getBtns().heroAbility;
  assert.ok(hb, 'hero ability button present');
  g.tap(center(hb).x, center(hb).y); g.frame(3);
  const s1 = g.window._getTowerStatsFor(0);
  assert.ok(Math.abs(s1.fireRate - 0.125) < 1e-9,
    `overclock halves nearby cooldowns via the live button (got ${s1.fireRate})`);
  assert.equal(s1.damage, s0.damage, 'overclock is fire-rate only');
});

test('oracle Prophecy ult slows enemies (dead-wiring fix)', async () => {
  const g = await boot();
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  g.tap(center(maps[0]).x, center(maps[0]).y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  g.tap(center(diffs[0]).x, center(diffs[0]).y); g.frame(2);
  const cards = g.window._getBtns().heroCards;
  g.tap(center(cards[4]).x, center(cards[4]).y); g.frame(2); // Zara Prime
  tapBtn(g, 'heroDeploy');
  tapBtn(g, 'startWave'); g.frame(2);
  g.tap(195, 422); g.frame(2);
  let e0 = null;
  for (let i = 0; i < 120 && !e0; i++) { g.frame(1); e0 = g.window._getEnemies().find(x => x.alive); }
  assert.ok(e0, 'enemy spawned');
  const prog0 = e0.progress;
  for (let i = 0; i < 60; i++) g.frame(1);
  const e1 = g.window._getEnemies().find(x => x.id === e0.id && x.alive);
  const normalRate = e1.progress - prog0;
  g.window._setHeroUltActive(10);
  const prog1 = e1.progress;
  for (let i = 0; i < 60; i++) g.frame(1);
  const e2 = g.window._getEnemies().find(x => x.id === e0.id && x.alive);
  const slowedRate = e2.progress - prog1;
  assert.ok(normalRate > 0, 'enemy moves in normal state');
  assert.ok(slowedRate < normalRate * 0.8,
    `Prophecy slow must bite: ${slowedRate.toFixed(4)} vs ${normalRate.toFixed(4)}`);
});
