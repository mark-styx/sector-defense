// Test harness: boots the single-file game inside a Node VM with a stubbed DOM/canvas.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function makeCtxStub() {
  const gradient = {addColorStop() {}};
  const store = new Map();
  return new Proxy({}, {
    get(t, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (!store.has(prop)) {
        store.set(prop, (...args) => {
          if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return gradient;
          if (prop === 'measureText') return {width: 10};
          return undefined;
        });
      }
      return store.get(prop);
    },
    set(t, prop, v) { store.set(prop, v); return true; }
  });
}

export function loadGame({width = 390, height = 844, storage = null, seed = {}} = {}) {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('game script not found in index.html');
  const code = m[1];

  const store = storage || new Map();
  // Bots and most tests drive menus directly: treat all mode briefings as
  // already seen unless the caller seeds an explicit (e.g. empty) list.
  const DEFAULT_BRIEFINGS = ['menuPlay', 'menuEndless', 'menuCampaign', 'menuOffense', 'menuAllied', 'menuClash'];
  const seedAll = seed.briefings === undefined ? {...seed, briefings: DEFAULT_BRIEFINGS} : seed;
  for (const [k, v] of Object.entries(seedAll)) store.set('sd_' + k, JSON.stringify(v));

  const listeners = {};
  const ctxStub = makeCtxStub();
  const canvas = {
    width: 0, height: 0, style: {},
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener() {},
    getContext: () => ctxStub
  };

  const documentStub = {
    getElementById: id => (id === 'gameCanvas' ? canvas : {style: {}}),
    addEventListener() {},
    fonts: {ready: Promise.resolve()},
    documentElement: {}
  };

  let nowMs = 0;
  const sandbox = {
    console, Math, JSON, Date, Set, Map, Object, Array, Promise, Number, String,
    parseFloat, parseInt, Boolean, RegExp, Error, TypeError, Symbol, isFinite, isNaN,
    window: {
      innerWidth: width, innerHeight: height, devicePixelRatio: 2,
      localStorage: {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k)
      },
      addEventListener() {}, open() {},
      AudioContext: undefined, webkitAudioContext: undefined
    },
    document: documentStub,
    performance: {now: () => nowMs},
    navigator: {},
    requestAnimationFrame(cb) { sandbox._rafCb = cb; },
    setTimeout, clearTimeout,
    getComputedStyle: () => ({getPropertyValue: () => '0px'})
  };
  sandbox.window.window = sandbox.window;

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, {filename: 'sector-defense.js'});

  const api = {
    window: sandbox.window,
    listeners,
    // Advance simulated time in 60fps steps, running update+render via the game's own hook.
    frame(n = 1) {
      for (let i = 0; i < n; i++) {
        nowMs += 1000 / 60;
        sandbox.window.advanceTime(1000 / 60);
      }
    },
    tap(x, y) {
      const fns = listeners.click || [];
      for (const fn of fns) fn({clientX: x, clientY: y, preventDefault() {}});
    },
    async ready() {
      // Flush document.fonts.ready microtask chain.
      await new Promise(r => setTimeout(r, 0));
      return api;
    }
  };
  return api;
}

export function center(b) { return {x: b.x + b.w / 2, y: b.y + b.h / 2}; }

export async function boot(opts) {
  const g = await loadGame(opts).ready();
  g.frame(170); // skip 2.5s splash + settle on menu
  return g;
}

export function tapBtn(g, name) {
  const btns = g.window._getBtns();
  const b = btns[name];
  if (!b) throw new Error('missing button "' + name + '"; available: ' + Object.keys(btns).join(', '));
  const c = center(b);
  g.tap(c.x, c.y);
  g.frame(2);
}

