// ROUND 39: damage-driven economy + impact FX + swarm progress income.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, loadGame, startClassic, tapBtn, center, state} from './harness.mjs';

async function placeSentinelAndStart(g) {
  const L = g.window._getLayout();
  g.tap(L.offsetX + 3.5 * L.cellSize, L.offsetY + 2.5 * L.cellSize); g.frame(2);
  const radial = g.window._getBtns().radial;
  const sentinel = radial.find(r => r.idx === 0);
  g.tap(sentinel.x, sentinel.y); g.frame(2);
  for (let i = 0; i < 100; i++) g.frame(1); // finish Rapid-Deploy spin-up
  tapBtn(g, 'startWave');
  g.tap(195, 422); g.frame(2);
  assert.equal(state(g).phase, 'wave');
}

test('nexium flows from damage before any kill lands', async () => {
  const g = await boot();
  await startClassic(g);
  await placeSentinelAndStart(g);
  // Watch until the first hit lands but no kill yet (sentinel 8 dmg vs 35hp
  // skitterlings: the first 4 hits damage without killing).
  let sawDamageIncome = false;
  for (let i = 0; i < 60 * 20 && state(g).phase === 'wave'; i++) {
    g.frame(1);
    const eco = g.window._getEconomy();
    const s = state(g);
    if (s.totalKills === 0 && eco.earned > 0.01) { sawDamageIncome = true; break; }
  }
  assert.ok(sawDamageIncome, 'income should accrue from damage with zero kills');
});

test('wave completion adds no flat time bonus', async () => {
  const g = await boot();
  await startClassic(g);
  await placeSentinelAndStart(g);
  // The frame that flips the phase contains the final kill's legitimate
  // income — a flat bonus would surface on the frames AFTER the flip.
  let flipFrame = -1, earnedAtFlip = 0;
  for (let i = 0; i < 60 * 120; i++) {
    g.frame(1);
    const s = state(g);
    if (flipFrame < 0 && ['waveSummary', 'build', 'victory'].includes(s.phase)) {
      flipFrame = i; earnedAtFlip = g.window._getEconomy().earned; continue;
    }
    if (flipFrame >= 0 && i >= flipFrame + 3) {
      const after = g.window._getEconomy().earned;
      assert.ok(after <= earnedAtFlip + 0.01,
        `phase change credited a time bonus (+${(after - earnedAtFlip).toFixed(2)})`);
      return;
    }
  }
  assert.fail('wave never completed');
});

test('per-enemy damage credit is capped (no stall farming)', async () => {
  const g = await boot();
  await startClassic(g);
  await placeSentinelAndStart(g);
  // Wait for the first enemy to spawn, then hammer the award hook directly
  // with absurd damage — credited must stop at maxHp * 1.25.
  let id = -1;
  for (let i = 0; i < 120 && id < 0; i++) { g.frame(1); const e = g.window._getEnemies()[0]; if (e) id = e.id; }
  assert.ok(id >= 0, 'enemy should spawn');
  const eco0 = g.window._getEconomy().earned;
  for (let k = 0; k < 20; k++) g.window._awardNexiumForDamage(id, 99999);
  const e = g.window._getDamageEconomy().credited.find(x => x.id === id);
  assert.ok(e.credited <= e.maxHp * 1.25 + 0.01, `credit ${e.credited} exceeds cap ${e.maxHp * 1.25}`);
  const eco1 = g.window._getEconomy().earned;
  const d = DIFFS0(), expectMax = e.maxHp * 1.25 * 0.30 * (d.rewM / d.hpM);
  assert.ok(eco1 - eco0 <= expectMax + 1, `nexium gain ${(eco1 - eco0).toFixed(1)} exceeds theoretical max ${expectMax.toFixed(1)}`);
});
function DIFFS0() { return {rewM: 1.0, hpM: 1.22}; } // Standard

test('nexium extractor card boosts damage income by 20%', async () => {
  const g = await loadGame({
    seed: {loadout: {unlockedCards: ['nexium_generator'], equippedCards: ['nexium_generator'],
                     unlockedSkins: {}, equippedSkins: {}, matchCount: 0}}
  }).ready();
  g.frame(170);
  await startClassic(g);
  // 300 start (no deep pockets), -50 sentinel, +78 damage income (1.2x,
  // hpM-normalized; sentinel's urban +10% DMG finishes kills faster),
  // +6 kill kickers -> 334.
  await placeSentinelAndStart(g);
  for (let i = 0; i < 60 * 180 && state(g).phase === 'wave'; i++) g.frame(1);
  if (state(g).phase === 'waveSummary') { g.tap(195, 422); g.frame(2); }
  assert.equal(state(g).nexium, 334, 'extractor: 20% more damage income, no time bonus');
});

test('impact FX spawn when projectiles land', async () => {
  const g = await boot();
  await startClassic(g);
  await placeSentinelAndStart(g);
  let sawImpact = false;
  for (let i = 0; i < 60 * 20 && state(g).phase === 'wave'; i++) {
    g.frame(1);
    if (g.window._getVfxCounts().impacts > 0) { sawImpact = true; break; }
  }
  assert.ok(sawImpact, 'VFX.impacts should populate during combat');
});

test('swarm: bio income scales with lane progress, not just time', async () => {
  const g = await boot();
  tapBtn(g, 'menuOffense');
  const maps = g.window._getBtns().offenseMaps;
  g.tap(center(maps[0]).x, center(maps[0]).y); g.frame(2);
  assert.equal(state(g).phase, 'offenseGame');
  // Idle rate = pure trickle.
  const b0 = g.window._getOffenseState().bioMass;
  for (let i = 0; i < 60; i++) g.frame(1);
  const idleRate = (g.window._getOffenseState().bioMass - b0) / 60;
  // Walk rate = trickle + progress drip (devastator survives map-0 towers).
  g.window._spawnOffense('devastator');
  g.frame(2);
  const b1 = g.window._getOffenseState().bioMass;
  for (let i = 0; i < 60; i++) g.frame(1);
  const walkRate = (g.window._getOffenseState().bioMass - b1) / 60;
  assert.ok(idleRate > 0 && idleRate < 0.06, `idle trickle sane (${idleRate.toFixed(4)}/frame)`);
  // Progress is intentionally a modest recovery now: a complete breach
  // returns 80% total, so it must beat idle income without minting bio.
  assert.ok(walkRate > idleRate + 0.002,
    `walking unit must beat idle income (${walkRate.toFixed(4)} vs ${idleRate.toFixed(4)})`);
});
