import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, startClassic, tryPlace} from './harness.mjs';

async function battle(heroIdx = 3) {
  const g = await boot();
  await startClassic(g);
  g.evaluate(`heroState.selectedHeroIdx=${heroIdx}; deployHero(0); heroState.manual=true;
    G.phase='wave'; G.spawnQueue=[{type:'skitterling',time:999,pathIdx:0}];`);
  return g;
}

function nearbyEnemy(g, type = 'skitterling') {
  return g.evaluate(`spawnEnemy('${type}',0); const foe=G.enemies.at(-1);
    foe.speed=0; foe.fadeIn=0;
    heroState.heroX=foe.px+cellSize*0.6; heroState.heroY=foe.py;
    heroState.heroTargetX=heroState.heroX; heroState.heroTargetY=heroState.heroY;
    foe.id;`);
}

test('hero HP changes on projectile contact, with a hit flash and damage number', async () => {
  const g = await battle();
  nearbyEnemy(g);
  const hp = g.window._getHeroState().hp;
  g.frame(1);
  assert.equal(g.window._getHeroState().hp, hp, 'launching an attack must not drain HP');
  assert.ok(g.evaluate('enemyProjectilePool.count()') > 0, 'a visible attack is in flight');
  for (let i=0; i<30 && g.window._getHeroState().hp===hp; i++) g.frame(1);
  assert.equal(g.window._getHeroState().hp, hp - 15, 'one unarmored hit lands');
  assert.ok(g.evaluate('heroState.hitFlash') > 0, 'hero flashes on contact');
  assert.ok(g.evaluate('dmgNumPool.count()') > 0, 'impact shows its damage');
});

test('point-blank attacks stay visible before impact and cannot hit a redeployed hero', async () => {
  const g = await battle();
  nearbyEnemy(g);
  g.evaluate('heroState.heroX=G.enemies[0].px; heroState.heroTargetX=heroState.heroX;');
  const hp = g.window._getHeroState().hp;
  g.frame(5);
  assert.equal(g.window._getHeroState().hp, hp, 'point-blank attacks still have travel time');
  assert.ok(g.evaluate('enemyProjectilePool.count()') > 0);
  g.evaluate('deployHero(0); G.enemies=[];');
  g.frame(30);
  assert.equal(g.window._getHeroState().hp, hp, 'old shots cannot hit a new deployment');
});

test('stunned, burrowed and phased enemies cannot attack a nearby hero', async () => {
  for (const field of ['stunTimer', 'burrowed', 'phased']) {
    const g = await battle();
    const id = nearbyEnemy(g);
    g.window._setEnemyField(id, field, field === 'stunTimer' ? 10 : true);
    const hp = g.window._getHeroState().hp;
    g.frame(60);
    assert.equal(g.window._getHeroState().hp, hp, `${field} suppresses damage`);
    assert.equal(g.evaluate('enemyProjectilePool.count()'), 0);
  }
});

test('Warden reflects on contact instead of once per rendered frame', async () => {
  const g = await battle(2);
  nearbyEnemy(g, 'ironshell');
  g.evaluate('heroState.invuln=true; heroState.reflectDmg=true; heroState.ultimateActive=8;');
  const hp = g.window._getHeroState().hp;
  const enemyHp = g.window._getEnemies()[0].hp;
  g.frame(1);
  assert.equal(g.window._getEnemies()[0].hp, enemyHp, 'no reflection before contact');
  g.frame(30);
  assert.equal(g.window._getHeroState().hp, hp);
  assert.equal(g.window._getEnemies()[0].hp, enemyHp - 20);
});

test('armor reduces discrete hits and a downed hero cannot be hit again', async () => {
  const g = await battle(0);
  nearbyEnemy(g);
  const hp = g.window._getHeroState().hp;
  g.frame(31);
  assert.equal(g.window._getHeroState().hp, hp - 3, 'Vanguard keeps its existing contact DPS');
  g.evaluate('heroState.heroHp=1;');
  g.frame(60);
  assert.equal(g.window._getHeroState().hp, 0);
  assert.ok(g.window._getHeroState().deathTimer > 0);
  g.frame(60);
  assert.equal(g.window._getHeroState().hp, 0);
});

