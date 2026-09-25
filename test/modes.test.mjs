// End-to-end mode tests: Helix War campaign loop, Sector Clash full match,
// and Allied Defense 30-wave co-op — all played by scripted bots via real taps.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, tapBtn, center, makeGenericBot, runBotWave} from './harness.mjs';

function state(g) { return JSON.parse(g.window.render_game_to_text()); }
function tapHex(g, id) {
  const hex = g.window._getBtns().campaignHexes.find(h => h.id === id);
  const c = center(hex); g.tap(c.x, c.y); g.frame(2);
}

// Shared offense player: floods cheap units, uses bio-abilities when present.
function playOffense(g, capSec = 150) {
  let frames = 0;
  while (frames++ < capSec * 60) {
    const s = state(g);
    if (s.phase === 'offenseResult' || s.phase === 'clashAttackResult') break;
    const off = g.window._getOffenseState();
    if (off.unitsPast >= off.goalUnits) break;
    const abs = g.window._getBtns().swarmAbilities || [];
    const tapAb = type => {
      const b = abs.find(a => a.type === type);
      if (b) { g.tap(b.x + b.w / 2, b.y + b.h / 2); g.frame(1); }
    };
    const alive = g.window._getEnemies().filter(e => e.alive).length;
    if (alive >= 8) tapAb('armor');
    tapAb('tunnel');
    if (alive >= 10) tapAb('frenzy');
    const spawn = g.window._getBtns().offenseSpawn || g.window._getBtns().clashAttackSpawn || [];
    if (spawn.length) {
      const pick = off.bioMass >= 10 ? spawn.find(b => b.idx === 1) : spawn.find(b => b.idx === 0);
      if (pick) { const c = center(pick); g.tap(c.x, c.y); }
    }
    g.frame(1);
  }
  g.frame(5);
}

test('helix war: attack captures a territory, defense holds it, flow survives', async () => {
  const g = await boot();
  tapBtn(g, 'menuCampaign');
  g.frame(2);
  assert.equal(state(g).phase, 'campaignMenu');
  tapBtn(g, 'campaignMenuNew'); // no save yet -> BEGIN CAMPAIGN
  g.frame(2);
  assert.equal(state(g).phase, 'campaignMap');
  g.window._setGameState('gameSpeed', 3);

  // --- Attack: give Vanguard HQ a built-up army and assault neutral Foundry District.
  // (A real campaign army: several turns of recruiting -> ~500 assault bio-mass.)
  g.window._setCampaignArmy(0, {infantry: 6, armor: 3, artillery: 2});
  tapHex(g, 0);
  tapBtn(g, 'campaignAttackBtn');
  tapHex(g, 3); // adjacent neutral
  assert.equal(state(g).phase, 'offenseGame');
  playOffense(g, 240);
  const off = g.window._getOffenseState();
  assert.ok(off.unitsPast >= off.goalUnits, `campaign assault failed: ${off.unitsPast}/${off.goalUnits}`);
  tapBtn(g, 'offenseCampaignReturn');
  g.frame(2);
  let c = g.window._getCampaignState();
  assert.equal(c.territories[3].owner, 'player', 'territory should be captured');
  assert.equal(c.battlesWon, 1);
  if (state(g).phase === 'campaignSwarmAttack' && c.swarmAttackTarget < 0) {
    tapBtn(g, 'campaignContinue'); g.frame(2);
  }

  // --- Defend: force a realistic siege on fortified Signal Tower.
  g.window._setCampaignTerritory(5, 'owner', 'swarm');   // swarm now borders player
  g.window._setCampaignTerritory(2, 'garrison', 3);
  g.window._setCampaignTerritory(2, 'buildings', ['lab']);
  g.window._setCampaignField('swarmThreat', 2);
  let attacked = false;
  for (let i = 0; i < 20 && !attacked; i++) {
    const s = state(g);
    if (s.phase === 'campaignSwarmAttack') {
      c = g.window._getCampaignState();
      if (c.swarmAttackTarget >= 0) { attacked = true; break; }
      tapBtn(g, 'campaignContinue'); g.frame(2); continue;
    }
    const b = g.window._getBtns().campaignEndTurn;
    if (!b) break;
    tapBtn(g, 'campaignEndTurn'); g.frame(3);
  }
  assert.ok(attacked, 'swarm should mount an attack within 20 turns');
  c = g.window._getCampaignState();
  const defendedId = c.swarmAttackTarget;

  tapBtn(g, 'campaignDefend');
  g.frame(2);
  assert.equal(state(g).phase, 'build');
  const bot = makeGenericBot(g, 14);
  let result = null;
  for (let w = 0; w < 25; w++) {
    if (state(g).phase !== 'build') break;
    bot.play();
    result = runBotWave(g, 300);
    if (result.phase !== 'build') break;
  }
  assert.ok(['victory', 'gameover'].includes(result.phase),
    `defense battle should resolve, got ${result.phase}`);
  const wonDefense = result.phase === 'victory';
  tapBtn(g, 'restart'); // CONTINUE: processes campaign outcome
  g.frame(2);
  const after = state(g);
  assert.ok(['campaignMap', 'campaignVictory', 'campaignDefeat'].includes(after.phase),
    `campaign should resume, got ${after.phase}`);
  c = g.window._getCampaignState();
  if (wonDefense) {
    assert.equal(c.territories[defendedId].owner, 'player', 'defended territory should hold');
    assert.equal(c.battlesWon, 2);
  }
  // Campaign quit returns cleanly to menu.
  if (after.phase === 'campaignMap') {
    tapBtn(g, 'campaignBack'); g.frame(2);
    assert.equal(state(g).phase, 'menu');
  }
});

