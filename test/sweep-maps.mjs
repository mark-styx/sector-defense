// One-off evidence sweep: remaining 6 maps at Standard (results go in progress.md).
import {boot, tapBtn, center, makeGenericBot, runBotWave} from './harness.mjs';

function state(g) { return JSON.parse(g.window.render_game_to_text()); }

async function runMap(mapIdx, label) {
  const g = await boot();
  tapBtn(g, 'menuPlay');
  let target = g.window._getBtns().maps.find(m => m.origIdx === mapIdx);
  if (!target) {
    const tabs = g.window._getBtns().biomeTabs;
    for (let i = 1; i < 3 && !target; i++) {
      const t = tabs[i]; g.tap(center(t).x, center(t).y); g.frame(2);
      target = g.window._getBtns().maps.find(m => m.origIdx === mapIdx);
    }
  }
  const mc = center(target); g.tap(mc.x, mc.y); g.frame(2);
  const diffs = g.window._getBtns().diffs;
  const d = diffs.find(x => x.idx === 0);
  const dc = center(d); g.tap(dc.x, dc.y); g.frame(2);
  tapBtn(g, 'heroNone');
  tapBtn(g, 'heroDeploy');
  g.window._setGameState('gameSpeed', 3);
  const bot = makeGenericBot(g, 14);
  let last = null;
  for (let w = 1; w <= 40; w++) {
    if (state(g).phase !== 'build') break;
    bot.play();
    last = runBotWave(g, 300);
    if (last.phase !== 'build') break;
  }
  console.log(`${label}: ${last.phase} wave=${last.wave} lives=${last.lives}/${last.lives + (25 - last.lives) * 0 || last.lives} towers=${last.towerCount}`);
}

await runMap(1, 'Transit Hub   (2 paths converge) ');
await runMap(2, 'Skyline       (zigzag, restricted)');
await runMap(4, 'Ember Pass    (easy volcanic)     ');
await runMap(5, 'Caldera       (spiral, restricted)');
await runMap(7, 'Frozen Reach  (easy arctic)       ');
await runMap(8, 'Glacial Rift  (2 crossing paths)  ');
