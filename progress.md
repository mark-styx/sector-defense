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

## Phase 8: Commercial Polish Deep Dive — COMPLETE

### Critical Bugs Found & Fixed
- **Victory/gameover render-loop stat farming**: `drawGameOverScreen()` mutated `prog.totalStars`, `helixCredits` (+sc*5), `prog.totalMatches`, `prog.totalKills` every frame at 60fps while the result screen showed (~900 credits/sec exploit, corrupted profile stats). Fix: all match-end processing moved to one-time `finalizeMatch(victory)` guarded by `_matchFinalized`; render is now pure.
- **`awardPostMatchRewards()` was never called**: Arsenal Cards, tower skins, and the +10◇ match-completion credit never awarded — the entire F2P economy loop was dead. Now invoked from `finalizeMatch`.
- **Offense-mode targeting broken**: `spawnOffenseEnemy()` set `pathProgress` but `updateTowers()` targets via `progress` — in Swarm Commander / Helix War attacks / Clash attacks, only Fusion/Drone Bay/Barrier towers could shoot (7 of 10 towers inert). Fix: enemies now carry `progress` synced to `pathProgress`.
- **Clash attack soft-lock**: same field mismatch made `e.progress` NaN → enemies teleported to the path exit but never counted, round never resolved. Fixed by the same sync.
- **Mode-flag leaks**: quitting Allied Defense or Sector Clash mid-match (pause→QUIT) left `allied.active`/`clash.active` true, so the AI ally kept building towers in your next classic run. All entry points (`startGame`, `startEndlessGame`, `startAlliedDefense`, `startClashDefendRound`) and exits (pause quit, gameover→menu) now reset mode flags.
- **Hero state never reset on PLAY AGAIN**: stale HP/death timer/position carried into the next match. `startGame`/`startEndlessGame` now redeploy or reset the hero.
- **Endless "Play Again" launched classic mode** on a fake map index. Now restarts endless properly.
- **Campaign defense required all 40 waves per territory** (absurd pacing). Battles now cap at `campaign._waveCap` = 10 + min(8, floor(swarmThreat)) waves, shown in HUD and result screens.
- **Campaign result buttons**: "PLAY AGAIN" on a campaign battle now correctly processes the outcome (victory on win screen, was always defeat); relabeled CONTINUE.
- **Store false advertising**: "Daily first win +15◇" and "Win streak +25◇" were listed but unimplemented. Now real: tracked in `prog.lastWinDate` / `prog.winStreak`, persisted.
- **Half the achievements unobtainable**: tower_master, the_gauntlet, swarm_lord, card_collector, full_arsenal never checked. All wired (tower_master on kill milestone, the_gauntlet in finalizeMatch, swarm_lord on Swarm Commander clears incl. new Hive Titan unlock).
- **Swarm Commander abilities were dead code** (frenzy/armor/tunnel/titan had no UI). Added bio-energy bar + 4 ability buttons to the offense HUD; armor now applies a real 50% damage-reduction shield (honored in `applyDamage`), tunnel spawns 3 tunnelers, frenzy halves spawn cooldown, Hive Titan unlocks after clearing all 5 maps.
- **Color-blind mode did nothing**: markers/remap existed but were never called. Enemy fills now route through `getColorBlindColor` and per-type shape markers render in CB modes; lookup tables hoisted out of the per-frame path.
- **Drone Bay towers in offense mode never fired** (`fireTimer` vs `cooldown` field mismatch) — fixed.
- **Pause→Settings→Back instantly resumed gameplay** — now returns to the pause overlay.
- **Endless wave preview showed classic wave tables** — preview now shows the actual procedurally-generated wave (cached between preview and spawn); boss warning every 10th endless wave.
- **clash `enemiesAlive` could go negative** — clamped.
- **Legendary difficulty gated at Commander level 75** (~285k XP, effectively unreachable) — lowered to 20.

