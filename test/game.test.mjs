// Regression + integration tests for Sector Defense.
// Covers the commercial-polish fixes: match economy, offense targeting,
// clash movement, mode-flag leaks, endless restart, and the store.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame, boot, startClassic, tapBtn, center} from './harness.mjs';

function state(g) { return JSON.parse(g.window.render_game_to_text()); }

test('boots to menu after splash', async () => {
  const g = await boot();
  const s = state(g);
  assert.equal(s.phase, 'menu');
  assert.equal(s.storageAvailable, true);
});

test('classic flow: map -> difficulty -> no hero -> build phase, wave goal correct', async () => {
  const g = await boot();
  await startClassic(g);
  const s = state(g);
  assert.equal(s.phase, 'build');
  assert.equal(s.waveGoal, 40);
  assert.equal(s.towerCount, 0);
});

test('match economy finalizes exactly once (no per-frame credit/stat farming)', async () => {
  const g = await boot();
  await startClassic(g);
  const before = g.window._getProg();
  g.window._finalizeMatch(true);
  g.window._finalizeMatch(true); // second call must be a no-op
  const after = g.window._getProg();
  assert.equal(after.totalMatches, before.totalMatches + 1);

  // Rendering the victory screen 60 times must not mutate anything further.
  const creditsBefore = g.window._getStoreState().credits;
  const progBefore = g.window._getProg();
  g.window._setGamePhase('victory');
  g.frame(60);
  assert.equal(g.window._getProg().totalMatches, progBefore.totalMatches);
  assert.equal(g.window._getStoreState().credits, creditsBefore);
});

test('defeat also finalizes (partial XP path) and renders gameover without mutation', async () => {
  const g = await boot();
  await startClassic(g);
  const before = g.window._getProg();
  g.window._finalizeMatch(false);
  g.window._setGamePhase('gameover');
  g.frame(60);
  assert.equal(g.window._getProg().totalMatches, before.totalMatches + 1);
});

test('offense mode: AI towers actually kill spawned units (targeting regression)', async () => {
  const g = await boot();
  tapBtn(g, 'menuOffense');
  const maps = g.window._getBtns().offenseMaps;
  const c = center(maps[0]); g.tap(c.x, c.y); g.frame(2);
  assert.equal(state(g).phase, 'offenseGame');

  g.window._spawnOffense('skitterling');
  g.frame(240); // 4 simulated seconds
  const off = g.window._getOffenseState();
  const alive = g.window._getEnemies().filter(e => e.alive).length;
  // The unit must be destroyed by towers, not leak to the exit.
  assert.equal(off.unitsPast, 0);
  assert.equal(alive, 0);
});

test('clash attack: spawned units move along the path (NaN-progress regression)', async () => {
  const g = await boot();
  g.window._startClashAttack();
  g.frame(2);
  assert.equal(state(g).phase, 'clashAttack');
  g.window._spawnOffense('skitterling');
  g.frame(60);
  const es = g.window._getEnemies();
  assert.ok(es.length > 0, 'enemy should exist');
  const e = es[0];
  assert.ok(e.progress > 0 || !e.alive, 'enemy should advance or be killed, not freeze');
  assert.ok(Number.isFinite(e.progress));
  assert.ok(Number.isFinite(e.px) && Number.isFinite(e.py));
});

test('mode flags: quitting allied defense mid-match does not leak into menu', async () => {
  const g = await boot();
  tapBtn(g, 'menuAllied');
  g.frame(2);
  assert.equal(g.window._getAlliedActive(), true);
  assert.equal(state(g).phase, 'build');
  tapBtn(g, 'pause');
  g.frame(2);
  assert.equal(state(g).phase, 'paused');
  tapBtn(g, 'quit');
  g.frame(2);
  assert.equal(state(g).phase, 'menu');
  assert.equal(g.window._getAlliedActive(), false);
  assert.equal(state(g).alliedActive, false);
});