test('sector clash: full match resolves to a final screen with rewards', async () => {
  const g = await boot();
  tapBtn(g, 'menuClash');
  g.frame(2);
  assert.equal(state(g).phase, 'build'); // first defend round
  g.window._setGameState('gameSpeed', 3);
  const matchesBefore = g.window._getProg().totalMatches;

  let guard = 0;
  let final = null;
  while (guard++ < 12) {
    const s = state(g);
    if (s.phase === 'build') {
      const bot = makeGenericBot(g, 14);
      bot.play();
      for (let wv = 0; wv < 6; wv++) {
        const post = runBotWave(g, 240);
        if (post.phase !== 'build') break;
      }
    } else if (s.phase === 'clashAttack') {
      playOffense(g);
      if (state(g).phase === 'clashAttackResult') { tapBtn(g, 'clashContinue'); g.frame(2); }
    } else if (s.phase === 'clashAttackResult') {
      tapBtn(g, 'clashContinue'); g.frame(2);
    } else if (s.phase === 'gameover' || s.phase === 'victory') {
      // Defend-round loss concedes: clash branch sends us to the final screen.
      tapBtn(g, 'restart'); g.frame(2);
    } else {
      final = s.phase;
      break;
    }
    const s2 = state(g);
    if (['clashFinal'].includes(s2.phase)) { final = s2.phase; break; }
  }
  assert.equal(final, 'clashFinal', `match should resolve, last phase ${state(g).phase}`);
  assert.ok(g.window._getProg().totalMatches > matchesBefore, 'clash match should count');
  tapBtn(g, 'clashMenu');
  g.frame(2);
  assert.equal(state(g).phase, 'menu');
});

test('allied defense: 30-wave co-op is winnable with the AI ally', async () => {
  const g = await boot();
  tapBtn(g, 'menuAllied');
  g.frame(2);
  assert.equal(state(g).phase, 'build');
  g.window._setGameState('gameSpeed', 3);
  const bot = makeGenericBot(g, 16);
  let last = null;
  for (let w = 0; w < 30; w++) {
    if (state(g).phase !== 'build') break;
    bot.play();
    last = runBotWave(g, 300);
    if (last.phase !== 'build') break;
  }
  assert.equal(state(g).phase, 'alliedVictory',
    `allied run should be won, got ${state(g).phase} at wave ${last ? last.wave : '?'}`);
  assert.ok(state(g).lives > 0);
  tapBtn(g, 'alliedMenu');
  g.frame(2);
  assert.equal(state(g).phase, 'menu');
});