test('pause freezes incoming shots and restart discards old targets', async () => {
  const g = await battle();
  nearbyEnemy(g);
  g.frame(1);
  const hp = g.window._getHeroState().hp;
  const x = g.evaluate('enemyProjectilePool.pool.find(p=>p.active).x');
  g.window._setGamePhase('paused');
  g.frame(60);
  assert.equal(g.window._getHeroState().hp, hp);
  assert.equal(g.evaluate('enemyProjectilePool.pool.find(p=>p.active).x'), x);
  g.evaluate('startGame();');
  assert.equal(g.evaluate('enemyProjectilePool.count()'), 0, 'new game clears incoming attacks');
});

async function siegeBattle() {
  const g = await battle();
  g.evaluate('resetHeroState(); G.phase="build";');
  const start = g.window._getPathPts(0)[0];
  const L = g.window._getLayout();
  const cell = g.window._getValidCells().find(c => Math.hypot(
    L.offsetX+(c.col+0.5)*L.cellSize-start.x,
    L.offsetY+(c.row+0.5)*L.cellSize-start.y) < 2*L.cellSize);
  assert.ok(cell, 'a buildable cell lies near the spawn');
  assert.ok(tryPlace(g, cell.col, cell.row, 0));
  g.evaluate(`G.phase='wave'; spawnEnemy('siegecrawler',0);
    G.enemies[0].speed=0; G.enemies[0].fadeIn=0; G.enemies[0].hp=10000;
    G.towers[0].cooldown=999;`);
  return g;
}

test('siege shots damage and disable a tower only when they land', async () => {
  const g = await siegeBattle();
  const hp = g.evaluate('G.towers[0].hp');
  assert.ok(hp > 0, 'tower has durability');
  g.frame(1);
  assert.equal(g.evaluate('G.towers[0].hp'), hp);
  assert.equal(g.window._getTowersRaw()[0].dis, 0, 'no invisible disable on launch');
  g.frame(30);
  assert.equal(g.evaluate('G.towers[0].hp'), hp - 20);
  assert.ok(g.window._getTowersRaw()[0].dis > 0, 'EMP impact disables the tower');
});

test('zero-health towers stop firing and are repaired for free at wave end', async () => {
  const g = await siegeBattle();
  g.evaluate('G.towers[0].hp=1;');
  g.frame(31);
  assert.equal(g.evaluate('G.towers[0].hp'), 0);
  assert.equal(g.evaluate('G.towers[0].offline'), true);
  g.evaluate('G.towers[0].disabled=0; G.towers[0].cooldown=0;');
  g.frame(120);
  assert.equal(g.evaluate('projectilePool.count()'), 0, 'offline tower cannot shoot');
  const bank = g.evaluate('G.nexium');
  g.evaluate('G.enemies=[]; G.spawnQueue=[];');
  g.frame(1);
  assert.equal(g.evaluate('G.towers[0].hp'), g.evaluate('G.towers[0].maxHp'));
  assert.equal(g.evaluate('G.towers[0].offline'), false);
  assert.equal(g.evaluate('G.nexium'), bank, 'repairs cost no currency');
  assert.equal(g.evaluate('enemyProjectilePool.count()'), 0);
});

test('upgrades add tower durability and selling cancels shots at that tower instance', async () => {
  const g = await siegeBattle();
  const maxHp = g.evaluate('G.towers[0].maxHp');
  assert.ok(g.evaluate('upgradeTower(0)'));
  assert.ok(g.evaluate('G.towers[0].maxHp') > maxHp);
  g.frame(1);
  const cell = g.window._getTowersRaw()[0];
  g.evaluate(`sellTower(0); placeTower(${cell.col},${cell.row},0);`);
  const hp = g.evaluate('G.towers[0].hp');
  g.frame(30);
  assert.equal(g.evaluate('G.towers[0].hp'), hp, 'old projectile must not damage a replacement');
});
