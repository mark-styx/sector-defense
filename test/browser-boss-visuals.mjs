import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(
  'document.fonts.ready.then(()=>requestAnimationFrame(gameLoop));',
  'window.__testEvaluate = code => eval(code);');
const artifacts=new URL('../test-artifacts/',import.meta.url);

export async function runBossVisualBrowserTests(engineName,engine) {
  const browser=await engine.launch();
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.route('https://fonts.googleapis.com/**',route=>route.abort());
    await page.route('https://fonts.gstatic.com/**',route=>route.abort());
    await page.setContent(html,{waitUntil:'domcontentloaded'});
    const fixture=code=>page.evaluate(code=>window.__testEvaluate(code),code);
    await fixture(`splashActive=false;G.mapIdx=0;setupMap(0);G.phase='wave';
      G.spawnQueue=[{type:'skitterling',time:999,pathIdx:0}];G.towers=[];G.enemies=[];
      for(const type of ['devastator','hivemind','siegecrawler'])spawnEnemy(type,0,0.25);
      for(const e of G.enemies)e.fadeIn=0;
      window.__bossSnapshot=(index)=>{
        ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,W,H);ctx.globalAlpha=1;
        const e=G.enemies[index],pose=getBossPose(e);
        drawBossIcon(ctx,W/2,H/2,pose.radius,e,pose);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let hash=2166136261,count=0,outer=0,light=0,alpha=0;const colors=new Set();
        const legacyRadius=e.size*cellSize*2;
        for(let i=0;i<pixels.length;i+=4){
          hash=Math.imul(hash^pixels[i],16777619);hash=Math.imul(hash^pixels[i+1],16777619);
          hash=Math.imul(hash^pixels[i+2],16777619);hash=Math.imul(hash^pixels[i+3],16777619);
          if(pixels[i+3]>0){count++;alpha+=pixels[i+3];colors.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);
            const x=(i/4)%canvas.width,y=Math.floor(i/4/canvas.width);
            if(Math.hypot(x-W,y-H)>legacyRadius)outer++;
            if(pixels[i]>140&&pixels[i+1]>140&&pixels[i+2]>140)light++;
          }
        }
        return {hash:hash>>>0,count,outer,light,alpha,colors:colors.size};
      };`);
    const snapshot=index=>fixture(`window.__bossSnapshot(${index})`);
    for(let i=0;i<3;i++){
      const normal=await snapshot(i);
      assert.ok(normal.colors>80,`${engineName}: boss ${i} has layered shaded materials`);
      assert.ok(normal.outer>200,'articulated silhouette extends beyond the old shape');
      assert.ok(normal.light>100,'plating, eyes and highlights remain visible at phone size');
      await fixture(`G.enemies[${i}].visualTime=1;G.enemies[${i}].progress=0.26;`);
      assert.notEqual((await snapshot(i)).hash,normal.hash,'idle and walking animation draws different pixels');
      await fixture(`G.enemies[${i}].attackFlash=0.2;G.enemies[${i}].attackAngle=Math.PI/2;`);
      const attack=await snapshot(i);
      await fixture(`G.enemies[${i}].attackFlash=0;`);
      assert.notEqual((await snapshot(i)).hash,attack.hash,'attack is visible on the body/cannon');
      const healthy=await snapshot(i);
      await fixture(`G.enemies[${i}].hp=G.enemies[${i}].maxHp*0.25;`);
      assert.notEqual((await snapshot(i)).hash,healthy.hash,'damage exposes armor cracks');
    }
    // Decorative motion stops in Reduce Motion without flattening the new artwork.
    await fixture('settings.reduceMotion=true;');
    for(let i=0;i<3;i++){
      const before=await snapshot(i);
      await fixture(`G.enemies[${i}].visualTime+=3;`);
      assert.equal((await snapshot(i)).hash,before.hash,'Reduce Motion freezes decorative animation');
    }
    await fixture('VFX.hitFlash[G.enemies[0].id]=0.12;window.advanceTime(250);');
    assert.equal(await fixture('VFX.hitFlash[G.enemies[0].id]'),undefined,'hit light expires with Reduce Motion');
    await fixture(`settings.reduceMotion=false;G.enemies.forEach((e,i)=>{
      e.visualTime=1;e.progress=[0.22,0.49,0.77][i];e.hp=e.maxHp;e.speed=0;
      const pos=getPosOnPath(e.progress,e.pathIdx);e.px=pos.x;e.py=pos.y;
    });heroState.selectedHeroIdx=2;deployHero(0);heroState.manual=true;render();`);
    const names=await fixture(`(() => {
      const names=[],original=ctx.fillText;
      ctx.fillText=function(text,...args){names.push(text);original.call(ctx,text,...args);};
      try{render();}finally{ctx.fillText=original;}return names;
    })()`);
    for(const name of ['DEVASTATOR','HIVEMIND','SIEGE CRAWLER'])assert.ok(names.includes(name));
    mkdirSync(artifacts,{recursive:true});
    await page.screenshot({path:new URL(`bosses-${engineName}-battlefield.png`,artifacts).pathname});
    // Verify the real touch pause freezes the boss clock, not just a fixture pose.
    await fixture('window.advanceTime(1000/60);');
    const pause=await page.evaluate(()=>window._getBtns().pause);
    await page.touchscreen.tap(pause.x+pause.w/2,pause.y+pause.h/2);
    await fixture('render();');
    const before=await fixture('G.enemies.map(e=>e.visualTime)');
    await fixture('window.advanceTime(1000);');
    assert.deepEqual(await fixture('G.enemies.map(e=>e.visualTime)'),before);
    // Both accessibility palettes preserve the same full silhouettes.
    for(const palette of ['deuteranopia','protanopia']){
      await fixture(`settings.colorBlind='${palette}';G.phase='wave';render();`);
      await page.screenshot({path:new URL(`bosses-${engineName}-${palette}.png`,artifacts).pathname});
    }
    const renderMs=await fixture(`(() => {
      const original=G.enemies;G.enemies=[];
      for(let i=0;i<24;i++)spawnEnemy(['devastator','hivemind','siegecrawler'][i%3],0,(i+1)/25);
      G.enemies.forEach(e=>{e.fadeIn=0;e.visualTime=1;});
      const start=performance.now();for(let frame=0;frame<60;frame++)render();
      const elapsed=(performance.now()-start)/60;G.enemies=original;render();return elapsed;
    })()`);
    assert.ok(renderMs<33,`boss-heavy scene fits a 30fps render budget: ${renderMs.toFixed(1)}ms`);
    // A large preview uses the same game renderer, with idle and combat poses.
    const gallery=await browser.newPage({viewport:{width:960,height:740},deviceScaleFactor:2});
    gallery.on('pageerror',e=>errors.push(String(e)));
    await gallery.route('https://fonts.googleapis.com/**',route=>route.abort());
    await gallery.route('https://fonts.gstatic.com/**',route=>route.abort());
    await gallery.setContent(html,{waitUntil:'domcontentloaded'});
    await gallery.evaluate(code=>window.__testEvaluate(code),`splashActive=false;G.mapIdx=0;setupMap(0);
      for(const type of ['devastator','hivemind','siegecrawler'])spawnEnemy(type,0,0.25);
      settings.colorBlind='off';ctx.setTransform(2,0,0,2,0,0);ctx.globalAlpha=1;
      ctx.fillStyle='#0a0f1d';ctx.fillRect(0,0,W,H);
      ctx.font='700 26px '+FD;ctx.textAlign='center';ctx.fillStyle='#dde6f6';
      ctx.fillText('THE SWARM',W/2,46);ctx.font='500 12px '+FB;ctx.fillStyle='#8294b1';
      ctx.fillText('Boss portraits rendered by the live game',W/2,72);
      G.enemies.slice(0,3).forEach((e,i)=>{
        const x=160+i*320;const p=getBossPose(e);p.angle=0;p.turretAngle=-0.15;p.time=1;p.gait=0.4;p.health=1;p.firing=false;p.recoil=0;
        drawBossIcon(ctx,x,230,83,e,p);
        ctx.font='700 16px '+FD;ctx.fillStyle='#eee5d8';ctx.fillText(ET[e.type].name.toUpperCase(),x,365);
        ctx.font='500 11px '+FB;ctx.fillStyle='#8294b1';ctx.fillText(['Furnace heart · taloned armor','Brain crown · brood pods','Articulated legs · EMP cannon'][i],x,387);
        p.health=0.25;p.firing=true;p.recoil=0.8;p.brood=0.95;p.gait=1.7;
        drawBossIcon(ctx,x,530,65,e,p);
      });ctx.font='600 11px '+FD;ctx.fillStyle='#c8967d';ctx.fillText('ATTACK AND DAMAGED ARMOR',W/2,668);`);
    const galleryColors=await gallery.evaluate(()=>{
      const c=document.getElementById('gameCanvas'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      const colors=new Set();for(let i=0;i<data.length;i+=4*37)colors.add((data[i]<<16)|(data[i+1]<<8)|data[i+2]);
      return colors.size;
    });
    assert.ok(galleryColors>80,'the exported portrait preview contains the rendered art');
    await gallery.screenshot({path:new URL(`bosses-${engineName}-portraits.png`,artifacts).pathname});
    assert.deepEqual(errors,[],'boss drawing has no browser errors');
    console.log(`✓ [${engineName}] detailed boss silhouettes, walking/attack/damage pixels, reduced motion, pause and palettes; 24-boss render ${renderMs.toFixed(1)}ms`);
  } finally {await browser.close();}
}
