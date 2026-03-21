# Sector Defense - Progress

Original prompt: build an iphone game that is a knockoff of starcraft2 tower defenses

## Phase 4: Interactive Tutorial + Accessibility — COMPLETE

### Changes Applied
- **Tutorial system**: 13-step guided intro across 3 waves
- **Tutorial state machine**: TUTORIAL object with start/advance/finish, waitingFor states (tap_cell, select_tower, start_wave, wait_wave_end, tap_tower, acknowledge)
- **Tutorial overlays**: Dim screen with cell cutouts, pulsing highlight borders, animated arrows, step indicator dots, message boxes with glow
- **Tutorial menu button**: Conditionally shown when tutorialDone===false, green glow, inserted via menuItems.unshift()
- **Tutorial tap interception**: Handles forced tower selection, cell restrictions, wave preview auto-start, waveSummary auto-skip
- **Reduce Motion**: Settings toggle, wraps VFX update/draw calls, skips screen shake, skips splash animation, skips env particles
- **Color Blind mode**: Settings toggle cycling off→deuteranopia→protanopia, getColorBlindColor() remapping, drawColorBlindMarker() symbol overlays
- **Settings screen**: 2 new rows (Reduce Motion ♿, Color Blind 👁) with tap handlers
- **prog.tutorialDone**: Persisted to localStorage, marks tutorial completion

### Bugs Found & Fixed During QA
- Tutorial blocked wavePreview tap during wait_wave_end → added passthrough for wavePreview phase
- Tutorial waveSummary never transitioned to build → moved auto-advance check to update() function before early-return
- Screen shake stuck after wave during tutorial → reset shakeTimer on waveSummary→build transition
- Tutorial said "40 waves" but game has 30 → changed to "all waves"