test('endless mode: Play Again on gameover restarts endless, not classic', async () => {
  const g = await boot();
  tapBtn(g, 'menuEndless');
  const biomes = g.window._getBtns().biomes;
  const bc = center(biomes[0]); g.tap(bc.x, bc.y); g.frame(2);
  assert.equal(state(g).phase, 'build');
  assert.equal(state(g).endless, true);

  g.window._setGamePhase('gameover');
  g.frame(2);
  tapBtn(g, 'restart');
  g.frame(2);
  const s = state(g);
  assert.equal(s.phase, 'build');
  assert.equal(s.endless, true);
});

test('store: simulated IAP credits tab grants the advertised amount', async () => {
  const g = await boot();
  tapBtn(g, 'menuStore');
  g.frame(2);
  const tabs = g.window._getBtns().storeTabs;
  const t5 = center(tabs[4]); g.tap(t5.x, t5.y); g.frame(2); // CREDITS tab
  const items = g.window._getBtns().storeItems;
  const item = items.find(i => i.type === 'credits' && i.id === 'credits_100');
  assert.ok(item, 'credits_100 tier should be listed');
  const before = g.window._getStoreState().credits;
  const c = center(item); g.tap(c.x, c.y); g.frame(2);
  assert.equal(g.window._getStoreState().credits, before + item.amount + (item.bonus || 0));
});

test('store: ultimate bundle delivers all advertised contents', async () => {
  const g = await boot();
  g.window._addCredits(2500);
  tapBtn(g, 'menuStore');
  g.frame(2);
  const tabs = g.window._getBtns().storeTabs;
  const t3 = center(tabs[3]); g.tap(t3.x, t3.y); g.frame(2); // BUNDLES
  const items = g.window._getBtns().storeItems;
  const ultimate = items.find(i => i.type === 'bundle' && i.id === 'ultimate_bundle');
  assert.ok(ultimate, 'ultimate bundle should be listed');
  const uc = center(ultimate); g.tap(uc.x, uc.y); g.frame(2);
  tapBtn(g, 'confirmBuy');
  g.frame(2);
  const st = g.window._getStoreState();
  for (const heroId of Object.keys(st.unlockedHeroSkins)) {
    assert.ok(st.unlockedHeroSkins[heroId].length >= 4, `hero ${heroId} skins should all unlock`);
  }
  assert.equal(st.unlockedTowerPacks.length, 3, 'all tower packs owned');
  assert.ok(st.unlockedMapThemes.length >= 3, 'all map themes owned');
  assert.equal(st.credits, 0, 'credits spent in full (2500)');
  // Bundle is one-time: tapping again must not re-charge.
  const b2 = g.window._getBtns().storeItems.find(i => i.id === 'ultimate_bundle');
  if (b2) { const c2 = center(b2); g.tap(c2.x, c2.y); g.frame(2); }
  assert.equal(g.window._getStoreState().credits, 0, 'owned bundle cannot be repurchased');
});

