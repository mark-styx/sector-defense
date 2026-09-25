// Balance soak tests: proves the game is winnable end-to-end.
// A scripted bot plays Classic through all 40 waves on every unlocked
// difficulty using real tap events only (radial placement, upgrades, wave
// start), and a second bot assaults a Swarm Commander fortress.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, startClassic, tapBtn, center, makePlanBot, makeGenericBot, runBotWave} from './harness.mjs';

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
  const creditsBefore = g.window._getStoreState().credits;
  const {final, log} = await runClassicCampaign(g);
  assert.equal(final.phase, 'victory', `did not win\n${log.join('\n')}`);
  assert.ok(final.lives > 0);
  // Victory must actually pay out: achievements + Helix credits (match + stars).
  assert.ok(final.achievementsCount >= 1, 'first_blood should unlock on first win');
  assert.ok(g.window._getStoreState().credits > creditsBefore,
    `victory should award credits (before=${creditsBefore}, after=${g.window._getStoreState().credits})`);
});

test('hero run: Commander Vex wins Standard and gains persistent XP', async () => {
  const g = await boot();
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  const mc = center(maps[0]); g.tap(mc.x, mc.y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  const dc = center(diffs[0]); g.tap(dc.x, dc.y); g.frame(2);
  const cards = g.window._getBtns().heroCards;
  const hc = center(cards[0]); g.tap(hc.x, hc.y); g.frame(2); // Commander Vex
  tapBtn(g, 'heroDeploy');
  assert.equal(state(g).phase, 'build');
  const xpBefore = g.window._getHeroProg('vanguard').xp;

  g.window._setGameState('gameSpeed', 3);
  const bot = makePlanBot(g, PLAN);
  const log = [];
  for (let w = 1; w <= 40; w++) {
    if (state(g).phase !== 'build') break;
    bot.play();
    const post = runBotWave(g, 180);
    log.push(`w${w} lives=${post.lives}`);
    if (post.phase !== 'build') break;
  }
  const final = state(g);
  assert.equal(final.phase, 'victory', `hero run not won\n${log.join('\n')}`);
  const vex = g.window._getHeroProg('vanguard');
  assert.ok(vex.xp > xpBefore, `hero should gain persistent XP (before=${xpBefore}, after=${vex.xp})`);
  assert.ok(vex.matchesPlayed >= 1, 'hero match should be recorded');
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

test('hard-rated maps are winnable: 3-path, long spiral, restricted (Standard)', async () => {
  // Map 3 = War Room (3 converging entries), 6 = Inferno (long spiral),
  // 9 = Absolute Zero (fusion restricted, 14x20). Generic bot with
  // chokepoint/convergence placement must clear all three on Standard.
  for (const mapIdx of [3, 6, 9]) {
    const g = await boot();
    tapBtn(g, 'menuPlay');
    let maps = g.window._getBtns().maps;
    let target = maps.find(m => m.origIdx === mapIdx);
    if (!target) {
      const tabs = g.window._getBtns().biomeTabs;
      for (let i = 1; i < 3 && !target; i++) {
        const t = tabs[i]; g.tap(center(t).x, center(t).y); g.frame(2);
        target = g.window._getBtns().maps.find(m => m.origIdx === mapIdx);
      }
    }
    const mc = center(target); g.tap(mc.x, mc.y); g.frame(2);
    const diffs = g.window._getBtns().diffs;
    const d = diffs.find(x => x.idx === 0);
    const dc = center(d); g.tap(dc.x, dc.y); g.frame(2);
    tapBtn(g, 'heroNone');
    tapBtn(g, 'heroDeploy');
    g.window._setGameState('gameSpeed', 3);
    const bot = makeGenericBot(g, 14);
    let last = null;
    for (let w = 1; w <= 40; w++) {
      if (state(g).phase !== 'build') break;
      bot.play();
      last = runBotWave(g, 300);
      if (last.phase !== 'build') break;
    }
    assert.equal(last.phase, 'victory', `map ${mapIdx} not beaten on Standard (ended ${last.phase} wave ${last.wave})`);
    assert.ok(last.lives > 0);
  }
});

test('the gauntlet combo is winnable: Inferno on Elite', async () => {
  // Mirrors the 'the_gauntlet' achievement — Hard map at the hardest
  // unlocked difficulty must be beatable with strong play.
  const g = await boot();
  tapBtn(g, 'menuPlay');
  let target = g.window._getBtns().maps.find(m => m.origIdx === 6);
  if (!target) {
    const tabs = g.window._getBtns().biomeTabs;
    const t = tabs[1]; g.tap(center(t).x, center(t).y); g.frame(2); // volcanic
    target = g.window._getBtns().maps.find(m => m.origIdx === 6);
  }
  const mc = center(target); g.tap(mc.x, mc.y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  const d = diffs.find(x => x.idx === 2);
  const dc = center(d); g.tap(dc.x, dc.y); g.frame(2);
  tapBtn(g, 'heroNone');
  tapBtn(g, 'heroDeploy');
  g.window._setGameState('gameSpeed', 3);
  const bot = makeGenericBot(g, 14);
  let last = null;
  for (let w = 1; w <= 40; w++) {
    if (state(g).phase !== 'build') break;
    bot.play();
    last = runBotWave(g, 300);
    if (last.phase !== 'build') break;
  }
  assert.equal(last.phase, 'victory', `Inferno/Elite not beaten (ended ${last.phase} wave ${last.wave})`);
  assert.ok(last.lives > 0);
});

test('swarm commander: every assault map is winnable', async () => {
  for (const mapIdx of [0, 1, 2, 3, 4]) {
    const g = await boot();
    tapBtn(g, 'menuOffense');
    const maps = g.window._getBtns().offenseMaps;
    const mc = center(maps[mapIdx]); g.tap(mc.x, mc.y); g.frame(2);
    assert.equal(state(g).phase, 'offenseGame');
    g.window._setGameState('gameSpeed', 3);
    const startBio = g.window._getOffenseState().bioMass;
    // Strategy scales with budget: rich maps break entry camps with sustained
    // devastator tanks; modest budgets stream venomspine.
    const tankAt = startBio >= 300 ? 45 : 200;
    const capSec = 120;
    let frames = 0;
    while (frames++ < capSec * 60) {
      const off = g.window._getOffenseState();
      if (off.unitsPast >= off.goalUnits) break;
      const abs = g.window._getBtns().swarmAbilities || [];
      const alive = g.window._getEnemies().filter(e => e.alive).length;
      const tapAb = type => {
        const b = abs.find(a => a.type === type);
        if (b) { g.tap(b.x + b.w / 2, b.y + b.h / 2); g.frame(1); }
      };
      if (alive >= 8) tapAb('armor');
      tapAb('tunnel');
      const spawn = g.window._getBtns().offenseSpawn;
      if (spawn && spawn.length) {
        let pick = null;
        if (off.bioMass >= tankAt) pick = spawn.find(b => b.idx === 4);
        else if (off.bioMass >= 10) pick = spawn.find(b => b.idx === 1);
        else pick = spawn.find(b => b.idx === 0);
        if (pick) { const c = center(pick); g.tap(c.x, c.y); }
      }
      g.frame(1);
    }
    const off = g.window._getOffenseState();
    assert.ok(off.unitsPast >= off.goalUnits,
      `assault map ${mapIdx} (${maps[mapIdx].name}) failed: ${off.unitsPast}/${off.goalUnits}`);
  }
});
