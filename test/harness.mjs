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

export function loadGame({width = 390, height = 844} = {}) {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('game script not found in index.html');
  const code = m[1];

  const storage = new Map();
  const localStorage = {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k)
  };

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
      localStorage, addEventListener() {}, open() {},
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

export function tryPlace(g, col, row, typeIdx) {
  const before = botState(g).towerCount;
  const c = cellCenter(g, col, row);
  g.tap(c.x, c.y); g.frame(2);
  const radial = g.window._getBtns().radial;
  if (!radial || !radial.length) return false;
  const btn = radial.find(b => b.idx === typeIdx);
  if (!btn) return false;
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

// Bot with a fixed [col,row,typeIdx] plan (map-specific).
export function makePlanBot(g, PLAN) {
  let ptr = 0;
  return {
    play() {
      let acted = true, guard = 0;
      while (acted && guard++ < 200) {
        acted = false;
        const s = botState(g);
        const l0 = s.towers.findIndex(t => t.level === 0);
        if (l0 >= 0 && s.nexium >= 40 && tryUpgrade(g, l0)) { acted = true; continue; }
        if (ptr < PLAN.length) {
          const [col, row, tp] = PLAN[ptr];
          if (TT_COST[tp] <= s.nexium) {
            tryPlace(g, col, row, tp);
            ptr++; acted = true; continue;
          }
        }
        const l1 = s.towers.findIndex(t => t.level === 1);
        if (l1 >= 0 && s.nexium >= 70 && tryUpgrade(g, l1)) { acted = true; continue; }
      }
    }
  };
}

// Generic bot for unknown maps: fills buildable cells near the path entry
// (top of map first) with a mixed comp (sentinel/thunder/hawk/shockwave),
// skipping types restricted on the current map, then upgrades.
const GENERIC_MIX = [0, 0, 1, 0, 2, 0, 1, 2, 0, 1, 5, 0, 2, 1];
export function makeGenericBot(g, maxTowers = 14) {
  let placed = 0;
  return {
    play() {
      let acted = true, guard = 0;
      while (acted && guard++ < 250) {
        acted = false;
        const s = botState(g);
        const l0 = s.towers.findIndex(t => t.level === 0);
        if (l0 >= 0 && s.nexium >= 40 && tryUpgrade(g, l0)) { acted = true; continue; }
        if (placed < maxTowers && placed < GENERIC_MIX.length) {
          const cells = g.window._getValidCells();
          cells.sort((a, b) => (a.row - b.row) || (a.col - b.col));
          const tp = GENERIC_MIX[placed];
          const cell = cells[0];
          if (cell && TT_COST[tp] <= s.nexium) {
            tryPlace(g, cell.col, cell.row, tp); // false => restricted type; skip it
            placed++; acted = true; continue;
          }
          if (!cell) placed = GENERIC_MIX.length;
        }
        const l1 = s.towers.findIndex(t => t.level === 1);
        if (l1 >= 0 && s.nexium >= 70 && tryUpgrade(g, l1)) { acted = true; continue; }
      }
    }
  };
}

export function runBotWave(g, maxSec = 180) {
  const W = 390, H = 844;
  tapBtn(g, 'startWave');
  g.tap(W / 2, H / 2); g.frame(2);
  let f = 0;
  while (botState(g).phase === 'wave' && f++ < maxSec * 60) g.frame(1);
  const s = botState(g);
  if (s.phase === 'waveSummary') { g.tap(W / 2, H / 2); g.frame(2); }
  return botState(g);
}
