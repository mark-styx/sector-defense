// Hardening tests: Legendary tier, endless soak, hero ability integration,
// and save/purchase persistence across an app "restart".
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame, boot, tapBtn, center, makeGenericBot, makePlanBot, runBotWave} from './harness.mjs';

const W = 390, H = 844;
function state(g) { return JSON.parse(g.window.render_game_to_text()); }

test('legendary difficulty is winnable by strong play (level-20 save)', async () => {
  // Pre-seed a Commander level 20 save so Legendary is unlocked.
  const g = await loadGame({
    seed: {prog: {xp: 21000, level: 20, totalKills: 0, totalMatches: 0, totalStars: 0, highestWaves: {}, tutorialDone: true}}
  }).ready();
  g.frame(170);
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  const mc = center(maps[0]); g.tap(mc.x, mc.y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  const legendary = diffs.find(d => d.idx === 3);
  assert.ok(legendary, 'legendary should be listed');
  const dc = center(legendary); g.tap(dc.x, dc.y); g.frame(2);
  tapBtn(g, 'heroNone');
  tapBtn(g, 'heroDeploy');
  assert.equal(state(g).phase, 'build');

  g.window._setGameState('gameSpeed', 3);
  const bot = makePlanBot(g, require_plan());
  const log = [];
  let last = null;
  for (let w = 1; w <= 40; w++) {
    if (state(g).phase !== 'build') break;
    bot.play();
    last = runBotWave(g, 240);
    log.push(`w${w} lives=${last.lives} nex=${Math.floor(last.nexium)}`);
    if (last.phase !== 'build') break;
  }
  console.log('LEGENDARY:', last.phase, 'wave', last.wave, 'lives', last.lives, '|', log.slice(-6).join(' '));
  assert.equal(last.phase, 'victory', `Legendary not beaten\n${log.join('\n')}`);
});

function require_plan() {
  return [
    [3, 2, 0], [5, 2, 0], [3, 3, 0], [5, 3, 0],
    [1, 5, 0], [3, 6, 0],
    [5, 8, 1],
    [7, 8, 2], [7, 9, 2],
    [3, 9, 1],
    [6, 11, 2],
    [7, 12, 0],
    [7, 14, 5],
    [6, 14, 1],
    [2, 3, 4],
    [4, 3, 7]
  ];
}

test('endless mode: bot survives 25 waves on a procedural map', async () => {
  const g = await boot();
  tapBtn(g, 'menuEndless');
  const biomes = g.window._getBtns().biomes;
  const bc = center(biomes[0]); g.tap(bc.x, bc.y); g.frame(2);
  assert.equal(state(g).phase, 'build');
  g.window._setGameState('gameSpeed', 3);
  const bot = makeGenericBot(g, 14);
  for (let w = 0; w < 25; w++) {
    if (state(g).phase !== 'build') break;
    bot.play();
    const post = runBotWave(g, 300);
    if (post.phase !== 'build') {
      assert.equal(post.phase, 'gameover', `unexpected phase ${post.phase}`);
      assert.fail(`bot died at endless wave ${w + 1}`);
    }
  }
  const s = state(g);
  assert.ok(s.wave >= 24, `should reach wave 25, at ${s.wave}`);
});

test('hero integration: abilities fire, hero survives combat, match continues', async () => {
  const g = await boot();
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  const mc = center(maps[0]); g.tap(mc.x, mc.y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  const dc = center(diffs[0]); g.tap(dc.x, dc.y); g.frame(2);
  const cards = g.window._getBtns().heroCards;
  const hc = center(cards[0]); g.tap(hc.x, hc.y); g.frame(2); // Commander Vex
  tapBtn(g, 'heroDeploy');
  assert.equal(state(g).phase, 'build');
  let h = g.window._getHeroState();
  assert.equal(h.deployed, true);
  assert.equal(h.sel, 0);
  assert.ok(h.maxHp > 0 && h.hp === h.maxHp, 'hero should start at full HP');

  // Place one tower and run wave 1, popping ability + ultimate mid-wave.
  const L = g.window._getLayout();
  g.tap(L.offsetX + 3.5 * L.cellSize, L.offsetY + 2.5 * L.cellSize); g.frame(2);
  const radial = g.window._getBtns().radial;
  const sb = radial.find(b => b.idx === 0);
  g.tap(sb.x, sb.y); g.frame(2);
  tapBtn(g, 'startWave');
  g.tap(W / 2, H / 2); g.frame(2);
  assert.equal(state(g).phase, 'wave');

  // Both buttons start ready (cd 0).
  tapBtn(g, 'heroAbility');
  g.frame(30);
  tapBtn(g, 'heroUltimate');
  g.frame(30);
  h = g.window._getHeroState();
  assert.ok(h.abCd > 0 || h.ultCd > 0, 'cooldowns should be running after use');

  // Wave completes; hero still functional (respawn timer not stuck).
  let f = 0;
  while (state(g).phase === 'wave' && f++ < 180 * 60) g.frame(1);
  if (state(g).phase === 'waveSummary') { g.tap(W / 2, H / 2); g.frame(2); }
  assert.equal(state(g).phase, 'build');
  h = g.window._getHeroState();
  assert.equal(h.deployed, true);
});

test('persistence: purchases and progress survive an app restart', async () => {
  const shared = new Map();
  // Session 1: earn credits, buy a hero skin, gain progress.
  const a = await loadGame({storage: shared}).ready();
  a.frame(170);
  a.window._addCredits(800);
  tapBtn(a, 'menuStore');
  a.frame(2);
  const tabs = a.window._getBtns().storeTabs;
  const t0 = center(tabs[0]); a.tap(t0.x, t0.y); a.frame(2); // HEROES tab
  const items = a.window._getBtns().storeItems;
  const skin = items.find(i => i.type === 'heroSkin' && i.cost > 0 && !i.owned);
  const sc = center(skin); a.tap(sc.x, sc.y); a.frame(2);       // confirm modal
  tapBtn(a, 'confirmBuy');
  a.frame(2);
  assert.ok(a.window._getStoreState().unlockedHeroSkins[skin.heroId].includes(skin.skinId),
    'skin should be unlocked in session 1');

  // Session 2 (fresh boot, same storage): everything persisted?
  const b = await loadGame({storage: shared}).ready();
  b.frame(170);
  const st = b.window._getStoreState();
  assert.equal(st.credits, 800 - skin.cost, 'credit balance should persist');
  assert.ok(st.unlockedHeroSkins[skin.heroId].includes(skin.skinId), 'purchase should persist');
  assert.equal(st.equippedHeroSkins[skin.heroId], skin.skinId, 'equipped skin should persist');
});

test('settings persist across an app restart', async () => {
  const shared = new Map();
  const a = await loadGame({storage: shared}).ready();
  a.frame(170);
  tapBtn(a, 'menuSettings');
  a.frame(2);
  assert.ok(!shared.has('sd_settings'), 'no settings saved yet');
  const opts = a.window._getBtns().settingsOpts;
  const sfx = opts.find(o => o.idx === 0);
  const c1 = center(sfx); a.tap(c1.x, c1.y); a.frame(2);
  assert.ok(shared.has('sd_settings'), 'toggling a setting should save it');
  // Restart: settings screen still renders from the persisted value without errors.
  const b = await loadGame({storage: shared}).ready();
  b.frame(170);
  tapBtn(b, 'menuSettings');
  b.frame(2);
  assert.ok(b.window._getBtns().settingsOpts.length >= 9, 'settings screen renders after restart');
});
