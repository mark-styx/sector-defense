import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, center, tapBtn, state} from './harness.mjs';

function tapHex(g, id) {
  const c = center(g.window._getBtns().campaignHexes.find(h => h.id === id));
  g.tap(c.x,c.y); g.frame(2);
}

async function campaignGame(opts) {
  const g = await boot(opts);
  tapBtn(g,'menuCampaign'); tapBtn(g,'campaignMenuNew');
  g.window._setCampaignArmy(0,{infantry:2,armor:1,artillery:0});
  return g;
}

function attack(g, tid = 3) {
  tapHex(g,0); tapBtn(g,'campaignAttackBtn'); tapHex(g,tid);
}

async function assault(opts) {
  const g = await campaignGame(opts);
  g.window._setCampaignTerritory(3,'owner','swarm');
  attack(g);
  assert.equal(state(g).phase,'offenseGame');
  return g;
}

function defender(g) { return g.window._getOffenseState().defender; }
function ledger(g) {
  const d = defender(g);
  assert.ok(d.nexium>=0,'defender cannot overspend');
  assert.ok(Math.abs(d.startingNexium+d.earned-d.spent-d.nexium)<1e-7,
    'every defender purchase is funded by starting resources or combat');
}

test('empty neutral land captures through real taps, moving the army without battle rewards', async () => {
  const storage = new Map(), g = await campaignGame({storage});
  g.window._setCampaignField('actionPoints',3);
  const before = g.window._getProg();
  attack(g);
  const c = g.window._getCampaignState();
  assert.equal(state(g).phase,'campaignMap');
  assert.equal(c.territories[3].owner,'player');
  assert.deepEqual(c.territories[3].army,{infantry:2,armor:1,artillery:0});
  assert.deepEqual(c.territories[0].army,{infantry:0,armor:0,artillery:0});
  assert.equal(c.actionPoints,1); assert.equal(c.battlesWon,0);
  assert.equal(g.window._getOffenseState().active,false);
  assert.deepEqual(g.window._getProg(),before);
  assert.match(c.message,/without resistance/);
  const resumed = await boot({storage});
  assert.deepEqual(resumed.window._getCampaignState().territories[3].army,c.territories[3].army);
  assert.equal(resumed.window._getCampaignState().territories[3].owner,'player');
});

test('auto-capture spends the last two AP and advances the campaign turn flow', async () => {
  const g = await campaignGame(); attack(g);
  assert.equal(state(g).phase,'campaignSwarmAttack');
  const c = g.window._getCampaignState();
  assert.equal(c.actionPoints,0); assert.equal(c.battlesWon,0);
  assert.equal(c.territories[3].owner,'player');
  assert.equal(c.nexiumBank,230,'new territory contributes to end-turn income');
});

test('a fifteenth uncontested territory completes the campaign without recording a battle', async () => {
  const g = await campaignGame();
  for (let i=4;i<=14;i++) g.window._setCampaignTerritory(i,'owner','player');
  attack(g);
  assert.equal(state(g).phase,'campaignVictory');
  assert.equal(g.window._getCampaignState().battlesWon,0);
});

test('Swarm occupation, a neutral garrison, or a stationed neutral army requires combat', async () => {
  for (const fixture of ["owner='swarm'","garrison=1","buildings=['garrison']","army={infantry:1,armor:0,artillery:0}"]) {
    const g = await campaignGame();
    g.evaluate(`campaign.territories[3].${fixture};`);
    attack(g);
    assert.equal(state(g).phase,'offenseGame',fixture);
    assert.equal(g.window._getCampaignState().territories[3].owner,fixture.includes('swarm')?'swarm':'neutral');
    assert.equal(g.window._getCampaignState().actionPoints,0);
    assert.ok(defender(g));
  }
  const g = await campaignGame();
  g.window._setCampaignTerritory(3,'buildings',['lab','outpost']);
  attack(g);
  assert.equal(g.window._getCampaignState().territories[3].owner,'player','economic buildings alone do not defend land');
  assert.equal(g.evaluate('isCampaignTerritoryUncontested(null)'),false);
});

test('invalid attack targets and changed source/AP cannot capture land', async () => {
  for (const fixture of ['', 'campaign.actionPoints=1;', "campaign.territories[0].owner='swarm';", 'campaign.territories[0].army={infantry:0,armor:0,artillery:0};']) {
    const g = await campaignGame();
    tapHex(g,0); tapBtn(g,'campaignAttackBtn');
    g.evaluate(fixture);
    const ap = g.window._getCampaignState().actionPoints;
    tapHex(g,fixture?3:18);
    assert.equal(state(g).phase,'campaignMap');
    assert.equal(g.window._getCampaignState().actionPoints,ap);
    assert.equal(g.window._getCampaignState().territories[3].owner,'neutral');
  }
});

test('a live defender buys new towers and upgrades at normal prices with visible construction', async () => {
  const g = await assault();
  const initial = g.window._getTowersRaw().length;
  const bank = defender(g).nexium;
  g.frame(182);
  assert.equal(g.window._getTowersRaw().length,initial+1);
  assert.equal(defender(g).built,1);
  assert.equal(defender(g).nexium,bank-50);
  assert.ok(g.window._getTowersRaw().at(-1).bt>0,'new tower needs construction time');
  ledger(g);
  g.frame(180);
  assert.equal(defender(g).upgraded,1);
  assert.equal(defender(g).nexium,bank-90);
  assert.ok(g.window._getTowersRaw().at(-1).bt<=0);
  assert.ok(g.window._getTowersRaw().some(t=>t.level===1));
  assert.equal(g.evaluate('G.towers.every(t=>t.isAI&&t.isCampaignDefender&&isValidPlacement(t.col,t.row))'),true);
  assert.equal(new Set(g.window._getTowersRaw().map(t=>t.col+','+t.row)).size,initial+1);
  ledger(g);
  g.frame(1800);
  assert.equal(defender(g).actions,2,'no free income for waiting');
  ledger(g);
});

