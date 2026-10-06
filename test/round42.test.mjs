// ROUND 42 code-quality regressions:
//  - kill-stat gate: attacker units (reward 0) must not count toward the
//    player's kill/score totals when AI defenders kill them
//  - Bio-Plating shields now halve ALL damage paths (storm/barrier/dronebay/
//    fusion ticks previously bypassed shields)
//  - scaleDealtDamage: shield x0.5 always; Lucky Strike only for player towers
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, loadGame, startClassic, tapBtn, center, state, tryPlace} from './harness.mjs';

test('attacker-unit kills no longer inflate player kill stats', async () => {
  const g = await boot();
  tapBtn(g, 'menuOffense');
  const maps = g.window._getBtns().offenseMaps || g.window._getBtns().maps;
  const mc = center(maps[0]); g.tap(mc.x, mc.y); g.frame(2);
  // Spawn one unit into the AI fortress and let the defenders kill it.
  g.window._spawnOffense('skitterling');
  const s0 = g.window._getMatchStats();
  for (let i = 0; i < 60 * 30; i++) {
    const es = g.window._getEnemies();
    if (es.length && es.every(e => !e.alive)) break;
    g.frame(1);
  }
  const es = g.window._getEnemies();
  assert.ok(es.length && es.every(e => !e.alive), 'unit should die to defense');
  const s1 = g.window._getMatchStats();
  assert.equal(s1.totalKills, 0, 'reward-0 unit kills must not count as player kills');
  assert.equal(s1.waveKills, 0, 'waveKills must stay clean in offense mode');
});

test('enemy shields halve continuous tick damage (barrier AOE)', async () => {
  const g = await boot();
  await startClassic(g);
  g.frame(10);
  assert.ok(tryPlace(g, 3, 2, 9), 'barrier placed at (3,2)'); // TT 9 = barrier
  tapBtn(g, 'startWave'); g.tap(195, 422); g.frame(2); // skip wave preview
  // Find the barrier's contact window: an alive enemy whose hp drops
  // between consecutive frames while the wave runs.
  const hpOf = id => { const e = g.window._getEnemies().find(x => x.id === id); return e && e.alive ? e.hp : null; };
  let id = null;
  for (let i = 0; i < 60 * 15 && !id; i++) {
    const before = g.window._getEnemies().filter(e => e.alive).map(e => [e.id, e.hp]);
    g.frame(1);
    for (const [eid, hp] of before) {
      const now = hpOf(eid);
      if (now !== null && now < hp) { id = eid; break; }
    }
  }
  assert.ok(id, 'barrier should make contact during wave 1');
  // A/B on the same enemy: plain ticks, then shielded ticks.
  const deltas = shielded => {
    const out = [];
    for (let i = 0; i < 30; i++) {
      if (shielded) g.window._setEnemyField(id, 'shieldTimer', 10);
      const a = hpOf(id); if (a === null) break;
      g.frame(1);
      const b = hpOf(id);
      if (b !== null && b < a) out.push(a - b);
    }
    return out;
  };
  const plain = deltas(false).filter(d => d > 0.01 && d < 1);
  g.window._setEnemyField(id, 'shieldTimer', 0);
  // Barrier also fires 12-dmg projectiles (6 when shielded); keep those out
  // of the sample so the ratio measures the continuous aura ticks only.
  const shielded = deltas(true).filter(d => d > 0.01 && d < 1);
  assert.ok(plain.length >= 2, `need plain samples, got ${plain.length}`);
  assert.ok(shielded.length >= 1, `need shielded samples, got ${shielded.length}`);
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const ratio = mean(shielded) / mean(plain);
  assert.ok(ratio < 0.7, `shields must halve tick damage, ratio ${ratio.toFixed(2)}`);
  assert.ok(ratio > 0.3, `shields must not negate tick damage, ratio ${ratio.toFixed(2)}`);
});

test('scaleDealtDamage: shield halves, Lucky Strike rolls only for player towers', async () => {
  const g = await loadGame({seed: {loadout: {unlockedCards: ['lucky_strike'], equippedCards: ['lucky_strike']}}}).ready();
  g.frame(170);
  await startClassic(g);
  tapBtn(g, 'startWave'); g.tap(195, 422); g.frame(30);
  const es = g.window._getEnemies().filter(e => e.alive);
  assert.ok(es.length, 'wave enemies present');
  const id = es[0].id;
  // No shield, no marks: base damage returned unchanged (before any lucky roll).
  g.window._setEnemyField(id, 'shieldTimer', 0);
  const plain = g.window._probeDealtDamage(id, 100, true);
  assert.equal(plain, 100);
  // Shield halves for AI and player paths alike.
  g.window._setEnemyField(id, 'shieldTimer', 10);
  assert.equal(g.window._probeDealtDamage(id, 100, true), 50);
  assert.equal(g.window._probeDealtDamage(id, 100, false), 50);
  // Lucky Strike (card equipped): only player-side rolls can exceed the shielded base.
  g.window._setEnemyField(id, 'shieldTimer', 0);
  let doubledAI = 0, doubledPlayer = 0;
  for (let i = 0; i < 400; i++) {
    if (g.window._probeDealtDamage(id, 100, true) > 100) doubledAI++;
    if (g.window._probeDealtDamage(id, 100, false) > 100) doubledPlayer++;
  }
  assert.equal(doubledAI, 0, 'AI towers must never benefit from the player card');
  assert.ok(doubledPlayer > 10, `player lucky rolls should fire ~10%, got ${doubledPlayer}/400`);
});
