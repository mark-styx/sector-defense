// Tower Codex: every tower must document its role before a player spends ◆,
// and the codex screen must be reachable and escapable from the main menu.
// Also pins the difficulty tightening: the soak bots prove winnability, these
// asserts prove the knobs actually moved (no silent regression to easy).
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, tapBtn, center, state} from './harness.mjs';

test('every tower has a codex role, traits and ability blurb', async () => {
  const g = await boot();
  const towers = g.evaluate('TT');
  assert.equal(towers.length, 10, '10 towers expected');
  for (const t of towers) {
    assert.ok(t.role && t.role.length >= 40, `${t.id} needs a real role sentence`);
    assert.ok(t.role.length <= 160, `${t.id} role too long for one codex card`);
    assert.ok(t.ab && t.ab.name && t.ab.desc, `${t.id} needs ability name+desc`);
  }
  // Traits must be derived from live combat flags, not marketing.
  const hawk = towers.find(t => t.id === 'hawk');
  assert.ok(hawk.antiAir, 'hawk is the dedicated anti-air tower');
  const nova = towers.find(t => t.id === 'nova');
  const shock = towers.find(t => t.id === 'shockwave');
  assert.ok(!nova.antiAir && !shock.antiAir, 'nova/shockwave hit air via special-case, not antiAir flag');
});

test('codex screen is reachable from menu and back returns to menu', async () => {
  const g = await boot();
  tapBtn(g, 'menuCodex');
  g.frame(2);
  assert.equal(state(g).phase, 'codex', 'menu tap should open the codex');
  // Scroll to the bottom where the back button lives.
  g.evaluate('uiState.scroll = uiState.maxScroll');
  g.frame(2);
  const back = g.window._getBtns().codexBack;
  assert.ok(back && back.w > 0, 'codex back button hitbox must exist');
  const c = center(back);
  g.tap(c.x, c.y); g.frame(2);
  assert.equal(state(g).phase, 'menu', 'back should return to the main menu');
});

test('codex draws scrollable content covering all towers', async () => {
  const g = await boot();
  tapBtn(g, 'menuCodex');
  g.frame(2);
  // The codex exceeds one screen by design; the scroll surface must engage.
  const maxScroll = g.evaluate('uiState.maxScroll');
  assert.ok(maxScroll > 0, 'codex should scroll on a phone-height screen');
  // Scrolling to the bottom brings the back button into the viewport.
  g.evaluate('uiState.scroll = uiState.maxScroll');
  g.frame(1);
  const back = g.window._getBtns().codexBack;
  assert.ok(back, 'back button must be on-screen once scrolled to the bottom');
});

test('difficulty knobs are tightened: enemy HP, speed, density, wave ramp', async () => {
  const g = await boot();
  const diffs = g.evaluate('DIFFS.map(d=>({id:d.id,hpM:d.hpM,spdM:d.spdM,cntM:d.cntM,lives:d.lives}))');
  const [std, vet, elite, leg] = diffs;
  // Total late-wave pressure = hpM x cntM x density ramp x wave HP ramp.
  // Old shipping values per tier (for comparison):
  const OLD = {standard: 3.05, veteran: 4.25, elite: 5.20, legendary: 6.46};
  const WM = Math.pow(1.025, 39), RAMP = 1 + 39 / 110;
  const pressure = t => t.hpM * t.cntM * RAMP * WM;
  for (const t of diffs) {
    assert.ok(pressure(t) > OLD[t.id],
      `${t.id} pressure ${pressure(t).toFixed(2)} must exceed old ${OLD[t.id]}`);
  }
  // Tiers must stay strictly ordered so difficulty select stays meaningful.
  for (const k of ['hpM', 'spdM', 'cntM']) {
    const v = diffs.map(d => d[k]);
    assert.ok(v[0] < v[1] && v[1] < v[2] && v[2] < v[3], `${k} must increase per tier: ${v}`);
  }
  // Wave HP compounding: 1.025^w classic ramp (was 1.018).
  const m40 = g.window._getWaveHpMult(40);
  assert.ok(Math.abs(m40 - Math.pow(1.025, 40)) < 0.01, `wave 40 multiplier should be ~1.025^40, got ${m40}`);
  assert.ok(m40 > Math.pow(1.018, 40), 'late-wave HP must exceed the old ramp');
});

test('late waves field denser packs than before (ramp from wave index 20)', async () => {
  const g = await boot();
  // Drive startWave directly at wave index 25 and check the queue size
  // against the formula: cntM(1.10) * ramp(1 + 25/110).
  g.evaluate(`G.mapIdx=0;setupMap(0);G.diffIdx=0;G.endlessMode=false;`);
  const queued = g.evaluate(`G.wave=25;startWave(),G.spawnQueue.length`);
  const expected = g.evaluate(`WAVES[25].e.reduce((n,grp)=>n+Math.max(1,Math.round(grp.c*1.10*(1+25/110))),0)`);
  assert.equal(queued, expected, 'wave-26 pack size must include the density ramp');
  // Pre-ramp wave (index 19) must NOT include the ramp factor.
  const queuedPre = g.evaluate(`G.wave=19;startWave(),G.spawnQueue.length`);
  const expectedPre = g.evaluate(`WAVES[19].e.reduce((n,grp)=>n+Math.max(1,Math.round(grp.c*1.10)),0)`);
  assert.equal(queuedPre, expectedPre, 'wave-20 pack must be un-ramped');
});