test('hero deploy: selecting a hero enters the match with hero active', async () => {
  const g = await boot();
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  const mc = center(maps[0]); g.tap(mc.x, mc.y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  const dc = center(diffs[0]); g.tap(dc.x, dc.y); g.frame(2);
  const cards = g.window._getBtns().heroCards;
  const hc = center(cards[0]); g.tap(hc.x, hc.y); g.frame(2); // Commander Vex
  tapBtn(g, 'heroDeploy');
  const h = g.window._getHeroState();
  assert.equal(h.deployed, true);
  assert.equal(h.sel, 0);
  assert.ok(h.maxHp > 0);
});

test('hero level bonuses parse and apply at max level (all five heroes)', async () => {
  // Seed every hero to level 6 and verify deployed maxHp equals base + the
  // hero's hp+ entry parsed from the levelBonuses apply strings.
  const baseHp = [500, 300, 800, 250, 350];
  const hpBonus = [50, 30, 100, 30, 40];
  const heroIds = ['vanguard', 'technomancer', 'warden', 'phantom', 'oracle'];
  const seed = {};
  for (const id of heroIds) seed[id] = {xp: 2000, level: 6, matchesPlayed: 0, totalKills: 0};
  const g = await loadGame({seed: {heroProg: seed}}).ready();
  g.frame(170);
  for (let i = 0; i < 5; i++) {
    tapBtn(g, 'menuPlay');
    const maps = g.window._getBtns().maps;
    const mc = center(maps[0]); g.tap(mc.x, mc.y); g.frame(2);
    const diffs = g.window._getBtns().diffs;
    const dc = center(diffs[0]); g.tap(dc.x, dc.y); g.frame(2);
    const cards = g.window._getBtns().heroCards;
    const hc = center(cards[i]); g.tap(hc.x, hc.y); g.frame(2);
    tapBtn(g, 'heroDeploy');
    const h = g.window._getHeroState();
    assert.equal(h.deployed, true);
    assert.equal(h.sel, i);
    assert.equal(h.maxHp, baseHp[i] + hpBonus[i], `${heroIds[i]} max-level HP`);
    tapBtn(g, 'pause');
    tapBtn(g, 'quit');
    g.frame(2);
  }
});

test('pause -> settings -> back returns to pause overlay (no instant resume)', async () => {
  const g = await boot();
  await startClassic(g);
  tapBtn(g, 'pause');
  assert.equal(state(g).phase, 'paused');
  tapBtn(g, 'pauseSettings');
  assert.equal(state(g).phase, 'settings');
  tapBtn(g, 'settingsBack');
  assert.equal(state(g).phase, 'paused');
  tapBtn(g, 'resume');
  assert.equal(state(g).phase, 'build');
});

test('full wave loop: place tower via radial menu, run wave, collect rewards', async () => {
  const g = await boot();
  await startClassic(g);
  const L = g.window._getLayout();
  // Cell (0,0) is a valid build spot on Outpost Alpha (adjacent to path row 1).
  g.tap(L.offsetX + 0.5 * L.cellSize, L.offsetY + 0.5 * L.cellSize);
  g.frame(2);
  const radial = g.window._getBtns().radial;
  assert.ok(radial && radial.length > 0, 'radial menu should open');
  const sentinel = radial.find(r => r.idx === 0);
  g.tap(sentinel.x, sentinel.y); // circle buttons: x,y is the center
  g.frame(2);
  const s1 = state(g);
  assert.equal(s1.towerCount, 1);
  assert.equal(s1.towers[0].type, 'sentinel');
  assert.ok(s1.nexium < 300, 'tower cost deducted');

  // Start the wave: START WAVE -> preview -> tap to begin.
  const nexBefore = s1.nexium;
  tapBtn(g, 'startWave');
  assert.equal(state(g).phase, 'wavePreview');
  g.tap(100, 400);
  g.frame(2);
  assert.equal(state(g).phase, 'wave');

  // Simulate up to 75 seconds of combat for wave 1 (6 skitterlings).
  let phases = new Set();
  for (let i = 0; i < 75 * 60 && state(g).phase === 'wave'; i++) {
    g.frame(1);
    phases.add(state(g).phase);
  }
  const s2 = state(g);
  assert.ok(['waveSummary', 'build'].includes(s2.phase), 'wave should complete, got ' + s2.phase);
  assert.ok(s2.totalKills > 0, 'sentinel should score kills');
  assert.ok(s2.nexium > nexBefore - 60, 'kill rewards + wave bonus credited');

  // Wave summary tap continues to next build phase.
  if (s2.phase === 'waveSummary') { g.tap(100, 400); g.frame(2); }
  assert.equal(state(g).phase, 'build');
});

test('no button hitboxes overlap on any screen (layout regression net)', async () => {
  const g = await boot();
  await startClassic(g);
  const overlap = (a, b) => {
    if (a.r && b.r) { // circular buttons: distance test
      const dx = a.x - b.x, dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy) < a.r + b.r - 1;
    }
    return a.x < b.x + (b.w || 0) - 1 && b.x < a.x + (a.w || 0) - 1 &&
      a.y < b.y + (b.h || 0) - 1 && b.y < a.y + (a.h || 0) - 1;
  };
  const collect = btns => {
    const out = [];
    for (const [k, v] of Object.entries(btns)) {
      if (!v) continue;
      if (Array.isArray(v)) v.forEach((b, i) => { if (b && b.x !== undefined && (b.w || b.r)) out.push([k + '[' + i + ']', b]); });
      else if (v.x !== undefined && (v.w || v.r)) out.push([k, v]);
    }
    return out;
  };
  const check = label => {
    const entries = collect(g.window._getBtns());
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (overlap(entries[i][1], entries[j][1])) {
          assert.fail(`${label}: "${entries[i][0]}" overlaps "${entries[j][0]}" ` +
            `(${JSON.stringify(entries[i][1])} vs ${JSON.stringify(entries[j][1])})`);
        }
      }
    }
  };

  // Menu + full navigation screens.
  for (const phase of ['menu', 'mapSelect', 'diffSelect', 'heroSelect', 'settings', 'loadout', 'profile', 'achievements', 'store', 'campaignMenu', 'offenseMapSelect', 'biomeSelect']) {
    g.window._setGamePhase(phase);
    g.frame(3);
    check(phase);
  }
  // Store tabs each render distinct layouts.
  g.window._setGamePhase('store');
  for (let t = 0; t < 5; t++) {
    const tabs = g.window._getBtns().storeTabs;
    const tb = tabs[t]; g.tap(tb.x + tb.w / 2, tb.y + tb.h / 2); g.frame(3);
    check('store:tab' + t);
  }
  // Live combat screens.
  g.window._setGamePhase('build'); g.frame(3); check('build');
  const L = g.window._getLayout();
  g.tap(L.offsetX + 3.5 * L.cellSize, L.offsetY + 2.5 * L.cellSize); g.frame(2);
  check('build:radial-open');
  const radial = g.window._getBtns().radial;
  const sb = radial.find(r => r.idx === 0); g.tap(sb.x, sb.y); g.frame(2);
  check('build:after-place');
  // Tower info panel open (the screen where the hero-ULT hijack lived).
  g.tap(L.offsetX + 3.5 * L.cellSize, L.offsetY + 2.5 * L.cellSize); g.frame(2);
  assert.equal(state(g).showTowerInfo, true);
  check('build:info-panel-open');
  // Wave phase HUD (close info via the real ✕ button first).
  const ci = g.window._getBtns().closeInfo;
  const cic = center(ci); g.tap(cic.x, cic.y); g.frame(2);
  assert.equal(state(g).showTowerInfo, false);
  tapBtn(g, 'startWave');
  g.tap(195, 422); g.frame(2);
  if (state(g).phase === 'wave') check('wave-hud');
  g.window._setGamePhase('paused'); g.frame(3); check('paused');
});