### Critical Bugs Found & Fixed (round 2 — winnability verification)
- **Projectile pool exhaustion (game-killer)**: projectiles that overshoot their target point (step > remaining distance) oscillated around it forever without satisfying the 3px hit check, permanently leaking pool slots (400 max). Over a match the pool filled with ghost projectiles and towers silently stopped shooting — mid-to-late waves became unwinnable for reasons invisible to the player. Fix: a projectile now hits when it can cover the remaining distance in the current frame (`dist <= max(3, speed*dt)`). Verified via pool-count instrumentation: pre-fix the pool pinned at 400 with frozen projectiles by wave 9; post-fix it stays at 0-2 and kills flow.
- **Wave preview lied in three modes**: endless preview read the not-yet-generated wave (empty list), Allied and Clash previews showed classic wave tables instead of the actual generated waves. Fixed all three; endless wave is generated when entering preview.
- **Hero ability cooldowns ignored game speed** (recharged 3x slower at 3x speed) — now scaled by sdt like all combat timers.
- **Fusion beam DPS was frame-rate dependent** (`damage*dt*10` per shot halved at 120Hz) — replaced with fixed per-shot damage matching 60fps behavior.
- **Swarm Commander biomass regen too starved** once defense towers actually shoot (the targeting fix made assaults go from trivial to near-impossible): regen 1.5/s → 3/s.
- **Tutorial carried stale loadout bonuses / hero state from the previous match** — now recalculated and reset on tutorial start.
- **Dead code removed**: drawMenuScreen (V1), drawProfileScreen (V1), CB_PATTERNS, updateSwarmEnhanced no-op loops + tunnelingCount.

### Balance Evidence (new)
- `test/balance.test.mjs`: a scripted bot plays Classic on Outpost Alpha through all 40 waves using only real tap events (radial placement, upgrades, wave start) — **wins on Standard (perfect lives), Veteran (perfect lives), and Elite (6/10 lives)**. A second bot assaults Swarm Commander's first fortress using bio-abilities (armor/tunnel/frenzy) — **wins**.
- `test/modes.test.mjs`: end-to-end bots verify the other modes — **Helix War** (army-backed attack captures a territory; fortified defense battle resolves; campaign returns to map and quits cleanly), **Sector Clash** (full match resolves to final screen, match counted, rewards granted), **Allied Defense** (30-wave co-op won alongside the AI ally). All are CI regression tests.

