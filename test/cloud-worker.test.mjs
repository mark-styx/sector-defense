// Worker unit tests: routing, auth, LWW save sync, score validation and
// rate limiting against an in-memory D1 shim (the real SQLite semantics are
// exercised by cloud/smoke.mjs against wrangler dev / the deployed URL).
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloud/src/worker.js';

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto;
}

const hex = n => [...webcryptoBytes(n)].map(b => b.toString(16).padStart(2, '0')).join('');
function webcryptoBytes(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

function makeDB() {
  const accounts = new Map(), saves = new Map(), scores = [];
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('SELECT secret_hash FROM accounts')) return accounts.get(args[0]) || null;
              if (sql.includes('SELECT updated_at FROM saves')) return saves.get(args[0]) || null;
              if (sql.includes('SELECT blob, updated_at FROM saves')) return saves.get(args[0]) || null;
              if (sql.includes('SUM(created_at')) {
                const now = Date.now();
                let recent = 0, today = 0;
                for (const s of scores) if (s.user_id === args[2]) {
                  if (s.created_at > now - 60000) recent++;
                  if (s.created_at > now - 86400000) today++;
                }
                return { recent, today };
              }
              throw new Error('unmatched first(): ' + sql);
            },
            async all() {
              if (sql.includes('ORDER BY score DESC')) {
                const [m, d, l] = args;
                const rows = scores
                  .filter(s => s.map_id === m && s.diff_id === d)
                  .sort((a, b) => b.score - a.score || a.created_at - b.created_at)
                  .slice(0, l)
                  .map(s => ({ name: s.name, score: s.score, wave: s.wave, victory: s.victory, created_at: s.created_at }));
                return { results: rows };
              }
              throw new Error('unmatched all(): ' + sql);
            },
            async run() {
              if (sql.includes('INSERT INTO accounts')) { accounts.set(args[0], { secret_hash: args[1] }); return {}; }
              if (sql.includes('UPDATE accounts')) { const r = accounts.get(args[1]); if (r) r.last_seen_at = args[0]; return {}; }
              if (sql.includes('INTO saves')) { saves.set(args[0], { blob: args[1], updated_at: args[2], bytes: args[3] }); return {}; }
              if (sql.includes('INSERT INTO scores')) {
                scores.push({ user_id: args[0], name: args[1], map_id: args[2], diff_id: args[3],
                  score: args[4], wave: args[5], victory: args[6], created_at: args[7] });
                return {};
              }
              throw new Error('unmatched run(): ' + sql);
            }
          };
        }
      };
    }
  };
  return { db, state: { accounts, saves, scores } };
}

async function call(db, method, path, body, headers = {}) {
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(
    new Request('https://api.test' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    { DB: db }
  );
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
}

async function newUser(db) {
  const userId = hex(6), secret = hex(20);
  const r = await call(db, 'POST', '/v1/account', { userId, secret });
  assert.equal(r.status, 200);
  return { userId, secret, auth: { Authorization: `Bearer ${userId}:${secret}` } };
}

test('health + CORS preflight + 404', async () => {
  const { db } = makeDB();
  assert.equal((await call(db, 'GET', '/v1/health', undefined, {})).json.ok, true);
  const pre = await worker.fetch(new Request('https://api.test/v1/save', { method: 'OPTIONS' }), { DB: db });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), '*');
  assert.ok(pre.headers.get('Access-Control-Allow-Headers').includes('Authorization'));
  assert.equal((await call(db, 'GET', '/v1/nope', undefined, {})).status, 404);
});

test('accounts: create, verify, reject mismatched secret', async () => {
  const { db } = makeDB();
  const userId = hex(6), secret = hex(20);
  const made = await call(db, 'POST', '/v1/account', { userId, secret });
  assert.equal(made.json.created, true);
  const again = await call(db, 'POST', '/v1/account', { userId, secret });
  assert.equal(again.json.created, false);
  const bad = await call(db, 'POST', '/v1/account', { userId, secret: hex(20) });
  assert.equal(bad.status, 401);
  const malformed = await call(db, 'POST', '/v1/account', { userId: 'nothex', secret });
  assert.equal(malformed.status, 400);
});

test('save sync: empty, push, LWW, pull, auth', async () => {
  const { db } = makeDB();
  const u = await newUser(db);
  const empty = await call(db, 'GET', '/v1/save', undefined, u.auth);
  assert.equal(empty.json.empty, true);

  const push = await call(db, 'PUT', '/v1/save', { prog: { level: 3 }, updatedAt: 2000 }, u.auth);
  assert.equal(push.json.stale, false);
  const stale = await call(db, 'PUT', '/v1/save', { prog: { level: 1 }, updatedAt: 1500 }, u.auth);
  assert.equal(stale.json.stale, true, 'older timestamp rejected');
  const equal = await call(db, 'PUT', '/v1/save', { prog: { level: 9 }, updatedAt: 2000 }, u.auth);
  assert.equal(equal.json.stale, true, 'equal timestamp rejected (idempotent redo is a no-op)');

  const pull = await call(db, 'GET', '/v1/save', undefined, u.auth);
  assert.equal(pull.json.updatedAt, 2000);
  assert.equal(pull.json.blob.prog.level, 3);

  assert.equal((await call(db, 'GET', '/v1/save', undefined, {})).status, 401);
  assert.equal((await call(db, 'GET', '/v1/save', undefined, { Authorization: 'Bearer ' + hex(6) + ':' + hex(20) })).status, 401);
  assert.equal((await call(db, 'PUT', '/v1/save', { updatedAt: 3000 }, u.auth)).status, 400, 'blob without prog rejected');
  const huge = { prog: { x: 'a'.repeat(300000) }, updatedAt: 3000 };
  assert.equal((await call(db, 'PUT', '/v1/save', huge, u.auth)).status, 413);
});

test('scores: validate, sanitize, rank, rate limit', async () => {
  const { db, state } = makeDB();
  const u = await newUser(db);
  const post = body => call(db, 'POST', '/v1/scores', body, u.auth);

  for (let i = 0; i < 6; i++) {
    const r = await post({ map: 'ashfall', diff: 'elite', score: 400 - i, wave: 40, victory: i === 0, name: 'CMDR-TEST·L9 <script>' });
    assert.equal(r.status, 200);
  }
  const limited = await post({ map: 'ashfall', diff: 'elite', score: 1, wave: 1, name: 'x' });
  assert.equal(limited.status, 429, '7th submission inside a minute is rejected');
  assert.equal(state.scores[0].name.includes('<'), false, 'name sanitized');
  assert.equal(state.scores[0].name.length <= 16, true);

  const board = await call(db, 'GET', '/v1/scores?map=ashfall&diff=elite&limit=10', undefined, {});
  assert.equal(board.json.rows.length, 6);
  assert.equal(board.json.rows[0].score, 400);
  assert.equal(board.json.rows[0].victory, true);
  assert.deepEqual(board.json.rows.map(r => r.rank), [1, 2, 3, 4, 5, 6]);

  assert.equal((await post({ map: '../evil', diff: 'elite', score: 1, wave: 1 })).status, 400);
  assert.equal((await post({ map: 'ashfall', diff: 'elite', score: 'abc', wave: 1 })).status, 400);
  assert.equal((await call(db, 'GET', '/v1/scores?map=ashfall&diff=elite&limit=999', undefined, {})).json.rows.length, 6, 'limit clamped, query fine');
});
