import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, startClassic, state, tapBtn} from './harness.mjs';

test('a backgrounded battle survives WebView recreation and resumes paused', async () => {
  const storage = new Map();
  const first = await boot({storage});
  await startClassic(first);

  first.evaluate(`
    G.wave = 6;
    G.nexium = 173;
    G.lives = 19;
    G.towers.push({col:2,row:2,typeIdx:0,level:1,cooldown:0.35,totalSpent:130,
      abilityCooldown:4,abilityActive:0,abilityUnlocked:true,overcharged:false,
      beamTarget:null,disabled:0,chainTargets:null,overloadNext:false,droneCount:3});
    ensureTowerDurability(G.towers[0]);
    G.phase = 'wave';
    G.spawnQueue = [{type:'skitterling',time:8,pathIdx:0}];
    G.spawnTimer = 3;
    spawnEnemy('ironshell', 0, 0.42);
    G.enemies[0].hp -= 17;
  `);
  const beforeEnemy = first.window._getEnemies()[0];

  first.setHidden(true);
  assert.equal(state(first).phase, 'paused', 'backgrounding should pause immediately');
  assert.ok(storage.has('sd_activeSession'), 'active battle checkpoint should be written');

  // A new game instance models iOS reclaiming and recreating the WKWebView.
  const restored = await boot({storage});
  const snapshot = state(restored);
  assert.equal(snapshot.phase, 'paused');
  assert.equal(snapshot.wave, 6);
  assert.equal(snapshot.nexium, 173);
  assert.equal(snapshot.lives, 19);
  assert.equal(snapshot.towerCount, 1);
  assert.equal(snapshot.towers[0].level, 1);
  assert.equal(snapshot.spawnQueueLength, 1);
  const restoredEnemy = restored.window._getEnemies()[0];
  assert.equal(restoredEnemy.type, 'ironshell');
  assert.equal(restoredEnemy.hp, beforeEnemy.hp);
  assert.ok(Math.abs(restoredEnemy.progress - beforeEnemy.progress) < 0.000001);

  tapBtn(restored, 'resume');
  assert.equal(state(restored).phase, 'wave', 'resume should return to the exact battle phase');
});

test('quitting a restored battle clears the resumable checkpoint', async () => {
  const storage = new Map();
  const first = await boot({storage});
  await startClassic(first);
  first.setHidden(true);

  const restored = await boot({storage});
  tapBtn(restored, 'quit');
  assert.equal(state(restored).phase, 'menu');
  assert.equal(storage.has('sd_activeSession'), false, 'an intentionally abandoned match must not return');
});

test('swarm offense restores its live economy and original phase', async () => {
  const storage = new Map();
  const first = await boot({storage});
  first.evaluate(`
    startOffenseGame(1);
    offense.bioMass = 88;
    offense.bioReserve = 121;
    offense.unitsPast = 3;
    offense.timeLeft = 47;
    spawnOffenseEnemy('venomspine');
    G.enemies[0].pathProgress = 0.31;
    G.enemies[0].progress = 0.31;
  `);
  first.setHidden(true);

  const restored = await boot({storage});
  const offense = restored.window._getOffenseState();
  assert.equal(state(restored).phase, 'paused');
  assert.equal(offense.active, true);
  assert.equal(offense.bioMass, 88);
  assert.equal(offense.bioReserve, 121);
  assert.equal(offense.unitsPast, 3);
  assert.equal(offense.timeLeft, 47);
  assert.ok(Math.abs(restored.window._getEnemies()[0].progress - 0.31) < 0.000001);

  tapBtn(restored, 'resume');
  assert.equal(state(restored).phase, 'offenseGame');
});

test('an invalid active-session checkpoint is discarded safely', async () => {
  const storage = new Map([
    ['sd_activeSession', JSON.stringify({
      version: 1,
      resumePhase: 'wave',
      game: {mapIdx: 0, towers: [], enemies: [], spawnQueue: []},
      paths: [[['bad', 0]]],
      cols: 10,
      rows: 16
    })]
  ]);
  const game = await boot({storage});
  assert.equal(state(game).phase, 'menu');
  assert.equal(storage.has('sd_activeSession'), false);
});
