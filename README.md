# Sector Defense

A fully-featured tower defense game set in **The Helix Sector** — a sci-fi universe where three factions battle for control: the disciplined **Vanguard Coalition**, the relentless **Swarm Collective**, and the enigmatic **Ascended**.

Built as a single-file HTML5 Canvas game, optimized for iPhone (390×844 portrait).

## Game Modes

- **Classic Defense** — Traditional tower defense across 10 maps and 40 waves. Place towers, upgrade them, and survive increasingly difficult enemy waves.
- **Endless Mode** — No wave limit. Survive as long as you can with scaling difficulty.
- **The Helix War** — A strategic campaign inspired by BFME2's War of the Ring. Control territories on a 20-hex map, manage resources and Action Points, recruit armies, and conquer the sector turn by turn.
- **Swarm Commander** — Play offense. Spawn waves of units to overwhelm enemy defenses. Choose your composition and timing wisely.
- **Allied Defense** — Co-op tower defense with an AI ally. Coordinate tower placement and share resources.
- **Sector Clash** — PvP simulation. Build defenses and send attacks against an AI opponent simultaneously.

## Features

- 10 tower types with upgrade paths (levels visibly armor up and grow towers) and cosmetic skins
- 12 enemy types across 3 biomes (Urban, Volcanic, Arctic)
- 18 Arsenal Cards — equip 3 as a loadout for passive bonuses
- 4 difficulty levels (Standard → Veteran → Elite → Legendary; all stat and economy axes disclosed on the select card)
- Damage-driven economy: Nexium flows from damage dealt to enemies (capped per enemy), kills pay a bonus kicker, and Swarm Commander bio income scales with lane progress
- Classic waves escalate with progress (+1.8% enemy HP per wave, ~2x by wave 40) so rising income buys harder fights
- Tower special abilities unlock per tower with ◆ and then auto-fire on tactical triggers — no tower-by-tower micro
- 5 playable heroes with distinct animated art, auto-pilot or tap-to-control movement, aimable abilities, and persistent XP/leveling
- Enemy attacks visibly travel to heroes; health loss, hit flashes, and damage numbers occur on contact. Stunned, burrowed, and phased enemies cannot launch attacks.
- Siege Crawlers fire damaging EMP bolts at nearby towers. Towers have 200 HP (+100 per upgrade), shut down at zero HP, and repair for free after each wave.
- Helix Store with cosmetic skins, bundles, and simulated IAP (daily first-win and win-streak credit bonuses)
- 10 achievements, tower mastery, commander levels, and ELO-ranked Sector Clash
- Touch-optimized controls for mobile play
- Deployment fast-forward: tap **DEPLOY »** during a defense wave to toggle 1×/3× enemy deployment without changing movement or combat speed. Resets each wave and stops when the queue is empty.
- Progress, purchases, and settings persist via localStorage

## Running Locally

Just serve `index.html` with any static file server:

```bash
npx serve . -l 8021
```

Then open `http://localhost:8021` on your phone or in a mobile-sized browser window.

## Tech Stack

- Vanilla HTML5 Canvas + JavaScript (single file, zero dependencies)
- Fonts: JetBrains Mono (display) + Inter (body) via Google Fonts

## Testing

Two layers:

```bash
npm test             # 107 headless VM tests (~75s, no browser needed; deterministic seeded RNG)
npm run test:browser # real-browser smoke, Chromium + WebKit (iOS Safari core)
                     # (needs: npx playwright install chromium-headless-shell webkit)
node tools/balance-audit.mjs  # live balance report: tower ROI, wave economies,
                              # bot margins per difficulty, exploit probes, card audit
```

Findings and prioritized fixes live in BALANCE_REVIEW.md (round 36 measured critique) and MODE_REVIEW.md (round 34 mode-logic critique).

Covers: match economy (one-time finalization, damage-driven income with per-enemy caps and no time bonuses), offense-mode tower targeting, Clash attack unit movement, mode-flag leak prevention, endless restart, store purchases, hero deployment, pause/settings navigation, a full build→wave→summary loop, crash-free rendering of every screen, the guided tutorial end-to-end, and machine-verified winnability: bots win Classic on **all four difficulties** (40 waves each, including Legendary via a level-20 save), a fortress assault with bio-abilities, a Helix War attack+defend cycle, a full Sector Clash match, the 30-wave Allied Defense co-op, 25 endless waves, hero ability integration, and save/purchase/settings persistence across an app restart.

Combat regressions also cover damage only on projectile contact, point-blank attack visibility, Warden reflection, armor, hero death, stun/burrow/phase gating, pause/restart cleanup, tower durability/upgrades, free wave-end repairs, and shots targeting sold towers. Browser tests verify incoming bolts draw real canvas pixels in Chromium and WebKit, and capture flight, impact, and offline-tower screenshots in `test-artifacts/`.

Deployment tests verify faster spawning with unchanged enemy movement, pause behavior, queue completion, per-wave reset across all defense modes, and phone-sized touch targets. Chromium and WebKit also exercise the deployment control through touch events.

## License

MIT
