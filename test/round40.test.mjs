// ROUND 40: auto-firing tower abilities (pay-to-unlock) + escalating waves.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, startClassic, tapBtn, center, state} from './harness.mjs';

const cell = (g, col, row) => {
  const L = g.window._getLayout();
  return {x: L.offsetX + (col + 0.5) * L.cellSize, y: L.offsetY + (row + 0.5) * L.cellSize};
};

async function placeTower(g, typeIdx) {
  const c = cell(g, 3, 2);
  g.tap(c.x, c.y); g.frame(2);
  const radial = g.window._getBtns().radial;
  const btn = radial.find(r => r.idx === typeIdx);
  g.tap(btn.x, btn.y); g.frame(2);
  for (let i = 0; i < 100; i++) g.frame(1); // Rapid-Deploy spin-up
}

async function startWave1(g) {
  tapBtn(g, 'startWave');
  g.tap(195, 422); g.frame(2);
  assert.equal(state(g).phase, 'wave');
}

test('locked abilities never auto-fire', async () => {
  const g = await boot();
  await startClassic(g);
  await placeTower(g, 0); // sentinel: stim triggers on 1 enemy in range
  await startWave1(g);
  for (let i = 0; i < 60 * 8 && state(g).phase === 'wave'; i++) g.frame(1);
  const raw = g.window._getTowersRaw()[0];
  assert.equal(raw.abUnlocked, false, 'fresh towers are locked');
  assert.ok(raw.abCd <= 0, 'locked ability must not consume cooldown');
  assert.equal(raw.abOn, false, 'locked ability must not activate');
});

test('unlocked abilities auto-fire on their trigger', async () => {
  const g = await boot();
  await startClassic(g);
  await placeTower(g, 0); // sentinel: stim fires on first contact
  // Unlock via the real info panel.
  const c = cell(g, 3, 2);
  g.tap(c.x, c.y); g.frame(2);
  const ab = g.window._getBtns().ability;
  assert.ok(ab, 'unlock button shown while locked');
  const ac = center(ab); g.tap(ac.x, ac.y); g.frame(2);
  assert.equal(g.window._getTowersRaw()[0].abUnlocked, true);
  const close = g.window._getBtns().closeInfo;
  g.tap(center(close).x, center(close).y); g.frame(2);
  const spent = state(g).nexium;
  assert.equal(spent, 300 - 50 - 30, 'unlock cost 30 (60% of sentinel 50)');
  await startWave1(g);
  let fired = false;
  for (let i = 0; i < 60 * 8 && state(g).phase === 'wave'; i++) {
    g.frame(1);
    const r = g.window._getTowersRaw()[0];
    if (r.abOn || r.abCd > 0) { fired = true; break; }
  }
  assert.ok(fired, 'unlocked stim should auto-fire when an enemy enters range');
});

test('overcharge conservatively waits for a target worth a 5x shot', async () => {
  const g = await boot();
  await startClassic(g);
  await placeTower(g, 4); // nova: overcharge needs peakHp >= 4x damage
  const c = cell(g, 3, 2);
  g.tap(c.x, c.y); g.frame(2);
  const ab = g.window._getBtns().ability;
  g.tap(center(ab).x, center(ab).y); g.frame(2);
  const close = g.window._getBtns().closeInfo;
  g.tap(center(close).x, center(close).y); g.frame(2);
  await startWave1(g);
  // Wave 1 is skitterlings (~35-70hp) — far below 4x nova damage.
  for (let i = 0; i < 60 * 6 && state(g).phase === 'wave'; i++) g.frame(1);
  const r = g.window._getTowersRaw()[0];
  assert.equal(r.abOn, false, 'overcharge must not trigger on fodder');
  assert.ok(r.abCd <= 0, 'and must not burn cooldown scanning');
});

test('classic enemy HP escalates with wave number', async () => {
  const g = await boot();
  await startClassic(g);
  // Wave 1 (index 0): no ramp. Wave 40 (index 39): ~2.006x.
  assert.equal(g.window._getWaveHpMult(0), 1);
  const m40 = g.window._getWaveHpMult(39);
  assert.ok(Math.abs(m40 - Math.pow(1.018, 39)) < 1e-9);
  assert.ok(m40 > 1.9 && m40 < 2.1, `wave-40 ramp ~2x, got ${m40.toFixed(3)}`);
  // Live spawn check: wave 37 (index 36) leads with skitterlings — the first
  // spawn carries the ramp immediately (wave 40's skitterlings arrive ~56s
  // into the wave, too late for a quick probe).
  g.window._setGameState('wave', 36);
  tapBtn(g, 'startWave'); g.frame(2);
  g.tap(195, 422); g.frame(2);
  let e = null;
  for (let i = 0; i < 120 && state(g).phase === 'wave'; i++) {
    g.frame(1);
    e = g.window._getEnemies().find(x => x.type === 'skitterling' && x.alive);
    if (e) break;
  }
  assert.ok(e, 'a skitterling should spawn early in wave 37');
  assert.equal(e.hp, Math.round(30 * 1.15 * g.window._getWaveHpMult(36)), 'late-wave enemy carries the ramp');
});

test('endless and other modes keep their own curves (no classic ramp)', async () => {
  const g = await boot();
  tapBtn(g, 'menuEndless');
  const biomes = g.window._getBtns().biomes;
  const b = center(biomes[0]); g.tap(b.x, b.y); g.frame(2);
  assert.equal(state(g).phase, 'build');
  assert.equal(g.window._getWaveHpMult(30), 1, 'endless excluded from the classic ramp');
});
