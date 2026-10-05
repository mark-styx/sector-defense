// Every render dispatch, plus the layouts that change within each screen.
// Viewport matrix: every screen size the game can reasonably ship on.
// Phones portrait: 320x480 floor → 440x956 (iPhone 17 Pro Max), covering
// small Android, SE, mini, standard, Plus/Max, and current-generation sizes.
// Landscape: representative mirrors (notch/island side insets matter).
// Tablets: iPad mini/Air/Pro + common Android, both orientations.
// Desktop: square stress + common laptop/monitor/ultrawide.
export const viewports = [
  // phones, portrait
  [320,480],[320,568],[360,640],[360,800],[375,667],[375,812],[390,844],
  [393,852],[402,874],[412,915],[414,896],[428,926],[430,932],[440,956],
  // phones, landscape
  [568,320],[667,375],[812,375],[844,390],[896,414],[926,428],[956,440],
  // tablets
  [744,1133],[768,1024],[820,1180],[834,1194],[1024,1366],[800,1280],
  [1133,744],[1024,768],[1180,820],[1194,834],[1366,1024],[1280,800],
  // desktop
  [600,600],[800,600],[1280,720],[1440,900],[1920,1080],[2560,1440],[3440,1440]
];
export const screens = [];
const add = (name, setup, gameplay=false) => screens.push({name,setup,gameplay});
const phase = name => `G.phase='${name}';`;
add('splash', 'splashActive=true;splashTimer=1.8;',true);
add('menu-new',phase('menu')+'prog.tutorialDone=false;');
add('menu-returning',phase('menu')+'prog.tutorialDone=true;');
for(const biome of ['urban','volcanic','arctic'])add('maps-'+biome,phase('mapSelect')+`G.biomeTab='${biome}';`);
add('difficulty',phase('diffSelect'));
add('difficulty-unlocked',phase('diffSelect')+'prog.level=100;');
add('endless-biomes',phase('biomeSelect'));
add('settings',phase('settings'));
add('instructions',phase('howToPlay'));
add('profile',phase('profile'));
add('achievements',phase('achievements'));
add('loadout',phase('loadout'));
add('hero-select',phase('heroSelect'));
for(let i=0;i<5;i++)add('hero-select-'+i,phase('heroSelect')+`heroState.selectedHeroIdx=${i};`);
add('hero-roster',phase('heroRoster'));
for(let i=0;i<5;i++)add('store-'+i,phase('store')+`store.tab=${i};`);
for(let i=1;i<5;i++)add('store-hero-'+i,phase('store')+`store.tab=0;store.heroSkinTab=${i};`);
add('purchase',phase('store')+`store.confirmPurchase={type:'heroSkin',heroId:'vex',skinId:'default',name:'Crimson Commander',cost:200};`);
add('campaign-new',phase('campaignMenu')+'campaign.territories=null;');
add('campaign-resume','initCampaign();'+phase('campaignMenu'));
add('campaign-map','initCampaign();campaign.selectedTerritory=-1;'+phase('campaignMap'));
add('campaign-selected','initCampaign();campaign.selectedTerritory=0;'+phase('campaignMap'));
add('campaign-message','initCampaign();campaign.selectedTerritory=0;campaign.message="Captured Iron Ridge without resistance";campaign.messageTimer=3;'+phase('campaignMap'));
for(const sub of ['build','recruit','attackSelect'])add('campaign-'+sub,`initCampaign();campaign.selectedTerritory=0;campaign.attackSource=0;campaign.subAction='${sub}';`+phase('campaignMap'));
add('campaign-invasion','initCampaign();campaign.swarmAttackTarget=0;'+phase('campaignSwarmAttack'));
add('campaign-peace','initCampaign();campaign.swarmAttackTarget=-1;'+phase('campaignSwarmAttack'));
for(const p of ['campaignVictory','campaignDefeat','offenseMapSelect','offenseResult','clashFinal','clashAttackResult','alliedVictory'])add(p, 'initCampaign();'+phase(p));
add('offense-result-win',phase('offenseResult')+'offense.unitsPast=10;');
add('campaign-result','initCampaign();offense.campaignAttacking=true;offense.unitsPast=10;'+phase('offenseResult'));
add('clash-result-win',phase('clashAttackResult')+'offense.unitsPast=10;');
add('allied-defeat',phase('alliedVictory')+'G.lives=0;');
for(const p of ['build','wave','wavePreview','waveSummary','paused','gameover','victory'])add(p,phase(p),true);
add('preview-final',phase('wavePreview')+'G.wave=TOTAL_WAVES-1;',true);
add('preview-insight',phase('wavePreview')+'G.wave=TOTAL_WAVES-2;loadoutBonuses.veteranInsight=true;',true);
add('result-credits',phase('victory')+`_creditLog=[{amount:10,reason:'Match completed'},{amount:15,reason:'Three stars'},{amount:15,reason:'Daily first win'},{amount:25,reason:'Win streak'}];`,true);
add('pause-campaign','initCampaign();campaign.defending=true;'+phase('paused'),true);
add('radial',phase('build')+'G.showRadialMenu=true;G.radialMenuCol=1;G.radialMenuRow=1;',true);
for(let i=0;i<10;i++)add('tower-info-'+i,`G.nexium=10000;window.__uiPlaceTower(${i});G.showTowerInfo=true;G.towerInfoIdx=0;G.phase='wave';`,true);
for(let i=0;i<5;i++)add('battle-hero-'+i,`heroState.selectedHeroIdx=${i};deployHero(0);G.phase='wave';G.spawnQueue=[{type:'skitterling',time:999,pathIdx:0}];`,true);
add('offense','startOffenseGame(0);',true);
add('offense-titan','startOffenseGame(0);swarmEnhanced.hiveTitanUnlocked=true;',true);
add('campaign-assault','initCampaign();campaign.attackSource=0;campaign.attackTarget=3;startCampaignOffense(3,campaign.territories[0]);',true);
add('clash-attack','clash.active=true;clash.round=1;clash.attackTime=0;clash.attackTimeLimit=120;clash.attackGoal=10;'+phase('clashAttack'),true);
for(const key of ['menuPlay','menuEndless','menuCampaign','menuOffense','menuAllied','menuClash'])add('brief-'+key,`seenBriefings.delete('${key}');G.phase='menu';showModeBriefing('${key}',()=>{});`);
add('confirm-offense','startOffenseGame(0);confirmAbandonOffense();',true);
add('confirm-clash','clash.active=true;G.phase="clashAttack";confirmAbandonClash();',true);
add('tutorial','TUTORIAL.start();G.phase="build";',true);
add('tutorial-abilities','TUTORIAL.start();TUTORIAL.step=11;TUTORIAL.applyStep();G.phase="build";',true);
for(let i=1;i<13;i++)if(i!==11)add('tutorial-'+i,`TUTORIAL.start();TUTORIAL.step=${i};TUTORIAL.applyStep();G.phase='build';`,true);
for(let i=0;i<10;i++)add('battle-map-'+i,`G.mapIdx=${i};setupMap(${i});G.phase='wave';`,true);
add('battle-late','G.phase="wave";G.wave=39;G.nexium=99999;G.totalKills=9999;settings.showFPS=true;',true);
add('battle-bosses',`G.phase='wave';for(const [i,type] of ['devastator','hivemind','siegecrawler'].entries())spawnEnemy(type,0,.2+i*.25);`,true);
add('tower-info-max',`G.nexium=10000;window.__uiPlaceTower(4);G.towers[0].level=2;G.towers[0].abilityUnlocked=true;G.towers[0].abilityCooldown=20;G.showTowerInfo=true;G.towerInfoIdx=0;G.phase='wave';`,true);
add('tower-info-offline',`window.__uiPlaceTower(0);G.towers[0].offline=true;G.towers[0].hp=0;G.towers[0].abilityUnlocked=true;G.showTowerInfo=true;G.towerInfoIdx=0;G.phase='wave';`,true);
add('hero-aim',`heroState.selectedHeroIdx=0;deployHero(0);heroState.manual=true;G.heroAim='ability';G.phase='wave';`,true);
add('hero-cooldowns',`heroState.selectedHeroIdx=0;deployHero(0);heroState.abilityCd=20;heroState.ultimateCd=80;G.phase='wave';`,true);
add('preview-boss-insight',`G.phase='wavePreview';G.wave=29;loadoutBonuses.veteranInsight=true;`,true);
add('battle-notifications',`G.phase='wave';achievements.toasts=[{text:'Hero Level Up! Commander Vex → Lv. 6',desc:'New abilities unlocked',timer:3},{text:'Build complete',desc:'Your tower is ready',timer:3}];`,true);
add('menu-notifications',`G.phase='menu';achievements.toasts=[{text:'Unlocked: Crimson Commander',desc:'Equip this skin in the Store',timer:3}];`);

