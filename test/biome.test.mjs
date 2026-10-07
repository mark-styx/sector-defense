// Biome depth: environment events (arctic blizzard/avalanche, volcanic
// overheat), tower environment affinities, biome-native enemy variants,
// and the Elite-victory Legendary unlock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, startClassic, tapBtn, center, state} from './harness.mjs';

// Frozen Reach (mapIdx 7) — arctic; Ember Pass (4) — volcanic; Outpost (0) — urban.
const startOn = (g, mapIdx, diffIdx = 0) =>
  g.evaluate(`G.mapIdx=${mapIdx};G.diffIdx=${diffIdx};startGame();G.phase='build';`);

test('legendary unlocks for every map after any Elite victory', async () => {
  const g = await boot();
  await startClassic(g); // Standard outpost build phase, level-1 save
  assert.equal(state(g).phase, 'build');
  // Simulate the elite win: finalizeMatch on elite difficulty.
  g.evaluate(`G.diffIdx=2;finalizeMatch(true)`);
  assert.equal(g.evaluate('prog.eliteCleared'), true, 'elite win should set the flag');
  // Diff select must now list Legendary (idx 3) as tappable.
  tapBtn(g, 'pause'); tapBtn(g, 'quit'); g.frame(2);
  tapBtn(g, 'menuPlay'); g.frame(2);
  const maps = g.window._getBtns().maps;
  g.tap(center(maps[0]).x, center(maps[0]).y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  assert.ok(diffs.some(d => d.idx === 3), 'legendary should be selectable after elite win');
});

test('legendary stays locked without an elite win or level 20', async () => {
  const g = await boot();
  await startClassic(g);
  assert.equal(g.evaluate('prog.eliteCleared'), false);
  tapBtn(g, 'pause'); tapBtn(g, 'quit'); g.frame(2);
  tapBtn(g, 'menuPlay'); g.frame(2);
  const maps = g.window._getBtns().maps;
  g.tap(center(maps[0]).x, center(maps[0]).y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  assert.ok(!diffs.some(d => d.idx === 3), 'legendary must stay locked at level 1');
});

test('arctic maps field frosthoppers, volcanic cinderlings, urban stays stock', async () => {
  const g = await boot();
  await startOn(g, 7); // frozen
  g.evaluate(`spawnEnemy('skitterling',0)`);
  let e = g.evaluate('G.enemies[G.enemies.length-1]');
  assert.equal(e.type, 'frosthopper', 'arctic swaps skitterling → frosthopper');
  assert.equal(e.hp, Math.round(38 * DIFFS_HP), 'frosthopper carries its own HP');
  g.evaluate(`spawnEnemy('ironshell',0)`);
  e = g.evaluate('G.enemies[G.enemies.length-1]');
  assert.equal(e.type, 'glacierhide', 'arctic swaps ironshell → glacierhide');
  assert.equal(e.armor, 8, 'glacierhide is the armored variant');

  await startOn(g, 4); // ember
  g.evaluate(`spawnEnemy('skitterling',0)`);
  e = g.evaluate('G.enemies[G.enemies.length-1]');
  assert.equal(e.type, 'cinderling', 'volcanic swaps skitterling → cinderling');
  g.evaluate(`spawnEnemy('blisterbomb',0)`);
  e = g.evaluate('G.enemies[G.enemies.length-1]');
  assert.equal(e.type, 'magmabomb', 'volcanic swaps blisterbomb → magmabomb');
  assert.equal(e.explodes, true, 'magmabomb keeps the explodes flag');

  await startOn(g, 0); // outpost, urban
  g.evaluate(`spawnEnemy('skitterling',0)`);
  e = g.evaluate('G.enemies[G.enemies.length-1]');
  assert.equal(e.type, 'skitterling', 'urban maps keep stock enemies');
});
const DIFFS_HP = 1.42; // Standard hpM — keep in sync with DIFFS[0]

test('tower affinities apply per biome (and only to player towers)', async () => {
  const g = await boot();
  await startOn(g, 7); // arctic: fusion +20% dmg
  g.evaluate(`G.nexium=1000;placeTower(3,3,6)`); // fusion
  let dmg = g.evaluate('getTowerStats(G.towers[0]).damage');
  assert.equal(dmg, Math.round(50 * 1.2), 'fusion +20% damage on arctic');
  g.evaluate(`G.nexium=1000;placeTower(1,6,2)`);
  let rng = g.evaluate('getTowerStats(G.towers[G.towers.length-1]).range');
  assert.ok(Math.abs(rng - 4) < 0.01, 'hawk keeps stock range on arctic (' + rng + ')');

  await startOn(g, 0); // urban: sentinel +10% dmg, hawk +10% range
  g.evaluate(`G.nexium=1000;placeTower(3,2,0)`);
  dmg = g.evaluate('getTowerStats(G.towers[0]).damage');
  assert.equal(dmg, Math.round(8 * 1.1), 'sentinel +10% damage on urban');
  g.evaluate(`G.nexium=1000;placeTower(5,2,2)`);
  rng = g.evaluate('getTowerStats(G.towers[G.towers.length-1]).range');
  assert.ok(Math.abs(rng - 4.4) < 0.01, 'hawk +10% range on urban (' + rng + ')');

  await startOn(g, 4); // volcanic: thunder -8% dmg
  g.evaluate(`G.nexium=1000;placeTower(5,2,1)`);
  dmg = g.evaluate('getTowerStats(G.towers[0]).damage');
  assert.equal(dmg, Math.round(40 * 0.92), 'thunder -8% damage on volcanic');
});

test('blizzard freezes a bounded set of towers, repair clears it', async () => {
  const g = await boot();
  await startOn(g, 7);
  g.evaluate(`G.nexium=5000;placeTower(3,3,0);placeTower(5,3,0);placeTower(3,6,0);placeTower(7,12,0)`);
  const before = g.evaluate('G.towers.length');
  g.evaluate(`envState.blizzardBudget=3;triggerBlizzard()`);
  const frozen = g.evaluate('G.towers.filter(t=>t.frozen>0).length');
  assert.equal(frozen, 3, 'blizzard freezes exactly the budgeted count');
  assert.ok(g.evaluate('G.towers.every(t=>t.disabled>0===true)') === false, 'not every tower need freeze');
  const anyFrozen = g.evaluate('G.towers.some(t=>t.disabled>0&&t.frozen>0)');
  assert.ok(anyFrozen, 'frozen towers are disabled');
  g.evaluate('repairTowersAfterWave()');
  assert.equal(g.evaluate('G.towers.some(t=>t.frozen>0||t.disabled>0)'), false,
    'post-wave repair clears freeze state');
  assert.equal(g.evaluate('G.towers.length'), before, 'blizzard destroys nothing');
});

test('avalanche buries towers permanently and scars tiles unbuildable', async () => {
  const g = await boot();
  await startOn(g, 7);
  g.evaluate(`G.nexium=5000;placeTower(3,3,0);placeTower(3,4,0)`);
  assert.equal(g.evaluate('G.towers.length'), 2);
  // Deterministic targeted avalanche down column 3 starting at row 3.
  g.evaluate(`triggerAvalanche(3,3)`);
  assert.equal(g.evaluate('G.towers.length'), 0, 'both towers in the slide path buried');
  assert.deepEqual(JSON.parse(g.evaluate('JSON.stringify(envState.scarredCells)')), ['3,3', '3,4']);
  assert.equal(g.evaluate('isValidPlacement(3,3)'), false, 'scarred tile is unbuildable');
  assert.equal(g.evaluate('isValidPlacement(3,4)'), false);
  assert.equal(g.evaluate(`placeTower(3,3,0)`), false, 'placement rejected on scar');
  // One avalanche per match: a second trigger must be a no-op via the guard.
  g.evaluate(`envState.avalancheAt=0;startWave();G.spawnTimer=99;`);
  g.frame(2);
  assert.equal(g.evaluate('envState.avalancheDone'), true, 'avalanche once per match');
  assert.equal(g.evaluate('envState.scarredCells.length'), 2, 'no second scarring');
});

test('volcanic heat: magma-adjacent towers overheat and sit out, then cool', async () => {
  const g = await boot();
  await startOn(g, 4); // ember, lava at [6,1] etc
  // (5,2) is buildable (path neighbor) and chebyshev-1 from lava (6,1).
  g.evaluate(`G.nexium=5000;placeTower(5,2,0)`);
  g.evaluate(`G.wave=0;startWave();G.spawnQueue=[{type:'skitterling',time:9999,pathIdx:0}]`);
  g.frame(120); // 2s of wave time: heat ~14
  const heat2s = g.evaluate('G.towers[0].heat');
  assert.ok(heat2s > 10 && heat2s < 25, 'heat accrues near magma (~7/s): ' + heat2s);
  // Fast-forward to overheat.
  let sawDisabled = false;
  for (let i = 0; i < 1200 && !sawDisabled; i++) { g.frame(1); if (g.evaluate('G.towers[0].disabled>0')) sawDisabled = true; }
  assert.ok(sawDisabled, 'magma-adjacent tower must overheat within ~17s of wave time');
  assert.ok(g.evaluate('G.towers[0].overheated>0'), 'overheat flag set for the tint');
  // Build phase cools heat to zero.
  g.evaluate(`G.phase='build';G.enemies=[];G.spawnQueue=[]`);
  g.frame(60);
  assert.equal(g.evaluate('G.towers[0].heat'), 0, 'heat cools out of wave');
});

test('urban maps schedule no environment events', async () => {
  const g = await boot();
  await startOn(g, 0);
  g.evaluate(`G.wave=5;scheduleEnvEvents()`);
  assert.equal(g.evaluate('envState.blizzardAt'), -1);
  assert.equal(g.evaluate('envState.avalancheAt'), -1);
  // Arctic wave 15 arms events with high probability across repeat draws —
  // 40 independent schedules with neither armed is ~1e-8.
  await startOn(g, 7);
  let armed = g.evaluate(`let hit=0;for(let i=0;i<40;i++){G.wave=15;scheduleEnvEvents();if(envState.blizzardAt>=0||envState.avalancheAt>=0)hit++;}hit`);
  assert.ok(armed > 0, 'arctic scheduling must arm sometimes (armed ' + armed + '/40)');
});
