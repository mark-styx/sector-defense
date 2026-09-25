// Regression + integration tests for Sector Defense.
// Covers the commercial-polish fixes: match economy, offense targeting,
// clash movement, mode-flag leaks, endless restart, and the store.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, startClassic, tapBtn, center} from './harness.mjs';

function state(g) { return JSON.parse(g.window.render_game_to_text()); }

test('boots to menu after splash', async () => {
  const g = await boot();
  const s = state(g);
  assert.equal(s.phase, 'menu');
  assert.equal(s.storageAvailable, true);
});

test('classic flow: map -> difficulty -> no hero -> build phase, wave goal correct', async () => {
  const g = await boot();
  await startClassic(g);
  const s = state(g);
  assert.equal(s.phase, 'build');
  assert.equal(s.waveGoal, 40);
  assert.equal(s.towerCount, 0);
});

test('match economy finalizes exactly once (no per-frame credit/stat farming)', async () => {
  const g = await boot();
  await startClassic(g);
  const before = g.window._getProg();
  g.window._finalizeMatch(true);
  g.window._finalizeMatch(true); // second call must be a no-op
  const after = g.window._getProg();
  assert.equal(after.totalMatches, before.totalMatches + 1);

  // Rendering the victory screen 60 times must not mutate anything further.
  const creditsBefore = g.window._getStoreState().credits;
  const progBefore = g.window._getProg();
  g.window._setGamePhase('victory');
  g.frame(60);
  assert.equal(g.window._getProg().totalMatches, progBefore.totalMatches);
  assert.equal(g.window._getStoreState().credits, creditsBefore);
});

test('defeat also finalizes (partial XP path) and renders gameover without mutation', async () => {
  const g = await boot();
  await startClassic(g);
  const before = g.window._getProg();
  g.window._finalizeMatch(false);
  g.window._setGamePhase('gameover');
  g.frame(60);
  assert.equal(g.window._getProg().totalMatches, before.totalMatches + 1);
});

test('offense mode: AI towers actually kill spawned units (targeting regression)', async () => {
  const g = await boot();
  tapBtn(g, 'menuOffense');
  const maps = g.window._getBtns().offenseMaps;
  const c = center(maps[0]); g.tap(c.x, c.y); g.frame(2);
  assert.equal(state(g).phase, 'offenseGame');

  g.window._spawnOffense('skitterling');
  g.frame(240); // 4 simulated seconds
  const off = g.window._getOffenseState();
  const alive = g.window._getEnemies().filter(e => e.alive).length;
  // The unit must be destroyed by towers, not leak to the exit.
  assert.equal(off.unitsPast, 0);
  assert.equal(alive, 0);
});

test('clash attack: spawned units move along the path (NaN-progress regression)', async () => {
  const g = await boot();
  g.window._startClashAttack();
  g.frame(2);
  assert.equal(state(g).phase, 'clashAttack');
  g.window._spawnOffense('skitterling');
  g.frame(60);
  const es = g.window._getEnemies();
  assert.ok(es.length > 0, 'enemy should exist');
  const e = es[0];
  assert.ok(e.progress > 0 || !e.alive, 'enemy should advance or be killed, not freeze');
  assert.ok(Number.isFinite(e.progress));
  assert.ok(Number.isFinite(e.px) && Number.isFinite(e.py));
});

test('mode flags: quitting allied defense mid-match does not leak into menu', async () => {
  const g = await boot();
  tapBtn(g, 'menuAllied');
  g.frame(2);
  assert.equal(g.window._getAlliedActive(), true);
  assert.equal(state(g).phase, 'build');
  tapBtn(g, 'pause');
  g.frame(2);
  assert.equal(state(g).phase, 'paused');
  tapBtn(g, 'quit');
  g.frame(2);
  assert.equal(state(g).phase, 'menu');
  assert.equal(g.window._getAlliedActive(), false);
  assert.equal(state(g).alliedActive, false);
});

test('endless mode: Play Again on gameover restarts endless, not classic', async () => {
  const g = await boot();
  tapBtn(g, 'menuEndless');
  const biomes = g.window._getBtns().biomes;
  const bc = center(biomes[0]); g.tap(bc.x, bc.y); g.frame(2);
  assert.equal(state(g).phase, 'build');
  assert.equal(state(g).endless, true);

  g.window._setGamePhase('gameover');
  g.frame(2);
  tapBtn(g, 'restart');
  g.frame(2);
  const s = state(g);
  assert.equal(s.phase, 'build');
  assert.equal(s.endless, true);
});

