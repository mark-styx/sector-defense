import test from 'node:test';
import assert from 'node:assert/strict';
import {boot} from './harness.mjs';
import {screens,viewports,prepareScreen,rectangles,activeButtons} from './ui-fixtures.mjs';

test('all screen controls fit and remain separate across the viewport matrix',async()=>{
  const problems=[];
  for(const [width,height] of viewports){
    const g=await boot({width,height});
    for(const screen of screens){
      g.evaluate(prepareScreen(screen));
      const maxScroll=g.evaluate('uiState.maxScroll');
      const offsets=g.evaluate('uiState.frame')?[0,maxScroll*.5,maxScroll]:[0];
      for(const offset of offsets){
      g.evaluate(`uiState.scroll=${offset};render();`);
      const rects=rectangles(activeButtons(screen,g.window._getBtns()));
      for(const b of rects)if(b.x<-.1||b.y<-.1||b.x+b.w>width+.1||b.y+b.h>height+.1)
        problems.push(`${width}x${height} ${screen.name}: ${b.name} outside viewport`);
      for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
        const a=rects[i],b=rects[j];
        if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.5)
          problems.push(`${width}x${height} ${screen.name}: ${a.name} overlaps ${b.name}`);
      }
      }
    }
  }
  assert.deepEqual(problems,[]);
});

test('every Arsenal, Store and hero entry can be reached on a small phone',async()=>{
  const g=await boot({width:320,height:480});
  for(const [name,key,expected] of [
    ['loadout','loadoutCards',18],['loadout','loadoutSkins',10],
    ['hero-select','heroCards',5],['store-0','storeItems',4],
    ['store-1','storeItems',3],['store-2','storeItems',3],
    ['store-3','storeItems',3],['store-4','storeItems',4]
  ]){
    g.evaluate(prepareScreen(screens.find(s=>s.name===name)));
    const seen=new Set(),max=g.evaluate('uiState.maxScroll');
    for(let offset=0;offset<max+200;offset+=100){
      g.evaluate(`uiState.scroll=${offset};render();`);
      for(const b of g.window._getBtns()[key]||[])if(b.h>20)seen.add(b.idx??b.id??b.skinId);
    }
    assert.equal(seen.size,expected,name+' '+key+' all entries reachable');
  }
  g.evaluate(prepareScreen(screens.find(s=>s.name==='achievements')));
  g.evaluate('uiState.scroll=uiState.maxScroll;render();');
  assert.ok(g.window._getBtns().achievementsBack,'back remains reachable after the final achievement');
});

test('notches and home indicators leave all controls inside safe bounds',async()=>{
  for(const [width,height,insets] of [[390,844,{top:47,bottom:34,left:0,right:0}],[844,390,{top:0,bottom:21,left:47,right:47}]]){
    const g=await boot({width,height});
    g.evaluate(`getComputedStyle=()=>({getPropertyValue:key=>({'--sat':'${insets.top}px','--sab':'${insets.bottom}px','--sal':'${insets.left}px','--sar':'${insets.right}px'})[key]});`);
    for(const screen of screens){
      g.evaluate(prepareScreen(screen));
      for(const b of rectangles(activeButtons(screen,g.window._getBtns()))){
        assert.ok(b.x>=insets.left-.1&&b.x+b.w<=width-insets.right+.1,screen.name+' horizontal safe area');
        assert.ok(b.y>=insets.top-.1&&b.y+b.h<=height-insets.bottom+.1,screen.name+' vertical safe area');
      }
    }
  }
});

test('rotation reprojects the hero, attacks and enemies while paused',async()=>{
  const g=await boot();
  g.evaluate(`heroState.selectedHeroIdx=2;startGame();deployHero(0);spawnEnemy('devastator',0,.4);
    heroState.manual=true;heroState.moveOrder={x:heroState.heroX,y:heroState.heroY};
    heroState.shieldWall={x:heroState.heroX,y:heroState.heroY,w:cellSize*1.5,h:cellSize*.5,timer:5};
    const shot=enemyProjectilePool.get();Object.assign(shot,{x:heroState.heroX,y:heroState.heroY});G.phase='paused';render();`);
  const before=g.evaluate('({col:(heroState.heroX-offsetX)/cellSize,row:(heroState.heroY-offsetY)/cellSize,hp:heroState.heroHp,progress:G.enemies[0].progress})');
  g.window.innerWidth=844;g.window.innerHeight=390;g.evaluate('resize();render();');
  const after=g.evaluate('({col:(heroState.heroX-offsetX)/cellSize,row:(heroState.heroY-offsetY)/cellSize,hp:heroState.heroHp,progress:G.enemies[0].progress})');
  assert.deepEqual(after,before);
  assert.ok(Math.abs(g.evaluate('heroState.shieldWall.w/cellSize')-1.5)<1e-12);
  assert.ok(g.evaluate('battlePanel.side'),'landscape reserves a side panel');
  assert.ok(g.evaluate('Math.abs(G.enemies[0].px-getPosOnPath(G.enemies[0].progress,0).x)<.001'));
});

test('swiping menus scrolls without activating the touched button',async()=>{
  const g=await boot({width:320,height:480});
  const b=g.window._getBtns().menuPlay,x=b.x+b.w/2,y=b.y+b.h/2;
  const event=(px,py)=>({touches:[{clientX:px,clientY:py}],changedTouches:[{clientX:px,clientY:py}],preventDefault(){}});
  g.listeners.touchstart[0](event(x,y));g.listeners.touchmove[0](event(x,y-120));g.listeners.touchend[0](event(x,y-120));g.frame(1);
  assert.equal(g.evaluate('G.phase'),'menu');assert.ok(g.evaluate('uiState.scroll>0'));
  assert.equal(g.evaluate('scrollUI(NaN)'),false);
  g.evaluate('scrollUI(100000);render();');assert.equal(g.evaluate('uiState.scroll'),g.evaluate('uiState.maxScroll'));
  g.evaluate('scrollUI(-100000);render();');assert.equal(g.evaluate('uiState.scroll'),0);
});

test('briefing scroll position survives rendering its underlying menu',async()=>{
  const g=await boot({width:568,height:320});
  g.evaluate(prepareScreen(screens.find(s=>s.name==='brief-menuCampaign')));
  g.evaluate('scrollUI(100);render();');const scroll=g.evaluate('uiState.scroll');
  assert.ok(scroll>0);g.frame(3);assert.equal(g.evaluate('uiState.scroll'),scroll);
  assert.ok(g.window._getBtns().modalYes,'briefing action is reachable after scrolling');
});
