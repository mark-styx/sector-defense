// Cloud sync client: identity minting, push/pull last-write-wins, offline
// behavior, score submission and the leaderboard screen. fetch is stubbed
// inside the VM; the seeded Math (no window.crypto in the harness) makes
// identity generation deterministic per boot.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot} from './harness.mjs';

const clone = x => JSON.parse(JSON.stringify(x));

async function stubbed(g, respond) {
  g.evaluate(`
    globalThis.__calls = [];
    globalThis.__respond = ${respond};
    globalThis.fetch = async (url, opts) => {
      globalThis.__calls.push({ url: '' + url, method: (opts && opts.method) || 'GET',
        headers: opts && opts.headers, body: opts && opts.body });
      return globalThis.__respond(url, opts);
    };
  `);
}

async function flush(n = 6) { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); }

test('cloud stays dormant when unconfigured or disabled', async () => {
  const g = await boot();
  let calls = 0;
  await stubbed(g, `async () => { return { ok: true, status: 200, json: async () => ({ ok: true }) }; }`);
  // enabled but no API URL configured (pre-deploy default)
  g.evaluate("settings.cloudSync = true; saveAllState(); cloudPush();");
  await flush();
  calls = clone(g.evaluate('globalThis.__calls.length'));
  assert.equal(calls, 0, 'no URL configured: nothing leaves the device');
  g.evaluate("settings.cloudApi = 'http://cloud.test'; settings.cloudSync = false; cloudPush();");
  await flush();
  assert.equal(clone(g.evaluate('globalThis.__calls.length')), 0, 'toggled off: nothing sent');
});

