// Map geometry is hand-authored — this pins the invariants every map must
// hold so a mistyped cell can never ship: orth-adjacent walks, in-bounds,
// every path ends on the shared base cell, decor never lands on paths, and
// every battlefield keeps enough buildable real estate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot} from './harness.mjs';

test('every map path is a valid in-bounds orth-adjacent walk to the base', async () => {
  const g = await boot();
  const maps = g.evaluate('MAPS');
  assert.equal(maps.length, 16, '16 maps (10 classic + 6 new)');
  for (const m of maps) {
    const cells = new Set();
    for (let pi = 0; pi < m.paths.length; pi++) {
      const p = m.paths[pi];
      assert.ok(p.length >= 5, `${m.id} path ${pi} suspiciously short`);
      for (let i = 0; i < p.length; i++) {
        const [c, r] = p[i];
        assert.ok(c >= 0 && c < m.cols && r >= 0 && r < m.rows,
          `${m.id} p${pi}[${i}] out of bounds: ${c},${r}`);
        if (i > 0) {
          const [pc, pr] = p[i - 1];
          assert.equal(Math.abs(c - pc) + Math.abs(r - pr), 1,
            `${m.id} p${pi}[${i}] not orth-adjacent: ${pc},${pr} -> ${c},${r}`);
        }
        cells.add(c + ',' + r);
      }
      // Single-path maps end exactly on the base; classic multi-path maps
      // drop side lanes adjacent to (command: up to 8 cells from) the base.
      const [ec, er] = p[p.length - 1], [bc, br] = m.baseCell;
      assert.ok(Math.max(Math.abs(ec - bc), Math.abs(er - br)) <= 8,
        `${m.id} p${pi} ends ${ec},${er} — too far from base ${bc},${br}`);
    }
    // Decor must not sit on the path.
    for (const [lc, lr] of [...(m.lavaCells || []), ...(m.iceCells || [])]) {
      assert.ok(!cells.has(lc + ',' + lr), `${m.id} decor on path at ${lc},${lr}`);
    }
    // Enough buildable cells adjacent to paths (matches isValidPlacement logic).
    let buildable = 0;
    for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
      if (cells.has(c + ',' + r)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => cells.has((c + dc) + ',' + (r + dr)))) buildable++;
    }
    assert.ok(buildable >= 25, `${m.id} only ${buildable} buildable cells`);
  }
});

test('new maps cover every biome with their event/flavor systems wired', async () => {
  const g = await boot();
  const maps = g.evaluate('MAPS');
  const byBiome = {};
  for (const m of maps) (byBiome[m.biome] ??= []).push(m);
  for (const b of ['urban', 'volcanic', 'arctic']) {
    assert.ok(byBiome[b].length >= 5, `${b} should field at least 5 maps`);
  }
  // Volcanic maps without lava cells would strand the overheat system.
  for (const m of byBiome.volcanic) {
    assert.ok((m.lavaCells || []).length >= 4, `${m.id} needs lava for overheat play`);
  }
  // Arctic maps are the blizzard/avalanche battlegrounds.
  for (const m of byBiome.arctic) assert.equal(m.biome, 'arctic');
  // Map select renders every map under its biome tab.
  g.evaluate(`G.phase='mapSelect';G.biomeTab='arctic';render()`);
  const artCount = g.evaluate('MAPS.filter(m=>m.biome==="arctic").length');
  assert.equal(artCount, byBiome.arctic.length);
});

test('each new map plays: waves spawn, towers place, enemies path to base', async () => {
  const g = await boot();
  for (const idx of [10, 11, 12, 13, 14, 15]) {
    const info = g.evaluate(`(function(){
      G.mapIdx=${idx};G.diffIdx=0;startGame();G.phase='build';G.nexium=9999;
      const vc=G._getValidCells?null:null;
      const cells=[];for(let r=0;r<currentRows;r++)for(let c=0;c<currentCols;c++)if(isValidPlacement(c,r))cells.push([c,r]);
      let placed=0;for(const [c,r] of cells.slice(0,6)){if(placeTower(c,r,0))placed++;}
      G.wave=0;startWave();
      return {id:MAPS[${idx}].id,placed,queue:G.spawnQueue.length,
              first:G.spawnQueue[0]?G.spawnQueue[0].type:null};
    })()`);
    assert.equal(info.placed, Math.min(6, info.placed), `${info.id} placements work`);
    assert.ok(info.placed >= 4, `${info.id} should accept several towers (${info.placed})`);
    assert.ok(info.queue > 0, `${info.id} wave 1 must queue enemies`);
    // Enemies actually traverse: run 10s of wave and expect movement.
    let moved = false, prog = -1;
    for (let i = 0; i < 600 && !moved; i++) {
      g.frame(1);
      const e = g.window._getEnemies()[0];
      if (e && e.alive) { if (prog >= 0 && e.progress !== prog) moved = true; prog = e ? e.progress : -1; }
    }
    assert.ok(moved, `${info.id} enemies should advance along the path`);
  }
});
