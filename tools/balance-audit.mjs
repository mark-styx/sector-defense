// Balance audit: extracts live data tables from the game and measures
// outcome-space margins with the real-tap bots. Read-only; prints a report.
//
//   node tools/balance-audit.mjs            # everything
//   node tools/balance-audit.mjs static     # just the math tables
//   node tools/balance-audit.mjs classic    # bot margins per difficulty
//   node tools/balance-audit.mjs allied clash endless
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {boot, startClassic, tapBtn, center, makePlanBot, makeGenericBot, runBotWave} from '../test/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const sections = process.argv.slice(2);
const want = s => sections.length === 0 || sections.includes(s);

// ---------------------------------------------------------------- data load
function loadData() {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const code = html.match(/<script>([\s\S]*)<\/script>/)[1]
    .replace('window.advanceTime=function',
      'window.__BAL2={TT,ET,DIFFS,WAVES,OFFENSE_ENEMIES,OFFENSE_MAPS};window.advanceTime=function');
  const store = new Map();
  const gradient = {addColorStop() {}};
  const ctxStub = new Proxy({}, {get(t, p) {
    if (typeof p === 'symbol') return undefined;
    return (...a) => (p === 'createLinearGradient' || p === 'createRadialGradient' ? gradient : p === 'measureText' ? {width: 10} : undefined);
  }, set(t, p, v) { return true; }});
  const canvas = {width: 0, height: 0, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => ctxStub};
  const listeners = {};
  let nowMs = 0;
  const sandbox = {
    console: {log() {}}, Math, JSON, Date, Set, Map, Object, Array, Promise, Number, String,
    parseFloat, parseInt, Boolean, RegExp, Error, TypeError, Symbol, isFinite, isNaN,
    window: {innerWidth: 390, innerHeight: 844, devicePixelRatio: 2,
      localStorage: {getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k)},
      addEventListener() {}, open() {}, AudioContext: undefined, webkitAudioContext: undefined},
    document: {getElementById: id => (id === 'gameCanvas' ? canvas : {style: {}}), addEventListener() {}, fonts: {ready: Promise.resolve()}, documentElement: {}},
    performance: {now: () => nowMs},
    navigator: {},
    requestAnimationFrame(cb) { sandbox._rafCb = cb; },
    setTimeout, clearTimeout,
    getComputedStyle: () => ({getPropertyValue: () => '0px'})
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, {filename: 'sector-defense.js'});
  return sandbox.window.__BAL2;
}

// ------------------------------------------------------------- static math
function fmt(n, w = 7) { return String(Math.round(n * 10) / 10).padStart(w); }
function pad(s, w) { return String(s).padEnd(w); }

function towerDps(t, level, armor) {
  // Mirrors getTowerStats + updateTowers firing rules (no abilities/loadout).
  const dmg = Math.round(t.damage * (1 + level * 0.4));
  const rate = t.fireRate * (1 - level * 0.1);
  const id = t.id;
  if (id === 'fusion') {
    const tick = Math.max(1, dmg / 6 - armor);
    return tick / rate;
  }
  if (id === 'barrier') return dmg; // continuous AOE, bypasses armor
  if (id === 'arctesla') {
    let total = 0, d = dmg;
    for (let i = 0; i < 4; i++) { total += Math.max(1, d - armor); d = Math.max(1, Math.round(d * 0.85)); }
    return total / rate; // across up to 4 targets
  }
  if (id === 'dronebay') return 3 * Math.max(1, dmg - armor) / rate; // 3 drones
  return Math.max(1, dmg - armor) / rate;
}

