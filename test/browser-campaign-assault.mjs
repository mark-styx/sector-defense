import assert from 'node:assert/strict';
import {readFileSync, mkdirSync} from 'node:fs';

const html = readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(
  'document.fonts.ready.then(()=>requestAnimationFrame(gameLoop));',
  'window.__testEvaluate = code => eval(code);');
const artifacts = new URL('../test-artifacts/',import.meta.url);

export async function runCampaignAssaultBrowserTests(engineName,engine) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({viewport:{width:375,height:667},deviceScaleFactor:2,hasTouch:true});
    const errors = [];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.route('https://fonts.googleapis.com/**',route=>route.abort());
    await page.route('https://fonts.gstatic.com/**',route=>route.abort());
    await page.setContent(html,{waitUntil:'domcontentloaded'});
    const fixture = code => page.evaluate(code=>window.__testEvaluate(code),code);
    const phase = () => page.evaluate(()=>JSON.parse(window.render_game_to_text()).phase);
    const off = () => page.evaluate(()=>window._getOffenseState());
    const tap = async name => {
      const b = await page.evaluate(name=>window._getBtns()[name],name);
      assert.ok(b,`${engineName}: ${name} is available`);
      assert.ok(b.y>=0 && b.y+b.h<=667,`${name} fits the small phone`);
      await page.touchscreen.tap(b.x+b.w/2,b.y+b.h/2);
      await fixture('render();');
    };
    const hex = async id => {
      const b = await page.evaluate(id=>window._getBtns().campaignHexes.find(h=>h.id===id),id);
      await page.touchscreen.tap(b.x+b.w/2,b.y+b.h/2);
      await fixture('render();');
    };
    const labels = () => fixture(`(() => {
      const texts=[],original=ctx.fillText;
      ctx.fillText=function(text,...args){texts.push(String(text));original.call(ctx,text,...args);};
      try{render();}finally{ctx.fillText=original;}
      return texts;
    })()`);
    await fixture(`splashActive=false;seenBriefings.add('menuCampaign');G.phase='menu';render();`);
    await tap('menuCampaign'); await tap('campaignMenuNew');
    await fixture(`campaign.actionPoints=3;campaign.territories[0].army={infantry:2,armor:1,artillery:0};render();`);
    await hex(3);
    assert.ok((await labels()).includes('UNCONTESTED'),'empty territory is marked before capture');
    await hex(0); await tap('campaignAttackBtn');
    assert.ok((await labels()).includes('Empty territory captures immediately'));
    await hex(3);
    assert.equal(await phase(),'campaignMap','auto-capture skips the combat screen');
    const c = await page.evaluate(()=>window._getCampaignState());
    assert.equal(c.territories[3].owner,'player');
    assert.deepEqual(c.territories[3].army,{infantry:2,armor:1,artillery:0});
    assert.equal(c.actionPoints,1); assert.equal(c.battlesWon,0);
    const positions = await fixture(`(() => {
      const labels=[],original=ctx.fillText;
      ctx.fillText=function(text,x,y,...args){
        if(String(text).startsWith('Captured ')||text==='Foundry District')labels.push({text,y});
        original.call(ctx,text,x,y,...args);
      };
      try{render();}finally{ctx.fillText=original;}
      return labels;
    })()`);
    const messageY=positions.find(p=>p.text.startsWith('Captured ')).y;
    const titleY=positions.find(p=>p.text==='Foundry District').y;
    assert.ok(titleY-messageY>=18,'capture feedback does not overlap the territory name');
    mkdirSync(artifacts,{recursive:true});
    await page.screenshot({path:new URL(`campaign-autocapture-${engineName}.png`,artifacts).pathname});

    await fixture(`initCampaign();campaign.territories[0].army={infantry:2,armor:1,artillery:0};
      campaign.territories[3].owner='swarm';G.phase='campaignMap';render();`);
    await hex(0); await tap('campaignAttackBtn'); await hex(3);
    assert.equal(await phase(),'offenseGame');
    const startingCount = (await page.evaluate(()=>window._getTowersRaw())).length;
    // Spawn through the real touch control while the opposing commander builds.
    const spawn = await page.evaluate(()=>window._getBtns().offenseSpawn[0]);
    await page.touchscreen.tap(spawn.x+spawn.w/2,spawn.y+spawn.h/2);
    await fixture('window.advanceTime(3100);');
    const towers = await page.evaluate(()=>window._getTowersRaw());
    assert.equal(towers.length,startingCount+1);
    assert.ok(towers.at(-1).bt>0,'construction is still visible');
    assert.ok((await off()).defender.built>=1);
    assert.ok((await labels()).some(t=>t.startsWith('DEFENDER ◆')),'opponent resources are shown');
    const pixels = await fixture(`(() => {
      const t=G.towers.at(-1),scale=canvas.width/W;
      const x=Math.floor((offsetX+(t.col+0.5)*cellSize)*scale)-16;
      const y=Math.floor((offsetY+(t.row+0.5)*cellSize)*scale)-16;
      const withTower=ctx.getImageData(x,y,32,32).data;
      G.towers.pop();render();const withoutTower=ctx.getImageData(x,y,32,32).data;
      G.towers.push(t);render();let changed=0;
      for(let i=0;i<withTower.length;i+=4)if(withTower[i]!==withoutTower[i]||withTower[i+1]!==withoutTower[i+1]||withTower[i+2]!==withoutTower[i+2])changed++;
      return changed;
    })()`);
    assert.ok(pixels>20,'new tower construction draws real canvas pixels');
    await page.screenshot({path:new URL(`campaign-defender-building-${engineName}.png`,artifacts).pathname});
    await fixture('window.advanceTime(3100);');
    assert.ok((await off()).defender.upgraded>=1,'defender upgrades during the assault');
    await page.screenshot({path:new URL(`campaign-defender-upgrade-${engineName}.png`,artifacts).pathname});
    await tap('offenseExit');
    const before = (await off()).defender;
    await fixture('window.advanceTime(5000);');
    assert.deepEqual((await off()).defender,before,'exit confirmation pauses the defender');
    await tap('modalNo');
    assert.equal(await phase(),'offenseGame');
    assert.deepEqual(errors,[],'campaign screens render without browser errors');
    console.log(`✓ [${engineName}] touch auto-capture, live defender building/upgrades, construction pixels and pause`);
  } finally {
    await browser.close();
  }
}
