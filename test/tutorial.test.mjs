// First-run experience: the guided tutorial walked end-to-end via real taps.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, tapBtn, center, state} from './harness.mjs';

const W = 390, H = 844;
function cellCenter(g, col, row) {
  const L = g.window._getLayout();
  return {x: L.offsetX + (col + 0.5) * L.cellSize, y: L.offsetY + (row + 0.5) * L.cellSize};
}
function radialPick(g, typeIdx) {
  const radial = g.window._getBtns().radial;
  assert.ok(radial && radial.length, 'radial menu should be open');
  const btn = radial.find(b => b.idx === typeIdx);
  assert.ok(btn, 'expected tower type in radial menu');
  g.tap(btn.x, btn.y);
  g.frame(2);
}
function runTutorialWave(g, maxSec = 120) {
  // Wave preview shows first (tap to begin), then the wave runs; the tutorial
  // auto-advances from the wave summary back to build.
  let sawWave = false;
  let f = 0;
  while (state(g).phase !== 'build' && f++ < maxSec * 60) {
    if (state(g).phase === 'wavePreview') { g.tap(W / 2, H / 2); g.frame(2); continue; }
    if (state(g).phase === 'wave') sawWave = true;
    g.frame(1);
  }
  g.frame(2);
  assert.ok(sawWave, 'wave should actually run');
}

test('tutorial: new player completes the full guided intro', async () => {
  const g = await boot();
  // Fresh save -> menu must surface the tutorial first.
  assert.ok(g.window._getBtns().menuTutorial, 'tutorial button should appear on fresh save');

  tapBtn(g, 'menuTutorial');
  assert.equal(state(g).phase, 'build');
  assert.equal(g.window._getProg().tutorialDone, false);

  // Step 0: tap a highlighted buildable cell -> radial opens.
  const c0 = cellCenter(g, 3, 2);
  g.tap(c0.x, c0.y); g.frame(2);
  // Step 1: forced SENTINEL pick.
  radialPick(g, 0);
  assert.equal(state(g).towerCount, 1, 'sentinel placed during tutorial');
  // Step 2: acknowledge.
  g.tap(W / 2, H / 2); g.frame(2);
  // Step 3: tap START WAVE.
  tapBtn(g, 'startWave');
  assert.equal(state(g).phase, 'wavePreview');
  // Step 4: run the wave to completion (auto-advances).
  runTutorialWave(g);
  assert.equal(state(g).phase, 'build');

  // Step 5: tap another highlighted cell.
  const c1 = cellCenter(g, 5, 2);
  g.tap(c1.x, c1.y); g.frame(2);
  // Step 6: forced THUNDER pick.
  radialPick(g, 1);
  assert.equal(state(g).towerCount, 2, 'thunder placed during tutorial');
  // Step 7: tap the first tower to open info.
  g.tap(c0.x, c0.y); g.frame(2);
  assert.equal(state(g).showTowerInfo, true, 'tower info should open');
  // Step 8: acknowledge (also closes the info panel so START WAVE returns).
  g.tap(W / 2, H / 2); g.frame(2);
  assert.equal(state(g).showTowerInfo, false, 'acknowledge should restore the build panel');
  assert.ok(g.window._getBtns().startWave, 'START WAVE button should be visible for step 9');
  // Step 9: start wave 2.
  tapBtn(g, 'startWave');
  // Step 10: run it.
  runTutorialWave(g);
  assert.equal(state(g).phase, 'build');
  // Steps 11-12: final acknowledges -> tutorial finishes.
  g.tap(W / 2, H / 2); g.frame(2);
  g.tap(W / 2, H / 2); g.frame(2);

  const prog = g.window._getProg();
  assert.equal(prog.tutorialDone, true, 'tutorial should be marked done');

  // Quit to menu: the tutorial entry must disappear.
  tapBtn(g, 'pause');
  tapBtn(g, 'quit');
  assert.equal(state(g).phase, 'menu');
  assert.ok(!g.window._getBtns().menuTutorial, 'tutorial button should be gone after completion');
});