// Classic flow: map 0, difficulty 0, no hero.
export async function startClassic(g) {
  tapBtn(g, 'menuPlay');
  const maps = g.window._getBtns().maps;
  const mc = center(maps[0]); g.tap(mc.x, mc.y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  const dc = center(diffs[0]); g.tap(dc.x, dc.y); g.frame(2);
  tapBtn(g, 'heroNone');
  tapBtn(g, 'heroDeploy');
}

// ============================================================
// Scripted defense bot: places/upgrades towers and runs waves
// using only real tap events.
// ============================================================
const TT_COST = [50, 150, 100, 200, 300, 175, 250, 225, 275, 200];

function cellCenter(g, col, row) {
  const L = g.window._getLayout();
  return {x: L.offsetX + (col + 0.5) * L.cellSize, y: L.offsetY + (row + 0.5) * L.cellSize};
}
function botState(g) { return JSON.parse(g.window.render_game_to_text()); }
// Close any open tower-info panel (a tap on an occupied cell opens one and
// would otherwise stall the build loop, e.g. racing the allied AI).
function closeInfoIfOpen(g) {
  const btns = g.window._getBtns();
  if (btns.closeInfo) { const c = center(btns.closeInfo); g.tap(c.x, c.y); g.frame(1); }
}

export function tryPlace(g, col, row, typeIdx) {
  const before = botState(g).towerCount;
  const c = cellCenter(g, col, row);
  g.tap(c.x, c.y); g.frame(2);
  const radial = g.window._getBtns().radial;
  if (!radial || !radial.length) { closeInfoIfOpen(g); return false; } // occupied cell opened info
  const btn = radial.find(b => b.idx === typeIdx);
  if (!btn) { closeInfoIfOpen(g); return false; }
  g.tap(btn.x, btn.y); g.frame(2);
  return botState(g).towerCount === before + 1;
}

export function tryUpgrade(g, towerIdx) {
  const s = botState(g);
  const t = s.towers[towerIdx];
  if (!t) return false;
  const c = cellCenter(g, t.col, t.row);
  g.tap(c.x, c.y); g.frame(2);
  let btns = g.window._getBtns();
  if (!btns.upgrade) {
    if (btns.closeInfo) { const cc = center(btns.closeInfo); g.tap(cc.x, cc.y); g.frame(1); }
    return false;
  }
  const uc = center(btns.upgrade);
  g.tap(uc.x, uc.y); g.frame(2);
  const ok = botState(g).towers[towerIdx].level > t.level;
  btns = g.window._getBtns();
  if (btns.closeInfo) { const cc = center(btns.closeInfo); g.tap(cc.x, cc.y); g.frame(1); }
  return ok;
}

// Round 40: unlock a tower's auto-ability via the info panel (UNLOCK ◆x).
export function tryUnlock(g, towerIdx) {
  const s = botState(g);
  const t = s.towers[towerIdx];
  if (!t || t.ab) return false;
  const c = cellCenter(g, t.col, t.row);
  g.tap(c.x, c.y); g.frame(2);
  let btns = g.window._getBtns();
  if (!btns.ability) {
    if (btns.closeInfo) { const cc = center(btns.closeInfo); g.tap(cc.x, cc.y); g.frame(1); }
    return false;
  }
  const ac = center(btns.ability);
  g.tap(ac.x, ac.y); g.frame(2);
  const ok = botState(g).towers[towerIdx].ab === true;
  btns = g.window._getBtns();
  if (btns.closeInfo) { const cc = center(btns.closeInfo); g.tap(cc.x, cc.y); g.frame(1); }
  return ok;
}

// Bot with a fixed [col,row,typeIdx] plan (map-specific). After the plan and
// upgrades are exhausted, spends late-game surplus on extra towers.
const LATE_MIX = [4, 5, 1, 7, 2];
export function makePlanBot(g, PLAN) {
  let ptr = 0;
  let latePtr = 0;
  return {
    play() {
      closeInfoIfOpen(g);
      // Live prices (difficulty costM applied) — a stale base-price table
      // under-checks on costM>1 tiers and burns plan slots on taps that
      // cannot afford the tower.
      const COSTS = g.window._getTowerCosts();
      let acted = true, guard = 0;
      while (acted && guard++ < 300) {
        acted = false;
        const s = botState(g);
        const l0 = s.towers.findIndex(t => t.level === 0);
        if (l0 >= 0 && s.nexium >= 40 && tryUpgrade(g, l0)) { acted = true; continue; }
        if (ptr < PLAN.length) {
          const [col, row, tp] = PLAN[ptr];
          if (COSTS[tp] <= s.nexium) {
            if (tryPlace(g, col, row, tp)) { ptr++; acted = true; continue; }
            break; // cannot afford/invalid cell — retry next build phase
          }
        }
        const l1 = s.towers.findIndex(t => t.level === 1);
        if (l1 >= 0 && s.nexium >= 70 && tryUpgrade(g, l1)) { acted = true; continue; }
        // Round 40: convert surplus into auto-abilities on the biggest towers.
        if (s.nexium > 450) {
          const locked = s.towers.map((t, i) => ({t, i})).filter(x => !x.t.ab && x.t.level >= 1)
            .sort((a, b) => b.t.level - a.t.level)[0];
          if (locked && tryUnlock(g, locked.i)) { acted = true; continue; }
        }
        // Late game: flood surplus into extra big-ticket towers.
        if (ptr >= PLAN.length && s.nexium > 600 && s.towerCount < 30) {
          const cells = g.window._getValidCells();
          const tp = LATE_MIX[latePtr % LATE_MIX.length];
          const cell = cells[latePtr % Math.max(1, cells.length)];
          if (cell && COSTS[tp] <= s.nexium && tryPlace(g, cell.col, cell.row, tp)) {
            latePtr++; acted = true; continue;
          }
          if (!cell) break;
        }
      }
    }
  };
}

// Generic bot for unknown maps: scores buildable cells by how many path cells
// sit inside tower range (naturally favors chokepoints and multi-lane
// convergence points over entry clusters), then upgrades greedily.
const GENERIC_MIX = [0, 0, 1, 0, 2, 0, 1, 2, 0, 1, 5, 0, 2, 1];
// Late-game surplus flood (same policy as the plan bot): once the opening
// mix is down and upgrades are maxed, pour bank into big-ticket towers —
// strong play never sits on a 15k bank while waves 37-40 stack up.
const FLOOD_MIX = [4, 5, 1, 7, 2];
export function makeGenericBot(g, maxTowers = 14) {
  let placed = 0;
  let floodPtr = 0;
  let pathCells = null;
  let layoutStamp = null;  const bestCell = () => {
    const L = g.window._getLayout();
    const stamp = L.cols + 'x' + L.rows;
    if (!pathCells || layoutStamp !== stamp) {
      pathCells = g.window._getPathCells();
      layoutStamp = stamp;
    }
    const cells = g.window._getValidCells();
    if (!cells.length) return null;
    let best = null, bestScore = -1;
    for (const cell of cells) {
      let score = 0;
      for (const [pc, pr] of pathCells) {
        const dx = cell.col - pc, dy = cell.row - pr;
        if (dx * dx + dy * dy <= 10.5) score++; // ~3.2 cell tower range
      }
      // Prefer slightly earlier cells on ties (entry side of a chokepoint).
      score += (L.rows - cell.row) * 0.01;
      if (score > bestScore) { bestScore = score; best = cell; }
    }
    return best;
  };
  return {
    play() {
      closeInfoIfOpen(g);
      const COSTS = g.window._getTowerCosts();
      let acted = true, guard = 0;
      while (acted && guard++ < 250) {
        acted = false;
        const s = botState(g);
        const l0 = s.towers.findIndex(t => t.level === 0);
        if (l0 >= 0 && s.nexium >= 40 && tryUpgrade(g, l0)) { acted = true; continue; }
        if (placed < maxTowers && placed < GENERIC_MIX.length) {
          const tp = GENERIC_MIX[placed];
          const cell = bestCell();
          if (cell && COSTS[tp] <= s.nexium) {
            // Map-restricted types fall back to never-restricted ones so no
            // build slot is wasted (restrictions only hit thunder/nova/neural/fusion).
            if (!tryPlace(g, cell.col, cell.row, tp)) {
              if (!tryPlace(g, cell.col, cell.row, 0)) tryPlace(g, cell.col, cell.row, 2);
            }
            placed++; acted = true; continue;
          }
          if (!cell) placed = GENERIC_MIX.length;
        }
        const l1 = s.towers.findIndex(t => t.level === 1);
        if (l1 >= 0 && s.nexium >= 70 && tryUpgrade(g, l1)) { acted = true; continue; }
        // Round 40: convert surplus into auto-abilities on the biggest towers.
        if (s.nexium > 450) {
          const locked = s.towers.map((t, i) => ({t, i})).filter(x => !x.t.ab && x.t.level >= 1)
            .sort((a, b) => b.t.level - a.t.level)[0];
          if (locked && tryUnlock(g, locked.i)) { acted = true; continue; }
        }
        // Late-game surplus flood.
        if (placed >= GENERIC_MIX.length && s.nexium > 600 && s.towerCount < 30) {
          const cells = g.window._getValidCells();
          const tp = FLOOD_MIX[floodPtr % FLOOD_MIX.length];
          const cell = cells[floodPtr % Math.max(1, cells.length)];
          if (cell && COSTS[tp] <= s.nexium && tryPlace(g, cell.col, cell.row, tp)) {
            floodPtr++; acted = true; continue;
          }
          if (!cell) break;
        }
      }
    }
  };
}

export function runBotWave(g, maxSec = 180) {
  const W = 390, H = 844;
  tapBtn(g, 'startWave');
  g.tap(W / 2, H / 2); g.frame(2);
  let f = 0;
  while (botState(g).phase === 'wave' && f++ < maxSec * 60) {
    // Strong play: use global abilities when ready.
    if (f % 30 === 0) {
      const btns = g.window._getBtns();
      if (btns.globals && btns.globals.length >= 3) {
        const s = botState(g);
        const es = g.window._getEnemies().filter(e => e.alive);
        if (es.length > 0) {
          const lead = es.reduce((a, b) => (b.progress > a.progress ? b : a));
          const oc = center(btns.globals[0]);
          g.tap(oc.x, oc.y); g.frame(1);
          if (botState(g).phase === 'wave') { g.tap(lead.px, lead.py); g.frame(1); }
        }
        if (s.lives <= 10) { const rc = center(btns.globals[2]); g.tap(rc.x, rc.y); g.frame(1); }
        if (es.length >= 8) { const sc = center(btns.globals[1]); g.tap(sc.x, sc.y); g.frame(1); }
      }
    }
    g.frame(1);
  }
  const s = botState(g);
  if (s.phase === 'waveSummary') { g.tap(W / 2, H / 2); g.frame(2); }
  return botState(g);
}
