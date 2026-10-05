import test from 'node:test';
import assert from 'node:assert/strict';
import {boot} from './harness.mjs';

test('all ten maps have a distinct location-art direction', async () => {
  const g = await boot();
  const art = g.window._getMapArtDefs();
  assert.equal(art.length, 10);
  assert.equal(new Set(art.map(a => a.motif)).size, 10, 'no map reuses a generic motif');
  assert.equal(new Set(art.map(a => a.label)).size, 10, 'every map has its own location label');
  for (const a of art) {
    assert.ok(a.dark && a.mid && a.light, `${a.id} has a complete environment palette`);
  }
});

test('every enemy type routes to detailed vector art', async () => {
  const g = await boot();
  const coverage = g.window._getEnemyArtCoverage();
  assert.ok(coverage.length >= 12, 'full enemy roster is present');
  assert.deepEqual(coverage.filter(e => !e.detailed), [],
    `missing illustrated enemies: ${coverage.filter(e => !e.detailed).map(e => e.type).join(', ')}`);
});