export function prepareScreen(screen) {
  return `resize();splashActive=false;G._modal=null;store.confirmPurchase=null;store.heroSkinTab=0;
    TUTORIAL.active=false;campaign.active=false;campaign.defending=false;campaign.subAction='';
    allied.active=false;clash.active=false;heroState.selectedHeroIdx=-1;
    G.mapIdx=0;G.diffIdx=0;startGame();G.previousPhase='wave';
    window.__uiPlaceTower=idx=>{G.nexium=10000;for(let r=0;r<currentRows;r++)for(let c=0;c<currentCols;c++)if(isValidPlacement(c,r)&&placeTower(c,r,idx))return;throw new Error('No legal tower cell');};
    if(typeof uiState!=='undefined'){uiState.key='';uiState.scroll=0;uiState.scrolls.clear();}
    achievements.toasts=[];_creditLog=[];loadoutBonuses.veteranInsight=false;
    swarmEnhanced.hiveTitanUnlocked=false;settings.showFPS=false;${screen.setup}render();`;
}

export function rectangles(btns, prefix='') {
  return Object.entries(btns).flatMap(([key,value]) => {
    const name=prefix+key;
    if(!value)return [];
    if(Array.isArray(value))return value.flatMap((b,i)=>rectangles({[i]:b},name+'.'));
    if(Number.isFinite(value.w)&&Number.isFinite(value.h))return [{...value,name}];
    return [];
  });
}

export function activeButtons(screen,btns){
  const keys=screen.name.startsWith('brief-')||screen.name.startsWith('confirm-')?['modalYes','modalNo']:
    screen.name==='purchase'?['confirmBuy','confirmCancel']:
    screen.name.startsWith('pause')?['resume','pauseSettings','quit']:
    ['gameover','victory','result-credits'].includes(screen.name)?['restart','toMenu']:null;
  return keys?Object.fromEntries(keys.map(k=>[k,btns[k]])):btns;
}