test('arsenal cards apply their effects (deep pockets, iron will, scavenger)', async () => {
  // Seed a save with three cards unlocked and equipped.
  const g = await loadGame({
    seed: {loadout: {unlockedCards: ['deep_pockets', 'iron_will', 'scavenger'],
                     equippedCards: ['deep_pockets', 'iron_will', 'scavenger'],
                     unlockedSkins: {}, equippedSkins: {}, matchCount: 0}}
  }).ready();
  g.frame(170);
  await startClassic(g);
  const s = state(g);
  assert.equal(s.phase, 'build');
  assert.equal(s.nexium, 350, 'deep_pockets: +50 starting nexium');
  assert.equal(s.lives, 28, 'iron_will: +3 starting lives');
  // scavenger: +15% kill rewards — place a sentinel, clear wave 1, check math:
  // 6 skitterlings x round(5 * 1.15) = 36 kills-nectar + 60 wave bonus, -50 tower.
  const L = g.window._getLayout();
  g.tap(L.offsetX + 3.5 * L.cellSize, L.offsetY + 2.5 * L.cellSize); g.frame(2);
  const radial = g.window._getBtns().radial;
  const sentinel = radial.find(r => r.idx === 0);
  g.tap(sentinel.x, sentinel.y); g.frame(2);
  assert.equal(state(g).towerCount, 1);
  tapBtn(g, 'startWave');
  g.tap(195, 422); g.frame(2);
  let f = 0;
  while (state(g).phase === 'wave' && f++ < 180 * 60) g.frame(1);
  const after = state(g);
  assert.ok(after.totalKills >= 1, 'sentinel should score kills');
  if (state(g).phase === 'waveSummary') { g.tap(195, 422); g.frame(2); }
  // 350 - 50 (tower) + 36 (6 kills x scavenger-boosted 6) + 60 (wave bonus) = 396.
  assert.equal(state(g).nexium, 396, 'scavenger: kill rewards at +15%');
});