function staticReport(D) {
  const {TT, ET, DIFFS, WAVES} = D;
  console.log('\n===================== 1. TOWER ROI (per-level, difficulty-agnostic cost) =====================');
  console.log(pad('tower', 12) + pad('cost', 6) + pad('max$', 6) + pad('ab$', 5) + pad('rng', 5) +
    pad('dps@L0', 8) + pad('dps@L2', 8) + pad('dps/100@L0', 12) + pad('dps/100@L2', 12) +
    pad('vs arm10 L2', 12) + 'notes');
  for (const t of TT) {
    const maxCost = t.cost + t.upCost[0] + t.upCost[1];
    const d0 = towerDps(t, 0, 0), d2 = towerDps(t, 2, 0), d2a = towerDps(t, 2, 10);
    const notes = [];
    if (t.antiAir) notes.push('antiAir');
    if (t.splash) notes.push('splash');
    if (t.slows) notes.push('slow');
    if (['arctesla', 'dronebay', 'fusion', 'barrier'].includes(t.id)) notes.push('hits-air-incidentally');
    if (t.id === 'barrier' || t.id === 'neural') notes.push('control');
    notes.push('auto:' + t.ab.type);
    console.log(pad(t.id, 12) + pad(t.cost, 6) + pad(maxCost, 6) + pad(t.abCost || 0, 5) + pad(t.range, 5) +
      fmt(d0) + fmt(d2) + fmt(d0 / t.cost * 100, 12) + fmt(d2 / maxCost * 100, 12) + fmt(d2a) + '  ' + notes.join(','));
  }

  console.log('\n===================== 2. DIFFICULTY LADDER: the six-axis stack =====================');
  console.log(pad('tier', 10) + pad('hpM', 6) + pad('spdM', 6) + pad('cntM', 6) + pad('lives', 7) +
    pad('start$', 8) + pad('rewM', 6) + pad('costM', 6) + pad('challenge*', 11) + pad('afford**', 9) + pad('stress***', 10));
  for (const d of DIFFS) {
    const challenge = d.hpM * d.cntM * d.spdM;
    // Round 39: income is damage-driven — hpM pools pay out at a rate folded
    // by max(rewM/hpM, 0.5), so affordable = paid-hp per wave / tower cost.
    const afford = (Math.max(d.rewM, 0.5 * d.hpM) * d.cntM) / d.costM;
    console.log(pad(d.name, 10) + pad(d.hpM, 6) + pad(d.spdM, 6) + pad(d.cntM, 6) + pad(d.lives, 7) +
      pad(d.nex, 8) + pad(d.rewM, 6) + pad(d.costM, 6) +
      fmt(challenge, 9) + fmt(afford, 9) + fmt(challenge / afford, 10));
  }
  console.log('  *challenge = hpM*cntM*spdM (spdM proxy for time-in-range loss)');
  console.log(' **afford = damage-income per wave / tower cost (max(rewM,0.5*hpM)*cntM/costM)');
  console.log('***stress = challenge/afford, relative difficulty in stat+economy space');

  console.log('\n===================== 3. CLASSIC WAVE ECONOMY per difficulty =====================');
  // Round 39 damage economy: income = damage dealt x NEX_PER_HP x
  // max(rewM/hpM, 0.5) x taper + a 25% kill kicker. No flat wave bonus.
  const NEX_PER_HP = 0.30, KICKER = 0.25;
  const taper = w => Math.max(0.5, 1 - Math.max(0, w - 25) * 0.035);
  for (const d of DIFFS) {
    console.log('\n-- ' + d.name + ' (start $' + d.nex + ') --');
    console.log(pad('wave', 5) + pad('units', 7) + pad('waveHP', 9) + pad('lives@risk', 12) +
      pad('dmg$', 7) + pad('kick$', 8) + pad('cumIncome', 11) + pad('cumHP', 9) + pad('HP/$', 7) + pad('armoredHP%', 11));
    let cum = d.nex, cumHp = 0;
    const rows = [];
    WAVES.forEach((w, wi) => {
      let units = 0, hp = 0, lives = 0, inc = 0, armHp = 0, kick = 0;
      const tp = taper(wi + 1);
      // Round 40: classic enemy HP compounds +1.8%/wave (~2x by wave 40).
      const wm = Math.pow(1.018, wi);
      for (const g of w.e) {
        const c = Math.max(1, Math.round(g.c * (d.cntM || 1)));
        const et = ET[g.t];
        const ehp = Math.round(et.hp * d.hpM * wm);
        for (let i = 0; i < c; i++) {
          units++; hp += ehp; lives += et.lives;
          inc += ehp * NEX_PER_HP * Math.max(d.rewM / d.hpM, 0.5) * tp;
          kick += Math.max(1, Math.round(et.reward * d.rewM * tp * KICKER));
          if (et.armor >= 5) armHp += ehp;
          if (et.releases) { // swarm carrier: 6 skitterlings on death
            units += 6; hp += 6 * Math.round(ET.skitterling.hp * d.hpM * wm); lives += 6;
            inc += 6 * Math.round(ET.skitterling.hp * d.hpM * wm) * NEX_PER_HP * Math.max(d.rewM / d.hpM, 0.5) * tp;
            kick += 6 * Math.max(1, Math.round(ET.skitterling.reward * d.rewM * tp * KICKER));
          }
        }
      }
      cum += inc + kick;
      cumHp += hp;
      rows.push({wi: wi + 1, units, hp, lives, inc, kick, cum, cumHp, armPct: hp ? armHp / hp * 100 : 0});
    });
    // Print a sampled view (every 4th wave) plus the 3 highest-pressure waves.
    for (const r of rows) if (r.wi % 4 === 0 || r.wi === 1)
      console.log(pad(r.wi, 5) + pad(r.units, 7) + pad(r.hp, 9) + pad(r.lives, 12) +
        pad(Math.round(r.inc), 7) + pad(r.kick, 8) + pad(Math.round(r.cum), 11) + pad(r.cumHp, 9) +
        fmt(r.cumHp / r.cum, 7) + fmt(r.armPct, 11));
    const peaks = rows.slice().sort((a, b) => (b.hp / b.cum) - (a.hp / a.cum)).slice(0, 3);
    console.log('  peak pressure waves (waveHP / cumIncome): ' + peaks.map(p => 'w' + p.wi + '=' + (p.hp / p.cum).toFixed(3)).join(', '));
  }

  console.log('\n===================== 4. ENDLESS vs ALLIED vs CLASH budget curves =====================');
  console.log(pad('wave', 5) + pad('endless$', 10) + pad('allied$', 9) + pad('clash$@0elo', 12) + pad('clash$@1800elo', 15));
  for (let i = 4; i <= 30; i += 2) {
    const endless = 100 * Math.pow(1.08, i);
    const allied = 80 + i * 40;
    const c0 = (60 + (Math.min(i, 4)) * 30) * 1.0 * 1.0; // clash only has 5 waves
    const c18 = (60 + (Math.min(i, 4)) * 30) * 1.0 * 1.8;
    console.log(pad(i, 5) + pad(Math.round(endless), 10) + pad(allied, 9) + pad(Math.round(c0), 12) + pad(Math.round(c18), 15));
  }
  console.log('  (clash: 5 waves only, budget=(60+30i)*(1+aiThreat*.01)*aiDifficulty; aiDifficulty=1+max(0,elo-1000)/1000)');

  console.log('\n===================== 5. OFFENSE unit efficiency (attacker side) =====================');
  console.log(pad('unit', 14) + pad('bio', 5) + pad('hp*', 7) + pad('hp/bio', 8) + pad('spd', 6) + pad('hp*spd/bio', 12) + 'quirk');
  for (const oe of D.OFFENSE_ENEMIES) {
    const et = ET[oe.id];
    const hp = Math.round(et.hp * 1.3); // spawnOffenseEnemy pins hp at 1.3x
    console.log(pad(oe.name, 14) + pad(oe.cost, 5) + pad(hp, 7) + fmt(hp / oe.cost, 8) + pad(et.speed, 6) +
      fmt(hp * et.speed / oe.cost, 12) + '  ' + (et.flying ? 'flying' : et.burrows ? 'burrows' : et.armor ? 'armor' + et.armor : ''));
  }
  console.log('  *hp as spawned in offense (1.3x pin, decoupled from defense DIFFS)');

  console.log('\n===================== 6. ARMOR coverage per classic wave band (Standard) =====================');
  const d0 = DIFFS[0];
  for (const [lo, hi] of [[1, 9], [10, 19], [20, 29], [30, 40]]) {
    let hp = 0, arm = 0;
    WAVES.slice(lo - 1, hi).forEach(w => {
      for (const g of w.e) {
        const c = g.c, et = ET[g.t], ehp = Math.round(et.hp * d0.hpM);
        hp += c * ehp; if (et.armor >= 5) arm += c * ehp;
        if (et.releases) hp += c * 6 * Math.round(ET.skitterling.hp * d0.hpM);
      }
    });
    console.log('  waves ' + lo + '-' + hi + ': armored(>=5) share of HP = ' + (hp ? (arm / hp * 100).toFixed(1) : 0) + '%');
  }

  console.log('\n===================== 6b. TOWER ABILITY uptime value (used on cooldown) =====================');
  // Average sustained multiplier/addition if the player activates on CD. Bots
  // never tap these; they are pure human upside on top of the tables above.
  const abRows = [
    ['sentinel  Overdrive ', 'rate x2 5s / 30s CD', 1 + 1 * 5 / 30],
    ['thunder   Firestorm  ', '+1 nuke shot (3x dmg, 2x splash) / 45s', null],
    ['hawk      Barrage    ', '+8 missiles / 25s', null],
    ['neural    Storm      ', 'AOE dmg x3/s for 3s / 40s (bypasses armor)', null],
    ['nova      Supercharge', 'next shot 5x / 60s', null],
    ['shockwave Shockpulse ', 'stun 3s + disable-heal 5s / 35s (control)', null],
    ['fusion    Core Breach', 'dmg x2 6s / 30s CD', 1 + 1 * 6 / 30],
    ['arctesla  Overload   ', 'chain 8 once / 30s', null],
    ['dronebay  Swarm Mode ', '6 drones 8s / 40s CD', 1 + 3 * 8 / 40 / 3],
    ['barrier   Fortify    ', 'eff x2 6s / 25s CD', 1 + 1 * 6 / 25]
  ];
  for (const [name, desc, mult] of abRows)
    console.log('  ' + pad(name, 26) + pad(desc, 44) + (mult ? 'avg x' + mult.toFixed(2) : 'burst/control'));

  console.log('\n===================== 6c. PROGRESSION pacing: the level-20 Legendary gate =====================');
  // addXP(waves,kills,stars) = waves*10 + kills + stars*50; cumulative XP for
  // commander level L = 50*L*(L-1). Cards drop one per win; the gate to
  // Legendary is level 20.
  const unitsTotal = DIFFS.map(d => WAVES.reduce((a, w) => a + w.e.reduce((b, g) => {
    const c = Math.max(1, Math.round(g.c * (d.cntM || 1)));
    return b + c + (ET[g.t].releases ? c * 6 : 0);
  }, 0), 0));
  DIFFS.forEach((d, i) => {
    const xpPerWin = 40 * 10 + unitsTotal[i] + 3 * 50;
    const winsTo20 = Math.ceil(19000 / xpPerWin);
    console.log('  ' + pad(d.name, 11) + ' flawless-win XP=' + pad(xpPerWin, 6) +
      ' (kills ' + unitsTotal[i] + ') -> wins to level 20: ' + winsTo20);
  });

  console.log('\n===================== 6d. HIDDEN HP: healers + spawners (excluded from wave tables) =====================');
  // Plaguebearer heals 5 hp/s to every ally within 2.5 cells (stacks per healer,
  // canceled 3s by any shockwave hit). Hivemind spawns 2 swarmers (15hp x hpM)
  // every 4s alive; swarmers cost 0 lives and pay 2 each.
  for (const [lo, hi] of [[16, 19], [20, 29], [30, 40]]) {
    let plague = 0, hivemind = 0, base = 0;
    WAVES.slice(lo - 1, hi).forEach(w => {
      for (const g of w.e) {
        const et = ET[g.t];
        base += g.c * Math.round(et.hp * d0.hpM);
        if (et.heals) plague += g.c;
        if (et.spawns) hivemind += g.c;
        if (et.releases) base += g.c * 6 * Math.round(ET.skitterling.hp * d0.hpM);
      }
    });
    // Assumes ~12s average alive time for healers/bosses (chokepoint defense),
    // 2 overlapping healers on big targets.
    const healEst = plague * 12 * 2 * 5;
    const spawnEst = hivemind * (12 / 4) * 2 * Math.round(15 * d0.hpM);
    console.log('  waves ' + lo + '-' + hi + ': plaguebearers=' + plague + ' hiveminds=' + hivemind +
      ' -> est +' + Math.round(healEst) + ' heal HP +' + Math.round(spawnEst) + ' spawner HP' +
      ' = +' + ((healEst + spawnEst) / base * 100).toFixed(1) + '% of listed HP (Standard)');
  }
}

