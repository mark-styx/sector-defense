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

- 10 tower types with upgrade paths and cosmetic skins
- 12 enemy types across 3 biomes (Urban, Volcanic, Arctic)
- 18 Arsenal Cards — equip 3 as a loadout for passive bonuses
- 4 difficulty levels (Recruit → Veteran → Commander → Legendary)
- Touch-optimized controls for mobile play
- All state managed in-memory (no localStorage required)

## Running Locally

Just serve `index.html` with any static file server:

```bash
npx serve . -l 3000
```

Then open `http://localhost:3000` on your phone or in a mobile-sized browser window.

## Tech Stack

- Vanilla HTML5 Canvas + JavaScript (single file, zero dependencies)
- Fonts: JetBrains Mono (display) + Inter (body) via Google Fonts

## License

MIT