test('tower info: ability activation and sell refund work', async () => {
  const g = await boot();
  await startClassic(g);
  const L = g.window._getLayout();
  // Place a Thunder Cannon (has Firestorm nuke ability).
  g.tap(L.offsetX + 3.5 * L.cellSize, L.offsetY + 2.5 * L.cellSize); g.frame(2);
  const radial = g.window._getBtns().radial;
  const thunder = radial.find(r => r.idx === 1);
  g.tap(thunder.x, thunder.y); g.frame(2);
  let s = state(g);
  assert.equal(s.towerCount, 1);
  const afterPlace = s.nexium;

  // Open info and fire the tower ability.
  g.tap(L.offsetX + 3.5 * L.cellSize, L.offsetY + 2.5 * L.cellSize); g.frame(2);
  assert.equal(s2(g).showTowerInfo, true);
  const ab = g.window._getBtns().ability;
  assert.ok(ab, 'ability button present');
  const abc = center(ab); g.tap(abc.x, abc.y); g.frame(2);
  const raw = g.window._getTowersRaw();
  assert.ok(raw[0].abCd > 0, 'tower ability cooldown should be running after activation');

  // Sell: refund is 60% of spent (150 cost, no upgrades).
  const sell = g.window._getBtns().sell;
  const sc = center(sell); g.tap(sc.x, sc.y); g.frame(2);
  s = state(g);
  assert.equal(s.towerCount, 0, 'tower should be gone');
  assert.equal(s.nexium, afterPlace + Math.floor(150 * 0.6), 'sell refunds 60%');
  assert.equal(s2(g).showTowerInfo, false, 'panel closes after sell');

  // The cell is free again: rebuild works.
  g.tap(L.offsetX + 3.5 * L.cellSize, L.offsetY + 2.5 * L.cellSize); g.frame(2);
  const radial2 = g.window._getBtns().radial;
  assert.ok(radial2 && radial2.length, 'radial reopens on freed cell');
});

function s2(g) { return JSON.parse(g.window.render_game_to_text()); }

test('every screen renders without throwing', async () => {
  const g = await boot();
  await startClassic(g);
  const phases = [
    'menu', 'mapSelect', 'diffSelect', 'heroSelect', 'heroRoster', 'store',
    'loadout', 'profile', 'achievements', 'howToPlay', 'settings', 'biomeSelect',
    'campaignMenu', 'campaignMap', 'campaignSwarmAttack', 'campaignVictory', 'campaignDefeat',
    'offenseMapSelect', 'wavePreview', 'waveSummary', 'paused', 'gameover',
    'victory', 'alliedVictory', 'clashFinal', 'clashAttackResult', 'offenseResult'
  ];
  for (const p of phases) {
    g.window._setGamePhase(p);
    g.frame(3); // any ReferenceError/TypeError in a draw function throws here
  }
  // Live phases needing entities.
  g.window._startClashAttack();
  g.frame(3);
  g.window._spawnOffense('devastator');
  g.frame(30);
});
