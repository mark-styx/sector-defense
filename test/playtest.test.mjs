// Regression tests for the first live-device playtest feedback round:
//  - achievement toasts stuck at the top of the screen (never expired
//    outside combat phases)
//  - no way to leave Swarm Commander / Sector Clash attack mid-match
//  - pause hitbox too small; pause dead during wavePreview/waveSummary
//  - credit system opaque: no itemized breakdown on result screens
//  - mode briefings shown once per mode and persisted
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame, boot, startClassic, tapBtn, center} from './harness.mjs';

function state(g) { return JSON.parse(g.window.render_game_to_text()); }

test('toasts expire on menu and result screens (playtest: "stuck to the top")', async () => {
  const g = await boot();
  await startClassic(g);
  g.window._finalizeMatch(false); // defeat: credit toast fires at match end
  g.window._setGameState('phase', 'gameover'); g.frame(1);
  const during = g.window._getToastCount();
  assert.ok(during >= 1, 'credit toast fired at match end');
  // Advance ~4.3s of frames while sitting on the gameover screen.
  for (let i = 0; i < 260; i++) g.frame(1);
  assert.equal(g.window._getToastCount(), 0, 'toasts must expire on result screens');
  // Same on the menu screen (achievement popups land there too).
  g.window._setGameState('phase', 'menu'); g.frame(1);
  g.window._finalizeMatch; // no-op reference
  g.window._addCredits(0);
  assert.equal(g.window._getToastCount(), 0);
});

test('pause button is a real touch target and pauses wavePreview/waveSummary', async () => {
  const g = await boot();
  await startClassic(g);
  let b = g.window._getBtns();
  assert.ok(b.pause && b.pause.w >= 44 && b.pause.h >= 44, 'pause hitbox >= 44x44');

  // waveSummary: pause must not be swallowed by the tap-anywhere advance.
  g.window._setGameState('phase', 'waveSummary'); g.frame(1);
  b = g.window._getBtns();
  const pc = center(b.pause);
  g.tap(pc.x, pc.y); g.frame(2);
  assert.equal(state(g).phase, 'paused', 'pause works during waveSummary');
  tapBtn(g, 'resume'); g.frame(2);
  assert.equal(state(g).phase, 'waveSummary', 'resume returns to waveSummary');

  // wavePreview: tapping pause must not start the wave.
  g.window._setGameState('phase', 'wavePreview'); g.frame(1);
  b = g.window._getBtns();
  const pc2 = center(b.pause);
  g.tap(pc2.x, pc2.y); g.frame(2);
  assert.equal(state(g).phase, 'paused', 'pause works during wavePreview');
});

test('swarm commander: abandon button exits to menu via confirm modal', async () => {
  const g = await boot(); // briefings seeded seen by the harness
  tapBtn(g, 'menuOffense'); g.frame(2);
  assert.equal(state(g).phase, 'offenseMapSelect');
  const maps = g.window._getBtns().offenseMaps;
  const mc = center(maps[0]);
  g.tap(mc.x, mc.y); g.frame(2);
  assert.equal(state(g).phase, 'offenseGame');

  const bioBefore = g.window._getOffenseState().bioMass;
  const ex = g.window._getBtns().offenseExit;
  assert.ok(ex, 'offense HUD has an exit button');
  g.tap(center(ex).x, center(ex).y); g.frame(2);
  let m = g.window._getModal();
  assert.ok(m && m.title.startsWith('ABANDON ASSAULT'), 'confirm modal opens');
  // Modal freezes the simulation.
  for (let i = 0; i < 60; i++) g.frame(1);
  assert.equal(g.window._getOffenseState().bioMass, bioBefore, 'sim frozen behind modal');
  // KEEP PLAYING dismisses without consequences.
  const no = center(m.btns.no);
  g.tap(no.x, no.y); g.frame(2);
  assert.equal(state(g).phase, 'offenseGame');
  assert.equal(g.window._getModal(), null);
  // Abandon for real.
  g.tap(center(g.window._getBtns().offenseExit).x, center(g.window._getBtns().offenseExit).y); g.frame(2);
  const yes = center(g.window._getModal().btns.yes);
  g.tap(yes.x, yes.y); g.frame(2);
  assert.equal(state(g).phase, 'menu', 'abandon returns to menu');
  assert.equal(g.window._getOffenseState().active, false);
});