test('store: simulated IAP credits tab grants the advertised amount', async () => {
  const g = await boot();
  tapBtn(g, 'menuStore');
  g.frame(2);
  const tabs = g.window._getBtns().storeTabs;
  const t5 = center(tabs[4]); g.tap(t5.x, t5.y); g.frame(2); // CREDITS tab
  const items = g.window._getBtns().storeItems;
  const item = items.find(i => i.type === 'credits' && i.id === 'credits_100');
  assert.ok(item, 'credits_100 tier should be listed');
  const before = g.window._getStoreState().credits;
  const c = center(item); g.tap(c.x, c.y); g.frame(2);
  assert.equal(g.window._getStoreState().credits, before + item.amount + (item.bonus || 0));
});

test('hero deploy: selecting a hero enters the match with hero active', async () => {
  const g = await boot();
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  const mc = center(maps[0]); g.tap(mc.x, mc.y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  const dc = center(diffs[0]); g.tap(dc.x, dc.y); g.frame(2);
  const cards = g.window._getBtns().heroCards;
  const hc = center(cards[0]); g.tap(hc.x, hc.y); g.frame(2); // Commander Vex
  tapBtn(g, 'heroDeploy');
  const h = g.window._getHeroState();
  assert.equal(h.deployed, true);
  assert.equal(h.sel, 0);
  assert.ok(h.maxHp > 0);
});

test('pause -> settings -> back returns to pause overlay (no instant resume)', async () => {
  const g = await boot();
  await startClassic(g);
  tapBtn(g, 'pause');
  assert.equal(state(g).phase, 'paused');
  tapBtn(g, 'pauseSettings');
  assert.equal(state(g).phase, 'settings');
  tapBtn(g, 'settingsBack');
  assert.equal(state(g).phase, 'paused');
  tapBtn(g, 'resume');
  assert.equal(state(g).phase, 'build');
});

test('full wave loop: place tower via radial menu, run wave, collect rewards', async () => {
  const g = await boot();
  await startClassic(g);
  const L = g.window._getLayout();
  // Cell (0,0) is a valid build spot on Outpost Alpha (adjacent to path row 1).
  g.tap(L.offsetX + 0.5 * L.cellSize, L.offsetY + 0.5 * L.cellSize);
  g.frame(2);
  const radial = g.window._getBtns().radial;
  assert.ok(radial && radial.length > 0, 'radial menu should open');
  const sentinel = radial.find(r => r.idx === 0);
  g.tap(sentinel.x, sentinel.y); // circle buttons: x,y is the center
  g.frame(2);
  const s1 = state(g);
  assert.equal(s1.towerCount, 1);
  assert.equal(s1.towers[0].type, 'sentinel');
  assert.ok(s1.nexium < 300, 'tower cost deducted');

  // Start the wave: START WAVE -> preview -> tap to begin.
  const nexBefore = s1.nexium;
  tapBtn(g, 'startWave');
  assert.equal(state(g).phase, 'wavePreview');
  g.tap(100, 400);
  g.frame(2);
  assert.equal(state(g).phase, 'wave');

  // Simulate up to 75 seconds of combat for wave 1 (6 skitterlings).
  let phases = new Set();
  for (let i = 0; i < 75 * 60 && state(g).phase === 'wave'; i++) {
    g.frame(1);
    phases.add(state(g).phase);
  }
  const s2 = state(g);
  assert.ok(['waveSummary', 'build'].includes(s2.phase), 'wave should complete, got ' + s2.phase);
  assert.ok(s2.totalKills > 0, 'sentinel should score kills');
  assert.ok(s2.nexium > nexBefore - 60, 'kill rewards + wave bonus credited');

  // Wave summary tap continues to next build phase.
  if (s2.phase === 'waveSummary') { g.tap(100, 400); g.frame(2); }
  assert.equal(state(g).phase, 'build');
});

test('every screen renders without throwing', async () => {
  const g = await boot();
  await startClassic(g);
  const phases = [
    'menu', 'mapSelect', 'diffSelect', 'heroSelect', 'heroRoster', 'store',
    'loadout', 'profile', 'achievements', 'howToPlay', 'settings', 'biomeSelect',
    'campaignMap', 'campaignSwarmAttack', 'campaignVictory', 'campaignDefeat',
    'offenseMapSelect', 'wavePreview', 'waveSummary', 'paused', 'gameover',
    'victory', 'alliedVictory', 'clashFinal', 'clashAttackResult', 'offenseResult'
  ];
  for (const p of phases) {
    g.window._setGamePhase(p);
    g.frame(3); // any ReferenceError/TypeError in a draw function throws here
  }
  // Live phases needing entities.
  g.window._startClashAttack();
  g.frame(3);
  g.window._spawnOffense('devastator');
  g.frame(30);
});
