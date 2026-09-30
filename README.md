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
- Helix Store with cosmetic skins, bundles, and simulated IAP (daily first-win and win-streak credit bonuses)
- 10 achievements, tower mastery, commander levels, and ELO-ranked Sector Clash
- Touch-optimized controls for mobile play
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
npm test             # 85 headless VM tests (~70s, no browser needed)
npm run test:browser # real-browser smoke, Chromium + WebKit (iOS Safari core)
                     # (needs: npx playwright install chromium-headless-shell webkit)
node tools/balance-audit.mjs  # live balance report: tower ROI, wave economies,
                              # bot margins per difficulty, exploit probes, card audit
```

Findings and prioritized fixes live in BALANCE_REVIEW.md (round 36 measured critique) and MODE_REVIEW.md (round 34 mode-logic critique).

Covers: match economy (one-time finalization, damage-driven income with per-enemy caps and no time bonuses), offense-mode tower targeting, Clash attack unit movement, mode-flag leak prevention, endless restart, store purchases, hero deployment, pause/settings navigation, a full build→wave→summary loop, crash-free rendering of every screen, the guided tutorial end-to-end, and machine-verified winnability: bots win Classic on **all four difficulties** (40 waves each, including Legendary via a level-20 save), a fortress assault with bio-abilities, a Helix War attack+defend cycle, a full Sector Clash match, the 30-wave Allied Defense co-op, 25 endless waves, hero ability integration, and save/purchase/settings persistence across an app restart.

## License

MIT
