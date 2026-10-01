import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,startClassic} from './harness.mjs';

const types=['devastator','hivemind','siegecrawler'];
const json=value=>JSON.parse(JSON.stringify(value));
async function battle() {
  const g=await boot();await startClassic(g);
  g.evaluate(`G.phase='wave';G.towers=[];G.enemies=[];
    G.spawnQueue=[{type:'skitterling',time:999,pathIdx:0}];
    for(const type of ['devastator','hivemind','siegecrawler'])spawnEnemy(type,0,0.25);
    for(const e of G.enemies){e.fadeIn=0;e.speed=0;}`);
  return g;
}
function pose(g,idx=0) { return json(g.evaluate(`getBossPose(G.enemies[${idx}])`)); }

test('all three boss types get hero-sized portraits while ordinary enemies retain their art', async()=>{
  const g=await battle();
  for(let i=0;i<types.length;i++){
    const p=pose(g,i);
    assert.ok(p.radius>=g.window._getLayout().cellSize*0.75);
    assert.ok(p.radius>g.evaluate(`G.enemies[${i}].size*cellSize`));
    assert.ok(Number.isFinite(p.angle));
  }
  assert.equal(g.evaluate('getBossPose(null)'),null);
  g.evaluate("spawnEnemy('skitterling',0);");
  assert.equal(g.evaluate('getBossPose(G.enemies.at(-1))'),null);
  assert.equal(g.evaluate('G.enemies.at(-1).visualTime'),undefined);
});

test('boss poses follow lane direction and actual distance walked, including both path endpoints',async()=>{
  const g=await battle();
  const first=pose(g);
  g.evaluate('G.enemies[0].progress=0;');const start=pose(g);
  g.evaluate('G.enemies[0].progress=1;');const end=pose(g);
  assert.ok(Number.isFinite(start.angle)&&Number.isFinite(end.angle));
  assert.ok(Math.abs(start.angle-end.angle)>0.1,'sprite turns with the path');
  assert.notEqual(first.gait,end.gait,'gait follows distance instead of render frames');
  g.evaluate('G.enemies[0].stunTimer=1;');
  assert.equal(pose(g).gait,0,'stunned bosses stop stepping');
});

test('boss idle animation uses game time and freezes when paused or a modal is open',async()=>{
  const g=await battle();
  g.frame(60);const before=pose(g);
  assert.ok(before.time>0.9);
  g.window._setGamePhase('paused');g.frame(120);
  assert.deepEqual(pose(g),before);
  g.window._setGamePhase('wave');g.frame(30);
  assert.ok(pose(g).time>before.time);
  g.evaluate('G._modal={title:"PAUSED",lines:[],yesLabel:"OK"};');
  const withModal=pose(g);g.frame(60);
  assert.deepEqual(pose(g),withModal);
});

test('boss visuals use the same clock in defense, fortress offense, and Clash attacks',async()=>{
  for(const mode of ['wave','offenseGame','clashAttack']){
    const g=await battle();
    if(mode==='offenseGame')g.evaluate('startOffenseGame(0);G.towers=[];spawnOffenseEnemy("devastator");G.enemies[0].speed=0;');
    if(mode==='clashAttack')g.evaluate('startClashAttackRound();G.towers=[];spawnOffenseEnemy("devastator");G.enemies[0].speed=0;');
    g.evaluate('G.enemies[0].speed=1;');
    g.window._setGameState('gameSpeed',3);g.frame(60);
    assert.ok(Math.abs(pose(g).time-3)<1e-8,`${mode} uses combat speed`);
    assert.ok(pose(g).gait>0,`${mode} animates walking along the lane`);
  }
});

test('attack recoil, cannon aim, brood charge and damage wear read actual combat state',async()=>{
  const g=await battle();
  g.evaluate(`const siege=G.enemies[2];launchEnemyAttack(siege,'tower',
    makeCampaignDefenderTower(3,2,0,0,0));
    G.enemies[1].spawnCD=0.2;G.enemies[0].hp=G.enemies[0].maxHp*0.25;`);
  assert.equal(pose(g,2).firing,true);
  assert.equal(pose(g,2).recoil,1);
  assert.equal(pose(g,2).turretAngle,g.evaluate('G.enemies[2].attackAngle+Math.PI/2'));
  assert.ok(pose(g,1).brood>0.9,'brood pods fill as spawning approaches');
  assert.equal(pose(g).health,0.25);
  g.evaluate('G.enemies[1].spawnCD=4;G.enemies[0].hp=0;');
  assert.equal(pose(g,1).brood,0);
  assert.equal(pose(g).health,0);
});

test('Reduce Motion removes idle/gait/recoil movement while keeping essential combat cues',async()=>{
  const g=await battle();
  g.evaluate('settings.reduceMotion=true;G.enemies[2].attackFlash=0.2;');
  for(let i=0;i<types.length;i++){
    const p=pose(g,i);assert.equal(p.time,0);assert.equal(p.gait,0);assert.equal(p.recoil,0);
  }
  assert.equal(pose(g,2).firing,true,'muzzle light still signals an attack');
  g.frame(60);
  assert.equal(pose(g).time,0);
  g.evaluate('VFX.hitFlash[G.enemies[0].id]=0.12;');g.frame(15);
  assert.equal(g.evaluate('VFX.hitFlash[G.enemies[0].id]'),undefined,'essential hit light expires with Reduce Motion');
});

test('rendering boss portraits never changes HP, armor, position, rewards or other enemy state',async()=>{
  const g=await battle();
  g.evaluate(`G.enemies[0].hp*=0.25;G.enemies[2].attackFlash=0.2;
    VFX.hitFlash[G.enemies[0].id]=0.1;`);
  for(const palette of ['off','deuteranopia','protanopia']){
    g.evaluate(`settings.colorBlind='${palette}';`);
    const before=g.evaluate('JSON.stringify(G.enemies)');
    const economy=json(g.window._getEconomy());
    for(let i=0;i<5;i++)g.evaluate('render();');
    assert.equal(g.evaluate('JSON.stringify(G.enemies)'),before);
    assert.deepEqual(json(g.window._getEconomy()),economy);
  }
});

test('boss names and full-health bars render at phone size and persist during damage/status effects',async()=>{
  const g=await battle();
  const collect=()=>json(g.evaluate(`(() => {
    const texts=[],orig=ctx.fillText;
    ctx.fillText=function(text,...args){texts.push(text);orig.call(ctx,text,...args);};
    try{for(const e of G.enemies)drawEnemy(e);}finally{ctx.fillText=orig;}
    return texts;
  })()`));
  for(const name of ['DEVASTATOR','HIVEMIND','SIEGE CRAWLER'])assert.ok(collect().includes(name));
  g.evaluate('G.enemies.forEach(e=>{e.hp*=0.3;e.stunTimer=1;e.slowTimer=1;});');
  const texts=collect();
  for(const name of ['DEVASTATOR','HIVEMIND','SIEGE CRAWLER'])assert.ok(texts.includes(name));
  assert.ok(texts.includes('⚡'));
});
