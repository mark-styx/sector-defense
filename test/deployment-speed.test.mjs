import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, startClassic, center} from './harness.mjs';

async function deploying(opts) {
  const g = await boot(opts);
  await startClassic(g);
  g.evaluate(`G.phase='wave'; G.spawnTimer=0;
    G.spawnQueue=Array.from({length:6},(_,i)=>({type:'skitterling',time:i,pathIdx:0}));
    render();`);
  return g;
}

function fastForward(g) {
  const b = g.window._getBtns().deploySpeed;
  assert.ok(b, 'deployment fast-forward control is available');
  const c = center(b); g.tap(c.x,c.y);
}

test('deployment fast-forward sends enemies out 3x faster without speeding movement', async () => {
  const normal = await deploying();
  const fast = await deploying();
  fastForward(fast);
  normal.frame(66); fast.frame(66);
  assert.equal(normal.window._getEnemies().length, 2);
  assert.equal(fast.window._getEnemies().length, 4);
  assert.equal(fast.evaluate('G.gameSpeed'), normal.evaluate('G.gameSpeed'));
  assert.ok(Math.abs(fast.window._getEnemies()[0].progress-normal.window._getEnemies()[0].progress)<1e-10,
    'the first enemy moves at the same speed in both runs');
  fastForward(fast);
  assert.equal(fast.evaluate('G.deploymentSpeed'), 1, 'second tap returns to normal deployment');
});

test('pause freezes deployment and the control disables when the queue is empty', async () => {
  const g = await deploying();
  fastForward(g);
  g.frame(10);
  const timer = g.evaluate('G.spawnTimer');
  g.window._setGamePhase('paused'); g.frame(60);
  assert.equal(g.evaluate('G.spawnTimer'), timer);
  g.window._setGamePhase('wave'); g.frame(120);
  assert.equal(g.window._getEnemies().length, 6, 'every queued enemy deploys exactly once');
  assert.equal(g.window._getBtns().deploySpeed, null, 'no active control after all enemies deploy');
  assert.equal(g.evaluate('G.deploymentSpeed'), 1);
});

test('every new defense wave starts with normal deployment pacing', async () => {
  const g = await deploying();
  for (const mode of ['classic','endless','allied','clash']) {
    g.evaluate(`G.deploymentSpeed=3; allied.active=false; clash.active=false; G.endlessMode=false; G.wave=0;`);
    if (mode === 'endless') g.evaluate('G.endlessMode=true; G.endlessWave=0; endlessNextWave=null;');
    if (mode === 'allied') g.evaluate('allied.active=true; allied.wave=0;');
    if (mode === 'clash') g.evaluate(`clash.active=true; clash.phase='defend'; clash._clashWaves=[{e:[{t:'skitterling',c:4,d:1}]}];`);
    g.evaluate('startWave();');
    assert.equal(g.evaluate('G.deploymentSpeed'), 1, `${mode} resets deployment pacing`);
  }
});

test('deployment button fits small phones without overlapping abilities', async () => {
  for (const [width,height] of [[375,667],[390,844]]) {
    const g = await deploying({width,height});
    g.evaluate('heroState.selectedHeroIdx=0; deployHero(0); render();');
    const btns = g.window._getBtns(), b = btns.deploySpeed;
    assert.ok(b && b.h>=44, 'touch target is at least 44px high');
    assert.ok(b.x>=0 && b.x+b.w<=width && b.y>=0 && b.y+b.h<=height);
    for (const other of [btns.heroAbility,btns.heroUltimate,...btns.globals]) {
      const overlaps=b.x<other.x+other.w&&b.x+b.w>other.x&&b.y<other.y+other.h&&b.y+b.h>other.y;
      assert.equal(overlaps,false,'deployment button does not cover an ability');
    }
  }
});
