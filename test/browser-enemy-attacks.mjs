import assert from 'node:assert/strict';
import {readFileSync, mkdirSync} from 'node:fs';

// Deterministic combat fixtures run the real canvas renderer in both engines.
// Fixture access stays in this test copy, never in the served game.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(
  'document.fonts.ready.then(()=>requestAnimationFrame(gameLoop));',
  'window.__testEvaluate = code => eval(code);');
const artifacts = new URL('../test-artifacts/', import.meta.url);

export async function runEnemyAttackBrowserTests(engineName, engine) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true});
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.setContent(html, {waitUntil: 'domcontentloaded'});
    const fixture = code => page.evaluate(code => window.__testEvaluate(code), code);
    await fixture(`splashActive=false; G.mapIdx=0; setupMap(0);
      heroState.selectedHeroIdx=3; deployHero(0); heroState.manual=true;
      G.phase='wave'; G.spawnQueue=[{type:'skitterling',time:999,pathIdx:0}];
      spawnEnemy('skitterling',0,0.3); const e=G.enemies[0]; e.speed=0; e.fadeIn=0;
      heroState.heroX=e.px+cellSize*0.6; heroState.heroY=e.py;
      heroState.heroTargetX=heroState.heroX; heroState.heroTargetY=heroState.heroY;
      window.advanceTime(1000/60);`);
    const before = await page.evaluate(() => window._getHeroState());
    assert.equal(before.hp, before.maxHp, 'hero takes no damage on launch');
    assert.equal((await page.evaluate(() => window._getEnemyAttacks())).length, 1);
    // Check that the projectile actually changes canvas pixels at its position.
    const shotPixels = await fixture(`(() => {
      const p=enemyProjectilePool.pool.find(p=>p.active), scale=canvas.width/W;
      const x=Math.floor(p.x*scale)-12,y=Math.floor(p.y*scale)-12;
      const withShot=ctx.getImageData(x,y,24,24).data;
      p.active=false; render(); const withoutShot=ctx.getImageData(x,y,24,24).data;
      p.active=true; render(); let changed=0;
      for(let i=0;i<withShot.length;i+=4)if(withShot[i]!==withoutShot[i]||withShot[i+1]!==withoutShot[i+1]||withShot[i+2]!==withoutShot[i+2])changed++;
      return changed;
    })()`);
    assert.ok(shotPixels > 20, `${engineName}: incoming bolt is visibly rendered`);
    mkdirSync(artifacts, {recursive: true});
    await page.screenshot({path: new URL(`enemy-attacks-${engineName}-flight.png`, artifacts).pathname});
    await fixture('window.advanceTime(1000/60*7);');
    assert.equal((await page.evaluate(() => window._getHeroState())).hp, before.hp-15);
    assert.ok(await fixture('heroState.hitFlash>0'));
    await page.screenshot({path: new URL(`enemy-attacks-${engineName}-impact.png`, artifacts).pathname});

    // Siege damage, offline art and free repairs share the same renderer.
    await fixture(`resetHeroState(); G.enemies=[]; G.towers=[]; G.phase='build';
      const cell=window._getValidCells().find(c=>Math.hypot(
        offsetX+(c.col+0.5)*cellSize-getPathPts(0)[0].x,
        offsetY+(c.row+0.5)*cellSize-getPathPts(0)[0].y)<2*cellSize);
      placeTower(cell.col,cell.row,0); G.towers[0].hp=1; G.towers[0].cooldown=999;
      G.phase='wave'; spawnEnemy('siegecrawler',0); G.enemies[0].speed=0; G.enemies[0].fadeIn=0;
      window.advanceTime(1000/60*31);`);
    const tower = (await page.evaluate(() => window._getTowersRaw()))[0];
    assert.equal(tower.hp, 0);
    assert.equal(tower.offline, true);
    await fixture('G.showTowerInfo=true; G.towerInfoIdx=0; render();');
    await page.screenshot({path: new URL(`enemy-attacks-${engineName}-offline.png`, artifacts).pathname});
    await fixture('G.enemies=[]; G.spawnQueue=[]; window.advanceTime(1000/60);');
    const repaired = (await page.evaluate(() => window._getTowersRaw()))[0];
    assert.equal(repaired.hp, repaired.maxHp);
    assert.equal(repaired.offline, false);

    await fixture(`G.phase='wave'; G.enemies=[]; G.towers=[]; G.showTowerInfo=false;
      G.spawnTimer=0; G.deploymentSpeed=1;
      G.spawnQueue=Array.from({length:6},(_,i)=>({type:'skitterling',time:i,pathIdx:0}));
      render();`);
    const deployButton = await page.evaluate(() => window._getBtns().deploySpeed);
    await page.touchscreen.tap(deployButton.x+deployButton.w/2,deployButton.y+deployButton.h/2);
    await fixture('window.advanceTime(1000/60*66);');
    assert.equal(await fixture('G.deploymentSpeed'), 3, 'touch activates deployment fast-forward');
    assert.equal(await fixture('G.gameSpeed'), 1, 'combat speed stays unchanged');
    assert.equal((await page.evaluate(() => window._getEnemies())).length, 4);
    await page.screenshot({path: new URL(`deployment-speed-${engineName}.png`, artifacts).pathname});
    assert.deepEqual(errors, [], 'combat renders without page errors');
    console.log(`✓ [${engineName}] visible shots, impacts, tower shutdown/repairs and deployment fast-forward via touch`);
  } finally {
    await browser.close();
  }
}
