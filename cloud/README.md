# Sector Defense cloud API (Cloudflare Worker + D1)

Save sync + leaderboards. The game treats the cloud as a mirror, never the
source of truth: local `localStorage` always wins on-device, the cloud copy is
last-write-wins by client timestamp, and a device only *accepts* cloud state at
launch when it is strictly newer than the local copy.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/v1/health` | none | liveness |
| POST | `/v1/account` | none | register/verify device (`{userId, secret}`) |
| GET | `/v1/save` | bearer | fetch cloud save |
| PUT | `/v1/save` | bearer | store save (LWW on `updatedAt`) |
| POST | `/v1/scores` | bearer | submit finished run (rate limited) |
| GET | `/v1/scores?map=&diff=&limit=` | none | leaderboard |

Auth header: `Authorization: Bearer <userId>:<secret>`. Both are generated on
device; the server stores only `sha256(secret + ':' + userId)`.

## Local development

```bash
cd cloud
npm install            # pulls wrangler
npx wrangler d1 migrations apply sector-defense --local
npm run dev            # http://localhost:8787
node smoke.mjs         # end-to-end check against the local dev server
```

Local dev needs no Cloudflare account (Miniflare emulates D1 with SQLite).

## Deploy (one time setup)

```bash
cd cloud
npx wrangler login                          # browser auth, done once
npx wrangler d1 create sector-defense       # paste database_id into wrangler.toml
npx wrangler d1 migrations apply sector-defense --remote
npx wrangler deploy                         # prints https://sector-defense-api.<account>.workers.dev
node smoke.mjs https://sector-defense-api.<account>.workers.dev
```

Then paste that URL into `CLOUD_API_DEFAULT` in `../index.html` (or set
`settings.cloudApi` from the console for a quick device test) and rebuild.

## Notes

- Free tier ceilings are ~1000x current usage: 100k req/day (Workers),
  100k row writes/day and 5M row reads/day (D1), 5 GB storage.
- `smoke.mjs` exercises register → save → LWW conflict → pull → score post →
  leaderboard read, and asserts the rate limiter rejects a 7th score/minute.
