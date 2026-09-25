// Balance soak tests: proves the game is winnable end-to-end.
// A scripted bot plays Classic (Standard, map 0) through all 40 waves using
// real tap events only (radial menu placement, upgrades, wave start), and a
// second bot assaults a Swarm Commander fortress. If these fail, balance or
// mechanics regressed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, startClassic, tapBtn, center} from './harness.mjs';

const W = 390, H = 844;
const TT_COST = [50, 150, 100, 200, 300, 175, 250, 225, 275, 200];
// [col, row, towerTypeIdx] — hand-picked cells on Outpost Alpha that sit
// adjacent to path chokepoints (verified by the radial probe at runtime).
const PLAN = [
  [3, 2, 0], [5, 2, 0], [3, 3, 0], [5, 3, 0],   // sentinels over rows 1+4
  [1, 5, 0], [3, 6, 0],                          // sentinels over col-2 run
  [5, 8, 1],                                     // thunder over row 7
  [7, 8, 2], [7, 9, 2],                          // hawks over col-8 + row 10
  [3, 9, 1],                                     // thunder over row 10
  [6, 11, 2],                                    // hawk over rows 10/13
  [7, 12, 0],                                    // sentinel over row 13
  [7, 14, 5],                                    // shockwave over row 13 + exit run
  [6, 14, 1],                                    // thunder over row 13
  [2, 3, 4],                                     // nova over upper S-curve
  [4, 3, 7]                                      // arc tesla over upper S-curve
];

function state(g) { return JSON.parse(g.window.render_game_to_text()); }
function cellCenter(g, col, row) {
  const L = g.window._getLayout();
  return {x: L.offsetX + (col + 0.5) * L.cellSize, y: L.offsetY + (row + 0.5) * L.cellSize};
}

function tryPlace(g, col, row, typeIdx) {
  const before = state(g).towerCount;
  const c = cellCenter(g, col, row);
  g.tap(c.x, c.y); g.frame(2);
  const radial = g.window._getBtns().radial;
  if (!radial || !radial.length) return false;
  const btn = radial.find(b => b.idx === typeIdx);
  if (!btn) return false;
  g.tap(btn.x, btn.y); g.frame(2);
  return state(g).towerCount === before + 1;
}

function tryUpgrade(g, towerIdx) {
  const s = state(g);
  const t = s.towers[towerIdx];
  if (!t) return false;
  const c = cellCenter(g, t.col, t.row);
  g.tap(c.x, c.y); g.frame(2);
  let btns = g.window._getBtns();
  if (!btns.upgrade) {
    if (btns.closeInfo) { const cc = center(btns.closeInfo); g.tap(cc.x, cc.y); g.frame(1); }
    return false;
  }
  const uc = center(btns.upgrade);
  g.tap(uc.x, uc.y); g.frame(2);
  const ok = state(g).towers[towerIdx].level > t.level;
  btns = g.window._getBtns();
  if (btns.closeInfo) { const cc = center(btns.closeInfo); g.tap(cc.x, cc.y); g.frame(1); }
  return ok;
}

let planPtr = 0;
function playBuildPhase(g, log) {
  let acted = true;
  let guard = 0;
  while (acted && guard++ < 200) {
    acted = false;
    const s = state(g);
    // 1. Bring one tower to level 1 (cheap +40% dmg) before anything else.
    const l0 = s.towers.findIndex(t => t.level === 0);
    if (l0 >= 0 && s.nexium >= 40 && tryUpgrade(g, l0)) { acted = true; continue; }
    // 2. Place the next planned tower.
    if (planPtr < PLAN.length) {
      const [col, row, tp] = PLAN[planPtr];
      if (TT_COST[tp] <= s.nexium && tryPlace(g, col, row, tp)) {
        planPtr++; acted = true; continue;
      }
      // Probe once so an invalid cell never deadlocks the bot.
      if (TT_COST[tp] <= s.nexium) {
        const before = planPtr;
        if (!tryPlace(g, col, row, tp)) planPtr++;
        if (planPtr !== before) { acted = true; continue; }
      }
    }
    // 3. Spend surplus on level-2 upgrades.
    const l1 = s.towers.findIndex(t => t.level === 1);
    if (l1 >= 0 && s.nexium >= 70 && tryUpgrade(g, l1)) { acted = true; continue; }
  }
  void log;
}

function runWave(g, maxSec) {
  tapBtn(g, 'startWave');           // -> wavePreview
  g.tap(W / 2, H / 2); g.frame(2);  // -> wave
  let f = 0;
  while (state(g).phase === 'wave' && f++ < maxSec * 60) g.frame(1);
  const s = state(g);
  if (s.phase === 'waveSummary') { g.tap(W / 2, H / 2); g.frame(2); }
  return state(g);
}

test('classic Standard is winnable: bot clears all 40 waves', async () => {
  const g = await boot();
  await startClassic(g);
  g.window._setGameState('gameSpeed', 3); // sim-time only; combat math unchanged
  planPtr = 0;

  const log = [];
  for (let w = 1; w <= 40; w++) {
    const pre = state(g);
    assert.equal(pre.phase, 'build', 'should be in build before wave ' + w);
    playBuildPhase(g, log);
    const post = runWave(g, 180);
    log.push(`w${w} lives=${post.lives} nex=${Math.floor(post.nexium)} kills=${post.totalKills} towers=${post.towerCount}`);
    if (post.phase === 'victory') break;
    assert.equal(post.phase, 'build', `bot stalled after wave ${w}\n${log.join('\n')}`);
    assert.ok(post.lives > 0, `bot lost at wave ${w}\n${log.join('\n')}`);
  }
  const final = state(g);
  assert.equal(final.phase, 'victory', `did not win\n${log.join('\n')}`);
  assert.ok(final.lives > 0);
  // console.log(log.join('\n'));
});

test('swarm commander: fortress assault is winnable', async () => {
  const g = await boot();
  tapBtn(g, 'menuOffense');
  const maps = g.window._getBtns().offenseMaps;
  const mc = center(maps[0]); g.tap(mc.x, mc.y); g.frame(2);
  assert.equal(state(g).phase, 'offenseGame');

  const capSec = 120;
  let frames = 0;
  while (frames++ < capSec * 60) {
    const off = g.window._getOffenseState();
    if (off.unitsPast >= off.goalUnits) break;
    // Use bio-abilities like a player: tunnel (free units) on cooldown,
    // armor when a push is rolling, frenzy while flooding cheap units.
    const abs = (g.window._getBtns().swarmAbilities) || [];
    const tapAb = type => {
      const b = abs.find(a => a.type === type);
      if (b) { g.tap(b.x + b.w / 2, b.y + b.h / 2); g.frame(1); return true; }
      return false;
    };
    const alive = g.window._getEnemies().filter(e => e.alive).length;
    if (alive >= 8) tapAb('armor');
    tapAb('tunnel');
    if (alive >= 10) tapAb('frenzy');
    const spawn = g.window._getBtns().offenseSpawn;
    if (spawn && spawn.length) {
      // Armored pushes favor venomspine; otherwise skitterling flood.
      let pick = null;
      if (off.bioMass >= 10) pick = spawn.find(b => b.idx === 1);
      else pick = spawn.find(b => b.idx === 0);
      if (pick) { const c = center(pick); g.tap(c.x, c.y); }
    }
    g.frame(1);
  }
  const off = g.window._getOffenseState();
  assert.ok(off.unitsPast >= off.goalUnits,
    `assault failed: ${off.unitsPast}/${off.goalUnits} units past after ${capSec}s`);
});