test('first enable mints an identity and registers it', async () => {
  const g = await boot();
  await stubbed(g, `async () => ({ ok: true, status: 200, json: async () => ({ ok: true, created: true }) })`);
  g.evaluate("settings.cloudApi = 'http://cloud.test'; ensureCloudIdentity();");
  await flush();
  const id = g.evaluate('cloud.userId'), secret = g.evaluate('cloud.secret');
  assert.match(id, /^[0-9a-f]{12}$/, '12-hex user id');
  assert.match(secret, /^[0-9a-f]{40}$/, '40-hex secret');
  const calls = clone(g.evaluate('globalThis.__calls'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://cloud.test/v1/account');
  const body = JSON.parse(calls[0].body);
  assert.equal(body.userId, id);
  assert.equal(body.secret, secret);
  // identity persisted for next boot
  const stored = g.evaluate("window.localStorage.getItem('sd_cloud_id')");
  assert.equal(JSON.parse(stored).userId, id);
});

test('cloudPush sends the full blob with a fresh timestamp and bearer auth', async () => {
  const g = await boot();
  await stubbed(g, `async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })`);
  g.evaluate("settings.cloudApi = 'http://cloud.test'; ensureCloudIdentity();");
  await flush();
  g.evaluate('globalThis.__calls.length = 0;');
  g.evaluate('prog.level = 12; saveAllState(); cloudPush();');
  await flush();
  const calls = clone(g.evaluate('globalThis.__calls'));
  assert.equal(calls.length, 1);
  const c = calls[0];
  assert.equal(c.method, 'PUT');
  assert.equal(c.url, 'http://cloud.test/v1/save');
  assert.match(c.headers.Authorization, /^Bearer [0-9a-f]{12}:[0-9a-f]{40}$/);
  const blob = JSON.parse(c.body);
  assert.equal(blob.prog.level, 12);
  assert.ok(blob.updatedAt > 0, 'blob carries LWW timestamp');
  assert.equal(clone(g.evaluate('cloud.status')), 'synced');
});

test('cloudPull applies a strictly newer cloud copy', async () => {
  const g = await boot();
  const newer = Date.now() + 60000;
  await stubbed(g, `async () => ({ ok: true, status: 200, json: async () => ({
    ok: true, updatedAt: ${newer}, blob: { prog: { level: 42, totalStars: 7 },
      settings: { sfxVol: 99 }, achievements: ['first_blood'] } }) })`);
  g.evaluate("settings.cloudApi = 'http://cloud.test'; ensureCloudIdentity(); cloud.localUpdatedAt = 1;");
  await flush();
  g.evaluate('globalThis.__calls.length = 0;');
  g.evaluate('cloudPull();');
  await flush();
  assert.equal(g.evaluate('prog.level'), 42, 'profile replaced by cloud copy');
  assert.equal(g.evaluate('prog.totalStars'), 7);
  assert.equal(g.evaluate('settings.sfxVol'), 99, 'settings merged through sanitizer');
  assert.equal(g.evaluate("achievements.unlocked.has('first_blood')"), true);
  assert.equal(g.evaluate('cloud.status'), 'synced');
  // applied copy persisted locally (echo push is fine, pull applied first)
  const stored = JSON.parse(g.evaluate("window.localStorage.getItem('sd_prog')"));
  assert.equal(stored.level, 42);
});

test('cloudPull ignores an older or equal cloud copy', async () => {
  const g = await boot();
  const older = Date.now() - 60000;
  await stubbed(g, `async () => ({ ok: true, status: 200, json: async () => ({
    ok: true, updatedAt: ${older}, blob: { prog: { level: 99 } } }) })`);
  g.evaluate("settings.cloudApi = 'http://cloud.test'; ensureCloudIdentity();");
  await flush();
  g.evaluate('prog.level = 3; saveAllState(); cloudPull();');
  await flush();
  assert.equal(g.evaluate('prog.level'), 3, 'local state wins against stale cloud');
});

test('offline and error responses never disturb the game', async () => {
  const g = await boot();
  await stubbed(g, `async () => { throw new Error('network down'); }`);
  g.evaluate("settings.cloudApi = 'http://cloud.test'; ensureCloudIdentity();");
  await flush();
  assert.equal(clone(g.evaluate('cloud.status')), 'offline');
  g.evaluate('prog.level = 5; saveAllState(); cloudPush();');
  await flush();
  assert.equal(clone(g.evaluate('cloud.status')), 'offline');
  assert.equal(g.evaluate('prog.level'), 5, 'local save untouched');
  // 401 → conflict status, still no crash
  g.evaluate("globalThis.__respond = async () => ({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) });");
  g.evaluate('cloudPush();');
  await flush();
  assert.equal(clone(g.evaluate('cloud.status')), 'conflict');
});

test('finalized classic matches submit one leaderboard score', async () => {
  const g = await boot();
  await stubbed(g, `async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })`);
  g.evaluate("settings.cloudApi = 'http://cloud.test'; ensureCloudIdentity();");
  await flush();
  g.evaluate('globalThis.__calls.length = 0;');
  g.evaluate(`
    G.mapIdx = 0; G.diffIdx = 0; startGame(); G.phase = 'build';
    G.wave = 40; G.lives = G.maxLives; G.totalKills = 10;
    finalizeMatch(true);`);
  await flush();
  const calls = clone(g.evaluate('globalThis.__calls')).filter(c => c.url.endsWith('/v1/scores'));
  assert.equal(calls.length, 1, 'exactly one score submission');
  const body = JSON.parse(calls[0].body);
  assert.equal(body.map, g.evaluate('MAPS[0].id'));
  assert.equal(body.diff, 'standard');
  assert.equal(body.score, 40 * 10 + 3, 'wave*10 + 3 stars for a full-life win');
  assert.equal(body.wave, 40);
  assert.equal(body.victory, true);
  assert.match(body.name, /^CMDR-[0-9A-F]{4}·L\d+$/);
});

test('leaderboard screen renders rows, selectors cycle boards', async () => {
  const g = await boot();
  g.evaluate(`
    settings.cloudApi = 'http://cloud.test';
    leaderboard.rows = [
      { rank: 1, name: 'CMDR-AAAA·L9', score: 403, wave: 40, victory: true },
      { rank: 2, name: 'CMDR-BBBB·L7', score: 381, wave: 38, victory: false },
      { rank: 3, name: 'CMDR-CCCC·L5', score: 260, wave: 26, victory: false }
    ];
    G.phase = 'leaderboard';`);
  g.frame(1);
  assert.ok(g.evaluate('G._btns.lbBack'), 'back button present');
  assert.ok(g.evaluate('G._btns.lbMapNext'));
  const nMaps = g.evaluate('MAPS.length');
  g.evaluate('leaderboard.mapIdx = ' + (nMaps - 1) + ';');
  g.evaluate("G._btns.lbMapNext && (() => {})()");
  // tap the projected next button
  const btn = clone(g.evaluate('G._btns.lbMapNext'));
  g.tap(btn.x + btn.w / 2, btn.y + btn.h / 2);
  g.frame(1);
  assert.equal(g.evaluate('leaderboard.mapIdx'), 0, 'map selector wraps');
  const btn2 = clone(g.evaluate('G._btns.lbDiffNext'));
  g.tap(btn2.x + btn2.w / 2, btn2.y + btn2.h / 2);
  g.frame(1);
  assert.equal(g.evaluate('leaderboard.diffIdx'), 1, 'diff selector advances');
  // back returns to menu
  const back = clone(g.evaluate('G._btns.lbBack'));
  g.tap(back.x + back.w / 2, back.y + back.h / 2);
  g.frame(1);
  assert.equal(g.evaluate('G.phase'), 'menu');
});

test('menu exposes the leaderboard entry and settings exposes cloud sync', async () => {
  const g = await boot();
  g.evaluate("G.phase='menu';");
  g.frame(1);
  assert.ok(g.evaluate('G._btns.menuLeaderboard'), 'menu button exists');
  g.evaluate("G.phase='settings';");
  g.frame(1);
  const opts = clone(g.evaluate('G._btns.settingsOpts'));
  assert.equal(opts.length, 10, '10 settings rows incl. Cloud Sync');
  const cloud = opts[9];
  g.tap(cloud.x + cloud.w / 2, cloud.y + cloud.h / 2);
  g.frame(1);
  assert.equal(g.evaluate('settings.cloudSync'), false, 'tap toggles cloud sync off');
});
