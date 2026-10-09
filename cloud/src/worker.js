// Sector Defense cloud API.
// Cloudflare Worker + D1. Endpoints (all under /v1, all CORS-open — auth is a
// per-account bearer token, no ambient credentials, so "*" is safe):
//   GET  /v1/health          liveness
//   POST /v1/account         {userId, secret} → register or verify device
//   GET  /v1/save            auth → {updatedAt, blob} | {empty}
//   PUT  /v1/save            auth → LWW store of full client state
//   POST /v1/scores          auth → submit a finished run (rate limited)
//   GET  /v1/scores?map&diff leaderboard read, public

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};
const MAX_SAVE_BYTES = 262144;   // 256 KB, client blob is a few KB
const SCORE_PER_MIN = 6;
const SCORE_PER_DAY = 240;

const ID_RE = /^[0-9a-f]{12}$/;
const SECRET_RE = /^[0-9a-f]{40}$/;
const MAP_RE = /^[a-z0-9_]{1,32}$/;
const DIFF_RE = /^[a-z0-9_]{1,24}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseAuth(request) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer ([0-9a-f]{12}):([0-9a-f]{40})$/);
  return m ? { userId: m[1], secret: m[2] } : null;
}

async function authenticate(request, env) {
  const a = parseAuth(request);
  if (!a) return null;
  const hash = await sha256hex(a.secret + ':' + a.userId);
  const row = await env.DB
    .prepare('SELECT secret_hash FROM accounts WHERE user_id = ?')
    .bind(a.userId)
    .first();
  return row && row.secret_hash === hash ? { userId: a.userId } : null;
}

function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : fallback;
}

function cleanName(raw) {
  const s = String(raw || '').replace(/[^\w .\-·]/g, '').trim();
  return (s || 'ANON').slice(0, 16);
}

async function handleAccount(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const userId = String(body.userId || '');
  const secret = String(body.secret || '');
  if (!ID_RE.test(userId) || !SECRET_RE.test(secret)) return json({ error: 'bad_format' }, 400);
  const hash = await sha256hex(secret + ':' + userId);
  const now = Date.now();
  const existing = await env.DB
    .prepare('SELECT secret_hash FROM accounts WHERE user_id = ?')
    .bind(userId)
    .first();
  if (existing) {
    if (existing.secret_hash !== hash) return json({ error: 'secret_mismatch' }, 401);
    await env.DB
      .prepare('UPDATE accounts SET last_seen_at = ? WHERE user_id = ?')
      .bind(now, userId)
      .run();
    return json({ ok: true, userId, created: false });
  }
  await env.DB
    .prepare('INSERT INTO accounts (user_id, secret_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?)')
    .bind(userId, hash, now, now)
    .run();
  return json({ ok: true, userId, created: true });
}

async function handlePutSave(request, env, auth) {
  const raw = await request.text();
  if (raw.length > MAX_SAVE_BYTES) return json({ error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }
  if (!body || typeof body !== 'object' || !body.prog) return json({ error: 'bad_blob' }, 400);
  const updatedAt = clampInt(body.updatedAt, 0, 4102444800000, 0); // ≤ 2100
  if (!updatedAt) return json({ error: 'bad_timestamp' }, 400);

  const existing = await env.DB
    .prepare('SELECT updated_at FROM saves WHERE user_id = ?')
    .bind(auth.userId)
    .first();
  if (existing && updatedAt <= existing.updated_at) {
    return json({ ok: true, stale: true, updatedAt: existing.updated_at });
  }
  await env.DB
    .prepare(
      'INSERT INTO saves (user_id, blob, updated_at, bytes) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(user_id) DO UPDATE SET blob = excluded.blob, updated_at = excluded.updated_at, bytes = excluded.bytes'
    )
    .bind(auth.userId, raw, updatedAt, raw.length)
    .run();
  return json({ ok: true, stale: false, updatedAt });
}

async function handleGetSave(env, auth) {
  const row = await env.DB
    .prepare('SELECT blob, updated_at FROM saves WHERE user_id = ?')
    .bind(auth.userId)
    .first();
  if (!row) return json({ ok: true, empty: true });
  let blob;
  try { blob = JSON.parse(row.blob); } catch { return json({ error: 'corrupt_blob' }, 500); }
  return json({ ok: true, updatedAt: row.updated_at, blob });
}

async function handlePostScore(request, env, auth) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const mapId = String(body.map || '');
  const diffId = String(body.diff || '');
  if (!MAP_RE.test(mapId) || !DIFF_RE.test(diffId)) return json({ error: 'bad_board' }, 400);
  const score = clampInt(body.score, 0, 1000000, -1);
  const wave = clampInt(body.wave, 1, 9999, -1);
  if (score < 0 || wave < 0) return json({ error: 'bad_score' }, 400);
  const victory = body.victory ? 1 : 0;
  const name = cleanName(body.name);

  const now = Date.now();
  const rate = await env.DB
    .prepare(
      "SELECT SUM(created_at > ?) AS recent, SUM(created_at > ?) AS today FROM scores WHERE user_id = ?"
    )
    .bind(now - 60000, now - 86400000, auth.userId)
    .first();
  if ((rate.recent || 0) >= SCORE_PER_MIN) return json({ error: 'rate_limited_min' }, 429);
  if ((rate.today || 0) >= SCORE_PER_DAY) return json({ error: 'rate_limited_day' }, 429);

  await env.DB
    .prepare(
      'INSERT INTO scores (user_id, name, map_id, diff_id, score, wave, victory, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(auth.userId, name, mapId, diffId, score, wave, victory, now)
    .run();
  return json({ ok: true });
}

async function handleGetScores(url, env) {
  const mapId = url.searchParams.get('map') || '';
  const diffId = url.searchParams.get('diff') || '';
  if (!MAP_RE.test(mapId) || !DIFF_RE.test(diffId)) return json({ error: 'bad_board' }, 400);
  const limit = clampInt(url.searchParams.get('limit'), 1, 50, 25);
  const { results } = await env.DB
    .prepare(
      'SELECT name, score, wave, victory, created_at FROM scores ' +
      'WHERE map_id = ? AND diff_id = ? ORDER BY score DESC, created_at ASC LIMIT ?'
    )
    .bind(mapId, diffId, limit)
    .all();
  const rows = (results || []).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: r.score,
    wave: r.wave,
    victory: !!r.victory,
    createdAt: r.created_at
  }));
  return json({ ok: true, rows });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/v1/health') return json({ ok: true, ts: Date.now() });
      if (path === '/v1/account' && request.method === 'POST') return handleAccount(request, env);

      if (path === '/v1/save') {
        const auth = await authenticate(request, env);
        if (!auth) return json({ error: 'unauthorized' }, 401);
        if (request.method === 'PUT') return handlePutSave(request, env, auth);
        if (request.method === 'GET') return handleGetSave(env, auth);
      }

      if (path === '/v1/scores') {
        if (request.method === 'GET') return handleGetScores(url, env);
        const auth = await authenticate(request, env);
        if (!auth) return json({ error: 'unauthorized' }, 401);
        if (request.method === 'POST') return handlePostScore(request, env, auth);
      }

      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: 'internal' }, 500);
    }
  }
};