### Known Issues / TODOs for Next Phase
- Tutorial places extra towers due to rapid tap sequencing (cosmetic, doesn't break flow)
- Could add tutorial skip button for returning players
- Color blind markers could be more visible during fast gameplay
- Consider adding haptic feedback patterns for accessibility

---

## Phase 5: Hero System — COMPLETE

### Heroes Added
- **Commander Vex** (The Vanguard) — Shield shape, cyan. Passive: +15% tower damage in range. Ability: Battle Cry (AOE buff). Ultimate: Vanguard Override (massive damage boost)
- **Dr. Lyra Sol** (The Technomancer) — Diamond shape, magenta. Passive: -10% tower upgrade cost. Ability: Nano Repair (heal towers). Ultimate: Overdrive Protocol (all towers fire faster)
- **Kael Ironhart** (The Warden) — Hexagon shape, green. Passive: Enemies move 20% slower in range. Ability: Shield Wall (block path). Ultimate: Fortification (massive slow field)
- **Nyx Shade** (The Phantom) — Triangle shape, red. Passive: +25% damage to strongest enemy. Ability: Shadow Strike (instant kill weak enemies). Ultimate: Assassin's Mark (all enemies take extra damage)
- **Zara Prime** (The Oracle) — Star shape, gold. Passive: +2 Nexium/sec. Ability: Temporal Pulse (slow all enemies). Ultimate: Nexium Surge (big Nexium generation)

### Features
- Hero Selection screen between difficulty select and game start
- Hero Roster accessible from main menu ("HEROES" with NEW badge)
- Heroes render on battlefield with unique shape icons, health bars, name labels, range circles
- Active ability (Q button) with cooldown timers
- Ultimate ability (ULT button) with cooldown
- Passive abilities apply automatically in range
- Hero XP gained from kills in range
- Hero leveling with 5 level tiers, persistent across games
- Level bonuses (HP, range, ability damage, cooldown reduction, etc.)
- "No Hero — Classic Mode" option for unmodified gameplay
- Hero death/respawn mechanic with timer

### Bugs Found & Fixed During QA
- **Deploy button crash**: `deployHero(0)` called before `setupMap()`, causing `getPathPts()` to fail on empty `currentPaths`. Fix: call `startGame()` first (sets up map), then `deployHero(0)`
- **hitTest in render()**: Two hero ability hitTest calls were placed inside `render()` instead of `handleTap()`, causing `px is not defined` ReferenceError during rendering. Fix: moved to handleTap after globals handling
- **Stray drawColorBlindMarker**: A `drawColorBlindMarker(ctx, x, y, s*cellSize, e.type)` line was accidentally inserted into `drawParticles()`, referencing undefined `x`, `y`, `e`. Fix: removed the stray line

### Known Issues / TODOs for Next Phase
- Hero doesn't deal direct damage to enemies (only provides buffs) — could add auto-attack
- Hero portrait/icon on HUD could be more detailed
- Hero unlock progression could be more gradual (all heroes available from start)
- Consider adding hero-specific sound effects for abilities

---

## Phase 3: Visual Polish & Animation — COMPLETE

### Changes Applied
- **VFX system**: Object with trails, death rings, env particles, hit flash, tower angles, wave flash, low health pulse, vignette, splash screen state
- **Splash screen**: 2.5s animated intro (elastic title, scanning line, typing subtitle)
- **Enhanced towers**: Hexagonal base platforms, level rings, rotation toward enemies, unique per-type geometric detail for all 10 towers
- **Enhanced enemies**: Motion trails, hit flash (white burst), boss aura, inner detail patterns per shape, wing flap animations, orbiting dots, cargo pods, drill rotation
- **Projectile variety**: Sentinel=dot+trail, Thunder=large orb, Hawk=missile triangle, Neural=spiral dots, Nova=rotating star, Shockwave=ring pulse
- **Multi-shape particles**: rect, circle, line, triangle with rotation
- **Map terrain**: Dot grid intersections, biome-specific ground detail (urban=circuit traces, volcanic=lava cracks, arctic=frost crystals), enhanced entry chevrons, exit shield icon
- **Environmental particles**: Per-biome floating particles (volcanic embers, arctic snowflakes, urban data dots)
- **Screen effects**: Subtle scanline overlay, vignette during gameplay, wave start blue flash, red border when lives < 5
- **Enhanced death**: Death ring bursts + white fragment particles on enemy kill
- **Enhanced placement**: Double ring + hex flash animation

### QA Results
- Splash screen renders correctly with animated title
- Menu displays with color-coded glowing buttons, NEW badges
- All 10 tower types render with distinct geometric shapes on hexagonal platforms
- Biome-specific terrain verified: Urban (circuit traces), Volcanic (lava pools/embers), Arctic (frost crystals/snowflakes)
- Combat effects working: damage numbers, death rings, projectiles, hit flash
- Wave summary overlay renders cleanly
- Map selection with biome tabs functional
- Performance: 60 FPS steady

## Previous Phases
- **Phase 1**: Persistence + Core UX (localStorage, safe areas, auto-pause, button feedback)
- **Phase 2**: Audio Overhaul (procedural music, multi-oscillator SFX, 10 tower profiles)

---

## Phase 5: Hero System — COMPLETE

### Changes Applied
- **5 unique heroes**: Commander Vex (Vanguard), Dr. Lyra Sol (Technomancer), Kael Ironhart (Warden), Nyx Shade (Phantom), Zara Prime (Oracle)
- **Hero abilities**: Passive + active + ultimate per hero
- **XP/leveling system**: Heroes gain XP from kills, level up with stat boosts
- **Hero select screen**: Pre-battle hero selection with stats and ability descriptions
- **In-game hero rendering**: Draggable hero unit on battlefield with health bar, range indicator
- **Hero respawn system**: 15-second respawn timer on death

---

## Phase 6: Monetization & Business Model — COMPLETE

### Changes Applied
- **Helix Store UI**: Full 5-tab store screen (Hero Skins, Tower Packs, Map Themes, Bundles, Credits)
- **Hero Skins**: 5 heroes × 4 skins each (Default + 3 purchasable), unique color schemes per skin
- **Tower Skin Packs**: 3 packs (Neon, Void, Ember) at 400 credits each, reskin all towers at once
- **Map Themes**: 3 themes (Matrix Grid, Blood Moon, Aurora) at 250-350 credits
- **Bundles**: Starter ($2.99), Commander ($6.99), Ultimate (BEST VALUE) with USD + credit pricing
- **Credit Tiers**: 4 IAP tiers (100/$0.99 to 3000/$17.99) with bonus amounts
- **Purchase confirmation modal**: Shows item name, cost, remaining balance, BUY/CANCEL
- **Helix Credits currency**: Diamond icon, earned +10 per match and +5 per star
- **Cosmetic rendering**: Hero skins change in-game hero color/icon, equipped skins visible on hero select and battlefield
- **Persistence**: All purchases, credits, equipped skins saved to localStorage
- **Toast notifications**: addToast() function for purchase confirmations and game events
- **Free-to-play friendly**: "Free Ways to Earn" section showing match/star/streak rewards

### Bugs Found & Fixed During QA
- Missing closing brace `}` in drawGameOverScreen (if(isV) block unclosed after helixCredits line)
- `addToast` function undefined — added general-purpose toast that uses achievement toast system

### QA Results
- All 5 store tabs render correctly with distinct layouts
- Purchase flow: tap item → confirmation modal → BUY → credits deducted, item unlocked/equipped
- Hero skin changes visible in store (icon color), hero select screen, and in-game battlefield
- Tower pack purchase shows OWNED badge after purchase
- Credits persist across menu navigation and page reload
- No console errors after fixes
- All 5 hero sub-tabs functional with unique skins per hero

---

## Phase 7: Legal & Compliance — COMPLETE

### Changes Applied
- **IP Audit**: Renamed `Arc Pylon` → `Arc Tesla`, `Port Nexus` → `Port Helix`, `The Nexus` → `The Furnace`, `Command Center` → `War Room` to eliminate any StarCraft adjacency
- **Privacy Policy** (`privacy.html`): Full GDPR/CCPA compliant policy, dark-themed, mobile-friendly
- **Terms of Service** (`terms.html`): Comprehensive ToS covering IAP, virtual currency, licensing
- **In-game legal links**: Settings screen now shows Privacy Policy + Terms of Service tappable links
- **License audit**: Only Google Fonts used (JetBrains Mono + Inter), both SIL OFL — free commercial use
- **App Store compliance doc** (`APP_STORE_COMPLIANCE.md`): Age rating (9+), export compliance (ECCN exempt), privacy nutrition label, IAP product IDs, metadata draft
- **Toast system**: `addToast()` reused from Phase 6 — confirmed working

### QA Results
- No console errors after all Phase 7 edits
- Settings screen renders legal links cleanly
- Privacy and Terms pages load correctly, match game aesthetic
- No remaining StarCraft/Blizzard IP references in codebase

## TODO / Next Steps
- Phase 8: Native Packaging (Capacitor wrapper, Xcode, App Store submission)

## Bug Fix: Helix War Offense Mode Glitch — COMPLETE

### Root Cause
Campaign attack action called `startGame()` which launched a standard tower defense (build/wave) mode instead of an offense mode. Players clicking ATTACK expected to send units to overwhelm enemy defenses, but instead got a defense game — making the spawn panel non-existent and any unit-clicking attempts do nothing.

### Fix Applied
- Created `startCampaignOffense(tid, source)` function that sets up a proper offense game:
  - Uses the target territory's map
  - Places AI defender towers procedurally based on territory difficulty + garrison
  - Bio-mass scales with army composition (infantry: +30, armor: +20, artillery: +40)
  - Goal units scale with difficulty (8 base + 3 per difficulty tier + garrison bonus)
  - Bio-mass regenerates at 1.5/sec during gameplay
- Modified offense result screen for campaign context:
  - Shows "TERRITORY CAPTURED!" or "ASSAULT REPELLED" instead of generic messages
  - Single CONTINUE button instead of Play Again/Main Menu
  - Routes back to campaign via `processCampaignAfterBattle(won)`
- HUD shows "HELIX WAR — ATTACK" during campaign offense
- Added `offense.campaignAttacking` flag to distinguish campaign vs standalone offense
- Standalone Swarm Commander and Sector Clash modes verified unaffected
- Added campaign state debug hooks: `_getCampaignState`, `_setCampaignField`, etc.

### Testing
- Full attack flow: Select territory → ATTACK → Select target → Offense game → Spawn units → Win → CONTINUE → Campaign map (territory captured)
- Standalone offense mode verified working with no regression
- Sector Clash defend mode verified working
