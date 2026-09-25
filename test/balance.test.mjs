// Balance soak tests: proves the game is winnable end-to-end.
// A scripted bot plays Classic through all 40 waves on every unlocked
// difficulty using real tap events only (radial placement, upgrades, wave
// start), and a second bot assaults a Swarm Commander fortress.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, startClassic, tapBtn, center, makePlanBot, runBotWave} from './harness.mjs';

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

async function startTier(g, diffIdx) {
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  const mc = center(maps[0]); g.tap(mc.x, mc.y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  const target = diffs.find(d => d.idx === diffIdx);
  const dc = center(target); g.tap(dc.x, dc.y); g.frame(2);
  tapBtn(g, 'heroNone');
  tapBtn(g, 'heroDeploy');
}

async function runClassicCampaign(g) {
  g.window._setGameState('gameSpeed', 3); // sim-time only; combat math unchanged
  const bot = makePlanBot(g, PLAN);
  const log = [];
  for (let w = 1; w <= 40; w++) {
    const pre = state(g);
    assert.equal(pre.phase, 'build', 'should be in build before wave ' + w);
    bot.play();
    const post = runBotWave(g, 180);
    log.push(`w${w} lives=${post.lives} nex=${Math.floor(post.nexium)} kills=${post.totalKills} towers=${post.towerCount}`);
    if (post.phase === 'victory') break;
    assert.equal(post.phase, 'build', `bot stalled after wave ${w}\n${log.join('\n')}`);
    assert.ok(post.lives > 0, `bot lost at wave ${w}\n${log.join('\n')}`);
  }
  return {final: state(g), log};
}

test('classic Standard is winnable: bot clears all 40 waves', async () => {
  const g = await boot();
  await startClassic(g);
  const {final, log} = await runClassicCampaign(g);
  assert.equal(final.phase, 'victory', `did not win\n${log.join('\n')}`);
  assert.ok(final.lives > 0);
});

test('classic Veteran is winnable', async () => {
  const g = await boot();
  await startTier(g, 1);
  const {final, log} = await runClassicCampaign(g);
  assert.equal(final.phase, 'victory', `Veteran not beaten\n${log.join('\n')}`);
  assert.ok(final.lives > 0);
});

test('classic Elite is winnable', async () => {
  const g = await boot();
  await startTier(g, 2);
  const {final, log} = await runClassicCampaign(g);
  assert.equal(final.phase, 'victory', `Elite not beaten\n${log.join('\n')}`);
  assert.ok(final.lives > 0);
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
