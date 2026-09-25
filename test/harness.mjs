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
