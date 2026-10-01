// Final evidence edges: Elite on Absolute Zero; endless on volcanic/arctic.
import {boot, tapBtn, center, state, makeGenericBot, runBotWave} from './harness.mjs';


async function runClassic(mapIdx, diffIdx, label) {
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
  const d = diffs.find(x => x.idx === diffIdx);
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
  console.log(`${label}: ${last.phase} wave=${last.wave} lives=${last.lives}`);
}

async function runEndless(biomeIdx, label) {
  const g = await boot();
  tapBtn(g, 'menuEndless');
  const biomes = g.window._getBtns().biomes;
  const bc = center(biomes[biomeIdx]); g.tap(bc.x, bc.y); g.frame(2);
  g.window._setGameState('gameSpeed', 3);
  const bot = makeGenericBot(g, 14);
  let last = null;
  for (let w = 0; w < 30; w++) {
    if (state(g).phase !== 'build') break;
    bot.play();
    last = runBotWave(g, 300);
    if (last.phase !== 'build') break;
  }
  console.log(`${label}: ${last.phase} wave=${last.wave} lives=${last.lives}`);
}

await runClassic(9, 2, 'Absolute Zero / Elite (hardest map x hardest unlocked diff)');
await runEndless(1, 'Endless volcanic (30-wave target)');
await runEndless(2, 'Endless arctic   (30-wave target)');