test('defender damage earns a separate capped budget and credits only actual HP removed', async () => {
  const g = await assault();
  g.evaluate(`spawnOffenseEnemy('skitterling'); const e=G.enemies[0];
    const hp=e.hp; e.hp=-100; awardNexiumForDamage(e,hp+100);`);
  const maxHp = g.evaluate('G.enemies[0].maxHp');
  assert.ok(Math.abs(defender(g).earned-maxHp*0.3)<1e-9);
  g.evaluate(`for(let i=0;i<20;i++){const e=G.enemies[0];e.hp=e.maxHp-20;awardNexiumForDamage(e,20);}`);
  assert.ok(Math.abs(defender(g).earned-maxHp*1.25*0.3)<1e-9,'healing cannot farm unlimited income');
  const earned = defender(g).earned;
  g.evaluate(`awardCampaignDefenderDamage(null,10); awardCampaignDefenderDamage(G.enemies[0],NaN);
    awardCampaignDefenderDamage(G.enemies[0],-1); G.enemies[0].alive=false; awardCampaignDefenderDamage(G.enemies[0],10);`);
  assert.equal(defender(g).earned,earned);
  assert.deepEqual(JSON.parse(JSON.stringify(g.window._getEconomy())),{earned:0,spent:0,bank:0},'defender cannot mint player currency');
  ledger(g);
});

test('ordinary tower combat funds the live defender and newly built towers shoot after construction', async () => {
  const g = await assault();
  g.evaluate(`G.towers=[]; spawnOffenseEnemy('devastator'); const e=G.enemies[0]; e.speed=0;
    e.pathProgress=0.5; e.progress=0.5; const pos=getPosOnPath(0.5,e.pathIdx);e.px=pos.x;e.py=pos.y;
    offense.defender.actionTimer=0; updateCampaignDefender(0);`);
  const before = g.window._getEnemies()[0].hp;
  g.frame(60);
  assert.equal(g.window._getEnemies()[0].hp,before,'construction prevents early firing');
  g.frame(180);
  assert.ok(g.window._getEnemies()[0].hp<before);
  assert.ok(defender(g).earned>0);
  assert.equal(g.window._getEconomy().earned,0);
  ledger(g);
});

test('map restrictions apply to starting defenses and every live purchase', async () => {
  const g = await campaignGame();
  g.evaluate(`campaign.territories[3].mapId='skyline'; campaign.territories[3].garrison=3;
    campaign.territories[3].owner='swarm';`);
  attack(g);
  g.evaluate('offense.defender.nexium+=5000; offense.defender.startingNexium+=5000;');
  g.frame(60*45);
  assert.equal(g.evaluate('G.towers.every(t=>!isTowerRestricted(t.typeIdx)&&isValidPlacement(t.col,t.row))'),true);
  assert.ok(defender(g).built>=5 && defender(g).upgraded>0);
  assert.equal(g.evaluate('G.towers.some(t=>TT[t.typeIdx].id===\'nova\')'),false);
  ledger(g);
});

test('defender building pauses with the game, uses game speed, and stops when combat ends', async () => {
  const normal = await assault(), fast = await assault();
  fast.window._setGameState('gameSpeed',3);
  normal.frame(360); fast.frame(120);
  assert.equal(defender(normal).actions,defender(fast).actions);
  assert.equal(defender(normal).nexium,defender(fast).nexium);
  const before = defender(fast);
  fast.window._setGamePhase('paused'); fast.frame(600);
  assert.deepEqual(defender(fast),before);
  fast.window._setGamePhase('offenseResult'); fast.frame(600);
  assert.deepEqual(defender(fast),before);
  fast.window._setGamePhase('offenseGame'); tapBtn(fast,'offenseExit'); fast.frame(600);
  assert.deepEqual(defender(fast),before,'exit confirmation freezes combat');
});

test('a defender cannot buy on occupied/full cells, upgrade past level two, or inherit attacker buffs', async () => {
  const g = await assault();
  g.evaluate(`G.towers=[]; for(let row=0;row<currentRows;row++)for(let col=0;col<currentCols;col++)
    if(isValidPlacement(col,row))G.towers.push(makeCampaignDefenderTower(col,row,0,2,0));
    offense.defender.nexium=1000; offense.defender.startingNexium=offense.defender.spent+1000;
    offense.defender.actionTimer=0; updateCampaignDefender(0);`);
  assert.equal(defender(g).actions,0,'full board with maxed towers has no purchases');
  const stats = g.window._getTowerStatsAt(0);
  g.evaluate(`loadoutBonuses.damageMultiplier=4;loadoutBonuses.rangeMultiplier=3;
    loadoutBonuses.fireRateMultiplier=0.1;loadoutBonuses.buildTime=0.5;`);
  assert.deepEqual(g.window._getTowerStatsAt(0),stats);
  ledger(g);
});

test('returning from a campaign assault and entering fortress offense clears live defender state', async () => {
  const g = await assault();
  g.evaluate(`offense.unitsPast=offense.goalUnits; updateOffenseGame(0); render();`);
  tapBtn(g,'offenseCampaignReturn');
  assert.equal(defender(g),null);
  assert.equal(g.window._getCampaignState().battlesWon,1);
  g.evaluate('startOffenseGame(0); render();');
  const count = g.window._getTowersRaw().length;
  g.frame(600);
  assert.equal(defender(g),null);
  assert.equal(g.window._getTowersRaw().length,count);
});
