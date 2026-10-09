// End-to-end smoke test against a running Worker (local wrangler dev or
// deployed URL). Usage: node smoke.mjs [baseUrl]   (default localhost:8787)
const base = process.argv[2] || 'http://127.0.0.1:8787';
let failures = 0;
const ok = (cond, label) => {
  console.log((cond ? '  ok  ' : 'FAIL  ') + label);
  if (!cond) failures++;
};
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
const userId = hex(6), secret = hex(20);
const auth = { Authorization: `Bearer ${userId}:${secret}`, 'Content-Type': 'application/json' };

const r = async (method, path, body, headers = auth) => {
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};

// Health
const health = await r('GET', '/v1/health', null, {});
ok(health.status === 200 && health.json.ok, 'health');

// Register
const reg = await r('POST', '/v1/account', { userId, secret }, { 'Content-Type': 'application/json' });
ok(reg.status === 200 && reg.json.created, 'account created');
const reg2 = await r('POST', '/v1/account', { userId, secret }, { 'Content-Type': 'application/json' });
ok(reg2.status === 200 && !reg2.json.created, 'account re-verify');
const badSecret = await r('POST', '/v1/account', { userId, secret: hex(20) }, { 'Content-Type': 'application/json' });
ok(badSecret.status === 401, 'wrong secret rejected');

// Save: empty → push → pull → LWW
const empty = await r('GET', '/v1/save');
ok(empty.json && empty.json.empty, 'save empty on first pull');
const blob = { prog: { level: 7 }, updatedAt: 1000 };
const push = await r('PUT', '/v1/save', blob);
ok(push.status === 200 && !push.json.stale, 'save pushed');
const stale = await r('PUT', '/v1/save', { prog: { level: 1 }, updatedAt: 999 });
ok(stale.json && stale.json.stale, 'older push rejected (LWW)');
const pull = await r('GET', '/v1/save');
ok(pull.json.updatedAt === 1000 && pull.json.blob.prog.level === 7, 'pull returns newest blob');
const unauth = await fetch(base + '/v1/save');
ok(unauth.status === 401, 'save requires auth');

// Scores: post, leaderboard, rate limit
for (let i = 0; i < 6; i++) {
  const s = await r('POST', '/v1/scores', { map: 'inferno', diff: 'elite', score: 403 - i, wave: 40, victory: i === 0, name: 'SMOKE-' + i });
  ok(s.status === 200, 'score ' + (i + 1) + ' accepted');
}
const limited = await r('POST', '/v1/scores', { map: 'inferno', diff: 'elite', score: 1, wave: 1, name: 'X' });
ok(limited.status === 429, '7th score within a minute rate limited');
const board = await r('GET', '/v1/scores?map=inferno&diff=elite&limit=10', null, {});
ok(board.status === 200 && board.json.rows.length === 6, 'leaderboard has 6 rows');
ok(board.json.rows[0].score === 403 && board.json.rows[0].victory === true, 'leaderboard ordered');
const badBoard = await r('GET', '/v1/scores?map=../evil&diff=elite', null, {});
ok(badBoard.status === 400, 'bad board id rejected');

console.log(failures ? `\n${failures} FAILURES` : '\nall green');
process.exit(failures ? 1 : 0);