test('sector clash: attack phase can be forfeited (counts as loss)', async () => {
  const g = await boot();
  tapBtn(g, 'menuClash'); g.frame(2);
  assert.ok(state(g).clashActive, 'clash started');
  g.window._startClashAttack(); g.frame(2);
  assert.equal(state(g).phase, 'clashAttack');
  const eloBefore = state(g).clashElo;
  const ex = g.window._getBtns().clashExit;
  assert.ok(ex, 'clash attack HUD has an exit button');
  g.tap(center(ex).x, center(ex).y); g.frame(2);
  const m = g.window._getModal();
  assert.ok(m && m.title === 'FORFEIT MATCH?', 'forfeit confirm opens');
  const yes = center(m.btns.yes);
  g.tap(yes.x, yes.y); g.frame(2);
  assert.equal(state(g).phase, 'clashFinal', 'forfeit ends the clash');
  assert.ok(state(g).clashElo < eloBefore, 'forfeit costs Elo');
  // Final screen still exits cleanly.
  tapBtn(g, 'clashMenu'); g.frame(2);
  assert.equal(state(g).phase, 'menu');
});

test('mode briefings: shown once, skippable, persisted', async () => {
  const g = await loadGame({seed: {briefings: []}}).ready();
  g.frame(170); // skip splash
  tapBtn(g, 'menuPlay'); g.frame(2);
  let m = g.window._getModal();
  assert.ok(m && m.title === 'CLASSIC DEFENSE', 'briefing opens on first tap');
  // BACK closes it without starting or marking seen.
  const no = center(m.btns.no);
  g.tap(no.x, no.y); g.frame(2);
  assert.equal(state(g).phase, 'menu');
  assert.equal(g.window._getModal(), null);
  assert.equal(JSON.stringify(g.window._getBriefings()), '[]');
  // START marks it seen and proceeds.
  tapBtn(g, 'menuPlay'); g.frame(2);
  m = g.window._getModal();
  const yes = center(m.btns.yes);
  g.tap(yes.x, yes.y); g.frame(2);
  assert.equal(state(g).phase, 'mapSelect', 'briefing START enters mode');
  assert.ok(g.window._getBriefings().includes('menuPlay'), 'seen flag recorded');
  // Second entry goes straight through.
  g.window._setGameState('phase', 'menu'); g.frame(2);
  tapBtn(g, 'menuPlay'); g.frame(2);
  assert.equal(state(g).phase, 'mapSelect', 'no second briefing');
  assert.equal(g.window._getModal(), null);
});

test('result screens itemize helix credit earnings', async () => {
  const g = await boot();
  await startClassic(g);
  const creditsBefore = g.window._getStoreState().credits;
  g.window._setGameState('lives', 18); g.frame(1); // flawless: maxLives 18
  g.window._finalizeMatch(true);
  const log = g.window._getCreditLog();
  assert.ok(log.length >= 2, 'stars + match payout both logged');
  const total = log.reduce((s, c) => s + c.amount, 0);
  assert.equal(g.window._getStoreState().credits, creditsBefore + total,
    'log total matches credited amount');
  const reasons = log.map(c => c.reason).join('|');
  assert.match(reasons, /stars/);
  assert.match(reasons, /match victory/);
  // Victory screen renders without errors and shows the breakdown.
  g.window._setGameState('phase', 'victory'); g.frame(5);
  assert.equal(state(g).phase, 'victory');
});

test('standard difficulty no longer hands out 25 lives (playtest: "too easy")', async () => {
  const g = await boot();
  await startClassic(g);
  assert.equal(g.window._getLives(), 18, 'Standard starts with 18 lives');
  assert.equal(state(g).nexium, 300);
});