// ------------------------------------------------------------ dynamic runs
function state(g) { return JSON.parse(g.window.render_game_to_text()); }

async function startTier(g, diffIdx) {
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  const mc = center(maps[0]); g.tap(mc.x, mc.y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  const t = diffs.find(x => x.idx === diffIdx);
  if (!t) throw new Error('difficulty ' + diffIdx + ' not present (locked?)');
  const dc = center(t); g.tap(dc.x, dc.y); g.frame(2);
  tapBtn(g, 'heroNone');
  tapBtn(g, 'heroDeploy');
}

const PLAN = [
  [3, 2, 0], [5, 2, 0], [3, 3, 0], [5, 3, 0], [1, 5, 0], [3, 6, 0],
  [5, 8, 1], [7, 8, 2], [7, 9, 2], [3, 9, 1], [6, 11, 2], [7, 12, 0], [7, 14, 5], [6, 14, 1], [2, 3, 4], [4, 3, 7]
];

async function classicReport() {
  console.log('\n===================== 7. CLASSIC bot margins (strong plan-bot, map 0) =====================');
  for (const diffIdx of [0, 1, 2, 3]) {
    const g = await boot();
    try {
      await startTier(g, diffIdx);
    } catch (e) {
      console.log('  diff ' + diffIdx + ': skipped (' + e.message.split(';')[0] + ')');
      continue;
    }
    g.window._setGameState('gameSpeed', 3);
    const bot = makePlanBot(g, PLAN);
    const name = ['Standard', 'Veteran', 'Elite', 'Legendary'][diffIdx];
    let worstLives = 99, peakNex = 0, final = null, waveLog = [];
    for (let w = 1; w <= 40; w++) {
      if (state(g).phase !== 'build') break;
      bot.play();
      const post = runBotWave(g, 240);
      worstLives = Math.min(worstLives, post.lives);
      peakNex = Math.max(peakNex, post.nexium);
      waveLog.push(post.lives);
      final = post;
      if (post.phase !== 'build') break;
    }
    console.log('  ' + pad(name, 10) + ' result=' + pad(final ? final.phase : '?', 10) +
      ' endLives=' + pad(final ? final.lives : '?', 4) + ' minLives=' + pad(worstLives, 4) +
      ' peakBank=' + pad(Math.round(peakNex), 5) + ' towers=' + (final ? final.towerCount : '?'));
    console.log('    lives/wave: ' + waveLog.join(','));
  }

  console.log('\n===================== 8. WEAK-bot Standard (casual play proxy, 6 towers max) =====================');
  for (const maxT of [4, 6]) {
    const g = await boot();
    await startClassic(g);
    g.window._setGameState('gameSpeed', 3);
    const bot = makeGenericBot(g, maxT);
    let final = null, minLives = 99;
    for (let w = 1; w <= 40; w++) {
      if (state(g).phase !== 'build') break;
      bot.play();
      const post = runBotWave(g, 240);
      minLives = Math.min(minLives, post.lives);
      final = post;
      if (post.phase !== 'build') break;
    }
    console.log('  maxTowers=' + maxT + ' result=' + (final ? final.phase : '?') + ' wave=' + (final ? final.wave : '?') +
      ' endLives=' + (final ? final.lives : '?') + ' minLives=' + minLives);
  }
}

async function legendaryReport() {
  console.log('\n===================== 7b. LEGENDARY bot margin (level-20 seeded save) =====================');
  const g = await boot({seed: {prog: {xp: 21000, level: 20, totalKills: 0, totalMatches: 0, totalStars: 0, highestWaves: {}, tutorialDone: true}}});
  try {
    await startTier(g, 3);
  } catch (e) {
    console.log('  skipped: ' + e.message);
    return;
  }
  g.window._setGameState('gameSpeed', 3);
  const bot = makePlanBot(g, PLAN);
  let worstLives = 99, peakNex = 0, final = null, waveLog = [];
  for (let w = 1; w <= 40; w++) {
    if (state(g).phase !== 'build') break;
    bot.play();
    const post = runBotWave(g, 240);
    worstLives = Math.min(worstLives, post.lives);
    peakNex = Math.max(peakNex, post.nexium);
    waveLog.push(post.lives);
    final = post;
    if (post.phase !== 'build') break;
  }
  console.log('  Legendary result=' + pad(final ? final.phase : '?', 10) +
    ' endLives=' + pad(final ? final.lives : '?', 4) + ' minLives=' + pad(worstLives, 4) +
    ' peakBank=' + pad(Math.round(peakNex), 5) + ' towers=' + (final ? final.towerCount : '?'));
  console.log('    lives/wave: ' + waveLog.join(','));
}

async function alliedReport() {
  console.log('\n===================== 9. ALLIED DEFENSE: ally vs player contribution =====================');
  const g = await boot();
  tapBtn(g, 'menuAllied'); g.frame(2);
  g.window._setGameState('gameSpeed', 3);
  // Player bot restricted to left half (cols 0-7); the AI ally only builds cols 8-13.
  const TT_COST = [50, 150, 100, 200, 300, 175, 250, 225, 275, 200];
  const MIX = [0, 0, 1, 0, 2, 0, 1, 2, 0, 1];
  let placed = 0;
  const leftBot = {
    play() {
      const btns = g.window._getBtns();
      if (btns.closeInfo) { const c = center(btns.closeInfo); g.tap(c.x, c.y); g.frame(1); }
      let acted = true, guard = 0;
      while (acted && guard++ < 200) {
        acted = false;
        const s = state(g);
        const l0 = s.towers.findIndex(t => t.level === 0 && t.col < 8);
        if (l0 >= 0 && s.nexium >= 40 && tryUpgradeLeft(g, l0)) { acted = true; continue; }
        if (placed < MIX.length) {
          const cells = g.window._getValidCells().filter(c => c.col < 8);
          const pathCells = g.window._getPathCells();
          let best = null, bs = -1;
          for (const cell of cells) {
            let score = 0;
            for (const [pc, pr] of pathCells) {
              const dx = cell.col - pc, dy = cell.row - pr;
              if (dx * dx + dy * dy <= 10.5) score++;
            }
            if (score > bs) { bs = score; best = cell; }
          }
          if (best && TT_COST[MIX[placed]] <= s.nexium && tryPlaceLeft(g, best.col, best.row, MIX[placed])) { placed++; acted = true; continue; }
        }
        const l1 = s.towers.findIndex(t => t.level === 1 && t.col < 8);
        if (l1 >= 0 && s.nexium >= 70 && tryUpgradeLeft(g, l1)) { acted = true; continue; }
      }
    }
  };
  function tryPlaceLeft(g2, col, row, tp) {
    const before = state(g2).towerCount;
    const L = g2.window._getLayout();
    g2.tap(L.offsetX + (col + 0.5) * L.cellSize, L.offsetY + (row + 0.5) * L.cellSize); g2.frame(2);
    const radial = g2.window._getBtns().radial;
    if (!radial || !radial.length) return false;
    const btn = radial.find(b => b.idx === tp);
    if (!btn) return false;
    g2.tap(btn.x, btn.y); g2.frame(2);
    return state(g2).towerCount === before + 1;
  }
  function tryUpgradeLeft(g2, idx) {
    const s = state(g2); const t = s.towers[idx];
    const L = g2.window._getLayout();
    g2.tap(L.offsetX + (t.col + 0.5) * L.cellSize, L.offsetY + (t.row + 0.5) * L.cellSize); g2.frame(2);
    const b = g2.window._getBtns();
    if (!b.upgrade) { if (b.closeInfo) { const c = center(b.closeInfo); g2.tap(c.x, c.y); g2.frame(1); } return false; }
    const uc = center(b.upgrade); g2.tap(uc.x, uc.y); g2.frame(2);
    const ok = state(g2).towers[idx].level > t.level;
    const b2 = g2.window._getBtns();
    if (b2.closeInfo) { const c = center(b2.closeInfo); g2.tap(c.x, c.y); g2.frame(1); }
    return ok;
  }
  const t0 = Date.now();
  const samples = [];
  for (let w = 0; w < 30; w++) {
    if (state(g).phase !== 'build') break;
    leftBot.play();
    const post = runBotWaveMax(g, 300);
    samples.push({w: w + 1, lives: post.lives, nex: Math.round(post.nexium),
      player: state(g).towers.filter(t => t.col < 8).length, ai: state(g).towers.filter(t => t.col >= 8).length});
    if (post.phase !== 'build') break;
  }
  const finalS = state(g);
  const playerT = finalS.towers.filter(t => t.col < 8), aiT = finalS.towers.filter(t => t.col >= 8);
  console.log('  result=' + finalS.phase + ' endLives=' + finalS.lives + ' playerTowers=' + playerT.length + ' aiTowers=' + aiT.length);
  console.log('  per-wave (lives, playerT, aiT):');
  for (const s of samples.filter((_, i) => i % 3 === 0 || i === samples.length - 1))
    console.log('    w' + pad(s.w, 3) + ' lives=' + pad(s.lives, 4) + ' playerT=' + pad(s.player, 3) + ' aiT=' + pad(s.ai, 3));
  console.log('  wall-clock: ' + ((Date.now() - t0) / 1000).toFixed(1) + 's at sim-speed 3');

  // 9b. Idle probe: player places NOTHING. Can the ally solo the mode?
  const g2 = await boot();
  tapBtn(g2, 'menuAllied'); g2.frame(2);
  g2.window._setGameState('gameSpeed', 3);
  let idle = null, idleLives = 99, idleWaves = 0;
  for (let w = 0; w < 30; w++) {
    if (state(g2).phase !== 'build') break;
    g2.frame(600); // AFK ~30 sim-sec in build: the ally builds during this window
    if (state(g2).phase !== 'build') break;
    idle = runBotWaveMax(g2, 300);
    idleWaves = w + 1;
    idleLives = Math.min(idleLives, idle.lives);
    if (idle.phase !== 'build') break;
  }
  console.log('  IDLE PROBE (player builds nothing): result=' + state(g2).phase + ' wavesSurvived=' + idleWaves +
    ' endLives=' + state(g2).lives + ' minLives=' + idleLives +
    ' aiTowers=' + state(g2).towers.filter(t => t.col >= 8).length);
}
function runBotWaveMax(g, maxSec, countFrames) {
  const W = 390, H = 844;
  tapBtn(g, 'startWave');
  g.tap(W / 2, H / 2); g.frame(2);
  let f = 0;
  while (state(g).phase === 'wave' && f++ < maxSec * 60) {
    if (countFrames) countFrames(1);
    g.frame(1);
  }
  const s = state(g);
  if (s.phase === 'waveSummary') { g.tap(W / 2, H / 2); g.frame(2); }
  return state(g);
}

async function clashReport() {
  console.log('\n===================== 10. CLASH: defend margin + attack stall exploit =====================');
  const g = await boot();
  tapBtn(g, 'menuClash'); g.frame(2);
  g.window._setGameState('gameSpeed', 3);
  // Defend round 1 with the strong generic bot.
  const bot = makeGenericBot(g, 14);
  bot.play();
  let post = null;
  for (let w = 0; w < 6; w++) {
    post = runBotWave(g, 240);
    if (post.phase !== 'build') break;
    bot.play();
  }
  console.log('  defend r1 result: phase=' + post.phase + ' livesLeft=' + post.lives + '/20');
  // Attack phase: measure the stall (no input at all).
  if (post.phase === 'clashAttack') {
    const off = g.window._getOffenseState();
    const samples = [];
    for (let t = 0; t <= 180; t += 30) {
      samples.push(t + 's:' + Math.floor(g.window._getOffenseState().bioMass));
      g.frame(30 * 60); // 30 sim-seconds at speed 3
    }
    console.log('  STALL TEST (zero input) bioMass over time: ' + samples.join(' '));
    console.log('  goal=' + off.goalUnits + ' unitsPast after 180s idle=' + g.window._getOffenseState().unitsPast);
    // Cheapest-unit spam from a stalled bank.
    let f = 0;
    while (f++ < 120 * 60 && state(g).phase === 'clashAttack') {
      const spawn = g.window._getBtns().clashAttackSpawn;
      const o = g.window._getOffenseState();
      if (spawn && spawn.length && o.bioMass >= 3) {
        const pick = spawn.find(b => b.idx === 0) || spawn[0];
        g.tap(pick.x + pick.w / 2, pick.y + pick.h / 2);
      }
      g.frame(1);
    }
    const o2 = g.window._getOffenseState();
    console.log('  SKITTERLING-SPAM result: unitsPast=' + o2.unitsPast + '/' + o2.goalUnits + ' phase=' + state(g).phase);
  }
}

async function endlessReport() {
  console.log('\n===================== 11. ENDLESS: strong-bot death point =====================');
  const g = await boot();
  tapBtn(g, 'menuEndless'); g.frame(2);
  const biomes = g.window._getBtns().biomes;
  const bc = center(biomes[0]); g.tap(bc.x, bc.y); g.frame(2);
  g.window._setGameState('gameSpeed', 3);
  const bot = makeGenericBot(g, 14);
  let w = 0, final = null, minLives = 99;
  const t0 = Date.now();
  while (w < 70) {
    if (state(g).phase !== 'build') break;
    bot.play();
    final = runBotWave(g, 300);
    minLives = Math.min(minLives, final.lives);
    w++;
    if (final.phase !== 'build') break;
  }
  console.log('  died at endless wave=' + w + ' phase=' + (final && final.phase) + ' lives=' + (final && final.lives) +
    ' kills=' + (final && final.totalKills) + ' towers=' + (final && final.towerCount) + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + 's)');
}

async function cardsReport() {
  console.log('\n===================== 12. ARSENAL CARDS: symbol-read audit + live probe =====================');
  // Static: every card bonus symbol must be read somewhere beyond its own
  // init/reset/equip lines (baseline 3 occurrences). Fewer = dead card.
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const code = html.match(/<script>([\s\S]*)<\/script>/)[1];
  // Occurrences before applyDamage are all setup (literal init, reset, equip);
  // any occurrence after that is an actual combat/economy read.
  const setupEnd = code.indexOf('function applyDamage');
  const symbols = {
    'rapid_deploy (buildTime)': 'buildTime',
    'deep_pockets (extraNexium)': 'extraNexium',
    'scavenger (scavengerBonus)': 'scavengerBonus',
    'iron_will (extraLives)': 'extraLives',
    'hawkeye (rangeMultiplier)': 'rangeMultiplier',
    'heavy_rounds (damageMultiplier)': 'damageMultiplier',
    'quick_reflexes (abilityCdMultiplier)': 'abilityCdMultiplier',
    'thick_armor (thickArmor)': 'thickArmor',
    'lucky_strike (luckyStrike)': 'luckyStrike',
    'tactical_retreat (sellMultiplier)': 'sellMultiplier',
    'drone_support (droneSupportUsed)': 'droneSupportUsed',
    'chain_reaction (splatMultiplier)': 'splatMultiplier',
    'frost_field (frostField)': 'frostField',
    'emergency_fund (emergencyFund)': 'emergencyFund',
    'veterans_insight (veteranInsight)': 'veteranInsight',
    'overclocked (fireRateMultiplier)': 'fireRateMultiplier',
    'reflective_shield (reflectChance)': 'reflectChance',
    'nexium_generator (nexiumDmgMult)': 'nexiumDmgMult'
  };
  for (const [label, sym] of Object.entries(symbols)) {
    const total = code.split(sym).length - 1;
    const inSetup = code.slice(0, setupEnd).split(sym).length - 1;
    const reads = total - inSetup;
    console.log('  ' + pad(label, 40) + ' reads=' + reads + (reads <= 0 ? '  <-- DEAD (never read)' : ''));
  }
  // Empirical: frost_field promises "all towers slow enemies slightly".
  // Since round 37 it is a true permanent aura: ~0.82 ratio = the designed
  // 18% slow; ~0.9 = the old broken behavior (first-0.5s only).
  const bootCfg = cards => ({seed: {loadout: {unlockedCards: cards, equippedCards: cards, unlockedSkins: {}, matchCount: 0}}});
  async function walkProgress(equipped) {
    const g = await boot(equipped ? bootCfg(equipped) : {});
    await startClassic(g);
    const start = g.window._getBtns().startWave;
    const c = center(start); g.tap(c.x, c.y); g.frame(2);
    g.tap(390 / 2, 844 / 2); g.frame(2);
    const snap = () => g.window._getEnemies().filter(e => e.alive).map(e => ({id: e.id, p: e.progress}));
    const es = snap();
    if (!es.length) return null;
    g.frame(180);
    const after = snap().find(e => e.id === es[0].id);
    return (after ? after.p : 1) - es[0].p;
  }
  const base = await walkProgress(null);
  const frost = await walkProgress(['frost_field']);
  if (base && frost)
    console.log('  frost_field live probe: 180-frame progress ratio = ' + (frost / base).toFixed(3) +
      ' (0.82 = designed 18% permanent aura; ~0.9 = old broken first-0.5s-only)');
}

// ------------------------------------------------------------------- main
const D = (want('static')) ? loadData() : null;
if (want('static')) staticReport(D);
if (want('classic')) await classicReport();
if (want('legendary')) await legendaryReport();
if (want('allied')) await alliedReport();
if (want('clash')) await clashReport();
if (want('endless')) await endlessReport();
if (want('cards')) await cardsReport();
console.log('\naudit complete.');