### Test Suite (new)
- `test/harness.mjs`: boots index.html in a Node VM with stubbed DOM/canvas; drives real taps and simulated frames; includes shared defense bots (fixed-plan bot for Outpost Alpha, generic any-map bot that fills cells near the path entry and skips restricted tower types).
- `test/harness.mjs`: boots index.html in a Node VM with stubbed DOM/canvas/localStorage; drives real tap events and simulated frames via the game's own `advanceTime` hook.
- `test/game.test.mjs`: 13 tests covering economy idempotency, offense targeting regression, clash movement regression, mode-flag leaks, endless restart, store IAP grants, hero deploy, pause/settings flow, full build→wave→summary loop, and crash-free rendering of all 26 screens.
- `test/balance.test.mjs`: 4 winnability soaks — Classic Standard/Veteran/Elite full 40-wave campaigns (all won by a tap-driven bot) and a fortress assault with bio-abilities.
- `test/modes.test.mjs`: 3 end-to-end mode bots — Helix War attack+defend loop, full Sector Clash match, 30-wave Allied Defense co-op.
- `test/hardening.test.mjs`: 5 tests — Legendary winnability (level-20 save), endless 25-wave survival, hero ability integration, and save/purchase + settings persistence across an app restart.
- `test/tutorial.test.mjs`: the guided tutorial walked end-to-end on a fresh save (a new player's first experience).
- `npm test` — 26 tests total; every difficulty tier and game mode has machine-verified winnability or flow evidence.

## Bug Fix: Helix War Offense Mode Glitch — COMPLETE (from origin)

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

## Origin Merge: Helix War Campaign Improvements — MERGED
- Campaign persistence: Resume vs New Game menu when entering Helix War; auto-save after every campaign action; mid-battle forfeit warning (quit counts as a loss)
- Enhanced campaign map stats bar (turn, income/turn, territories, battles won, threat)
- Campaign balance pass: starting nexium 150, softer swarm expansion (probabilistic), gentler threat ramp (+0.35/turn), reduced attack chance curve, richer offense bio-mass scaling (220 base), lower assault goals, fewer defender towers
- Reconciled with local work: pause-quit keeps campaign forfeit handling AND full mode-flag resets; initCampaign keeps wave cap

### Hardening Round (final)
- **Endless/Clash wave generation wasn't tier-gated**: endless wave 1 could roll a flying Hivemind boss + all-air wave against a player with zero anti-air (classic introduces air at wave 8). Units now unlock progressively (basics → air/armored → spawners/healers → bosses → siege at waves 5/10/15/20), applied to endless and Clash defend rounds.
- **Clash attack rounds were unwinnable vs entry-camped defenses**: attack goal 15→10 (parity with assault mode), defender towers L0 until AI difficulty ≥1.5, attack bank 500 + threat-scaled (a devastator meat-shield push breaks entry camps in one burst), biomass regen 3/s (was 2/s, inconsistent with offense mode), and attack rounds now respect game speed.
- **Legendary (hpM 2.0) was a hard wall at wave 28**: lives 5→10. Proven winnable by a bot using global abilities and late-game tower flooding (finished 10/10 lives); all four difficulties now CI-verified.
- **iOS home-screen polish**: apple-mobile-web-app meta (standalone, black-translucent status bar, app title), theme-color, description.
- **New tests**: Legendary winnability (level-20 pre-seeded save), endless 25-wave survival, hero ability integration (Q/ULT fire mid-wave, cooldowns run, hero persists across waves), and a persistence round-trip (credits + purchased skin + equipped skin survive a full app restart via localStorage).
- Bots now play like strong humans: orbital strike on the leading enemy, field repair when hurt, temporal surge on swarms, late-game surplus flooded into extra towers.

### First-Run Experience Round (final)
- **Tutorial soft-locked at step 9**: the "tap your tower" step opened the tower info panel, and the next acknowledge step advanced the tutorial without closing it — the info panel replaced the build panel, hiding the START WAVE button the tutorial demanded. Only recoverable by guessing. Acknowledge steps now close the info panel.
- **Stale button hitboxes**: `G._btns` was never cleared between screens, so buttons from previous screens remained tappable at their old coordinates (e.g., the tutorial entry after completion, overlapping the new first menu item). The registry now resets at the top of every render.
- Version string (v7.1.0) visible in the settings footer.
- New tests: full guided-tutorial walkthrough (fresh save → 13 steps → completion → menu updated), settings persistence across restart. 26 tests total.

### Performance & Final Polish
- **Path geometry caching**: `getPathPts`/`getPosOnPath`/`getPathLen` previously rebuilt the full point array (fresh object allocations) and re-looped segment lengths per enemy per frame — ~270k object allocations/min on long waves, real GC churn on low-end devices. Geometry is now cached per map/layout and invalidated on map change or resize; steady-state is allocation-free. Full test suite verifies identical behavior across every mode.
- **Tap-to-skip splash** (also unlocks audio on first interaction).

## TODO / Next Steps
- Phase 9: Native Packaging (Capacitor wrapper, Xcode, App Store submission)
- Push merged main to origin when network access to the remote is available (history is reconciled; push will fast-forward)
- Human playtest on physical iPhone: fun-factor, safe areas, touch targets (bots prove winnability, not feel)
- Cloud save / account system for cross-device progression
- Real multiplayer for Sector Clash (currently AI simulation)
