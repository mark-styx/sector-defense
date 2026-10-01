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
- `test/balance.test.mjs`: 6 winnability soaks — Classic Standard/Veteran/Elite full 40-wave campaigns (plan bot), the three Hard-rated maps on Standard plus the Inferno+Elite gauntlet combo (chokepoint-aware generic bot), and a fortress assault with bio-abilities.
- `test/modes.test.mjs`: 3 end-to-end mode bots — Helix War attack+defend loop, full Sector Clash match, 30-wave Allied Defense co-op.
- `test/hardening.test.mjs`: 5 tests — Legendary winnability (level-20 save), endless 25-wave survival, hero ability integration, and save/purchase + settings persistence across an app restart.
- `test/tutorial.test.mjs`: the guided tutorial walked end-to-end on a fresh save (a new player's first experience).
- `npm test` — 29 tests total; every difficulty tier, map archetype, and game mode has machine-verified winnability or flow evidence.

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

### Real-Browser Verification (final)
- The game had never been loaded in a real browser engine by any test (all coverage used a stubbed canvas). Added `npm run test:browser` (Playwright, iPhone viewport, real input events), running the same session in **two engines: Chromium AND WebKit** (WebKit is the same core as iOS Safari/WKWebView — the actual shipping target). Session: loads the page, menu → map/difficulty/hero select → radial tower placement → live wave → pause/quit → store credits tab → campaign menu. Result: **zero console errors, zero page errors, 60.5 fps (Chromium) / 60.0 fps (WebKit)** with kills confirming live combat. Kept out of `npm test` (browser download optional).
- **Pixel-level render verification**: samples canvas pixels at menu and mid-combat (501+ / 316+ distinct colors in both engines) — a blank or garbled canvas can no longer pass silently.
- **Touch-input path verified**: dedicated WebKit session (iOS engine + iOS input modality) navigates splash → menu → full match setup via `touchstart` events only; mid-game viewport resize (orientation change) handled with zero errors.
- **Smallest-device layout verified**: iPhone SE (375×667) session confirms all 13 fresh-save menu buttons (incl. TUTORIAL) fit the viewport and navigation works.
- **Cross-session battle-flag leak fixed**: a save triggered during a defense battle (e.g. achievement unlock mid-combat) persisted `campaign.defending=true`; resuming that campaign leaked the 12-wave battle cap into unrelated matches. Campaign resume now clears stale mid-battle flags (battles never persist across sessions); regression-tested via real save → reload → resume.
- `npm run serve` now uses the port-authority assignment (8021) instead of an arbitrary port.
- Verified NOT available on this machine: Xcode/CocoaPods — Capacitor iOS build (Phase 9) must run on an Xcode machine.
- `mkgh` (git remote) is an unresolvable host here — push remains a user action; general network is fine.

### Map-Coverage Round (final)
- Winnability evidence previously covered Outpost Alpha only per difficulty. Now verified with a chokepoint-aware generic bot (scores buildable cells by path-cells-in-tower-range, naturally defending multi-lane convergence points): **War Room (3 converging entries), Inferno (long spiral), and Absolute Zero (fusion-restricted, 14×20) all won on Standard with perfect lives**, and **the gauntlet combo (Inferno + Elite — the achievement's implied bar) is won at 9/10 lives**. No game-balance changes were needed; the one initial failure (War Room) was a bot-strategy artifact of entry-clustering, fixed by convergence placement.
- New `_getPathCells` debug hook; generic bot placement now map-shape-aware (also used by endless/allied/clash/campaign bots — all still green).

### Monetization & Full-Map Sweep Round (final)
- **Skyline balance fix (evidence-based)**: the full 10-map Standard sweep showed 9 maps won with perfect lives, but Skyline (rated Medium) lost at wave 34-39 — its restrictions banned both thunder (splash) and nova (burst), leaving no answer to the armored boss waves (sentinel shots do 1-5 damage after armor 10). Thunder restored (nova stays restricted for map identity); Skyline now wins 25/25 like every other map.
- **All 10 maps verified winnable on Standard**: 9 with perfect lives via chokepoint bot; Skyline after the restriction fix.
- **Ultimate bundle delivery test**: buys the 2500-credit bundle through the real confirm flow and asserts every hero skin, all 3 tower packs, and all map themes unlock — and that owned bundles cannot be repurchased.
- **Victory payouts asserted**: first win unlocks achievements and awards Helix credits in a real bot victory.
- **Hero progression end-to-end**: Commander Vex wins a full Standard campaign; persistent XP and matchesPlayed verified via new `_getHeroProg` hook.
- **Hero-button overlap bug fixed**: the hero ULT hitbox overlapped the tower-info ✕ button (and hero buttons are tap-checked before the info panel), so closing a tower's info panel with a hero deployed fired the ultimate instead. Hero buttons now hide while the info panel is open.
- Generic bot no longer wastes build slots on map-restricted tower types (falls back to sentinel/hawk).
- Helix War defend-wait loop widened (probabilistic swarm attacks; ~3% flake at 20 iterations).

### Compliance Doc & Final Matrix Edges
- `APP_STORE_COMPLIANCE.md` reconciled against the current store: IAP table verified matching (credit tiers + bundle prices). Fixed "20+ challenges" → 10 achievements; noted Playwright as dev-only tooling in the third-party table (not shipped).
- Matrix edges verified (one-off soaks, `test/sweep-edges.mjs`): **Absolute Zero / Elite** (hardest map × hardest unlocked difficulty) won at 4/10 lives; **endless volcanic and arctic** each survived 30 waves with perfect 25/25 lives.

### Legal, HTTP & Typography Round (final)
- **Typography bug (long-standing)**: the game renders no DOM text, so browsers never fetch the Google Fonts faces referenced only by canvas — real users have been seeing fallback monospace. Boot now force-loads all used faces/weights via `document.fonts.load()`; verified loading over real HTTP in both engines (JetBrains Mono + Inter `check: true`), with silent offline fallback.
- **HTTP serving verified** (previously only `file://`): game loads and runs over HTTP in Chromium + WebKit with zero errors, fonts resolving.
- **Legal pages verified**: privacy.html/terms.html read (claims match reality: no data collection, cosmetic-only purchases, Apple-only payments, Google Fonts disclosure) and load-tested in both engines via the browser smoke.
- **Campaign victory path tested**: `checkCampaignVictory` had never fired in any test; new test captures the Swarm Hive and asserts the victory screen + clean return to menu.
- Code header version reconciled (v7.0 → 7.1.0).

### Layout Regression Net Round (final)
- Added a **button-overlap detector** to CI: every screen's registered hitboxes are pairwise-checked (square test for rects, distance test for circles) — the exact bug class behind the earlier hero-ULT hijack. It immediately caught and led to fixes for:
  - **Loadout screen overflow**: 18 Arsenal Cards in 3 columns extended past the screen bottom, with the BACK button drawn on top of the last card row (bottom cards untappable). Rebuilt as 4 columns; everything fits with clearance.
  - **Global abilities vs START WAVE**: the third ability button's top edge clipped START WAVE's bottom-left corner (6px); globals row nudged clear.
  - **Radial menu spacing**: widened the ring radius so 10 tower buttons don't crowd at the default ring size.
  - Global-ability row now hides while the tower info panel is open (it overlapped the info buttons' lower edge and is tap-checked first).
- Screenshot capture script added (`test/capture-shots.mjs`) writing menu/build/combat/store/campaign shots to `test-artifacts/` (gitignored) for human visual QA.

### Frame-Time & Final Docs Round
- **Jank probe**: 51 live entities (dense late-game load) measured at **0.27ms/frame** for the full update+render cycle — 60x headroom against the 16.6ms/60fps budget. No logic-side stutter source exists (path-geometry cache confirmed paying off); remaining frame cost is canvas/GPU work only, measurable on device.
- README test count corrected (33).

### Arsenal Cards, Offense Speed Bug & Map Coverage Round (final)
- **Arsenal Card effects verified in gameplay** (previously zero coverage for a headline feature): deep_pockets (+50 start nexium), iron_will (+3 lives), and scavenger (+15% kill rewards — exact math asserted: wave-1 accounting lands on 396 nexium) all apply from equipped loadout.
- **Offense economy was game-speed-dependent (real bug)**: biomass regen and spawn cooldown ticked on real time while combat ran on game time — players using the 3x speed button in Swarm Commander got one-third the economy per combat-second. Both now scale with game speed; 1x/3x parity verified.
- **Swarm Commander map coverage completed**: all 5 assault maps now bot-won consistently and locked into CI. Path exposure (caldera's spiral, skyline's 7-row zigzag runs every unit past all towers) proved a better difficulty predictor than tower count — per-map assault budgets added accordingly (Weak Point/Gauntlet modest; Iron Wall 450, Fortress 500), and the winning strategy is genuinely budget-dependent (sustained devastator tanks vs venom streaming), which the CI bot adapts to.

### Hero Coverage Round (final)
- **All five heroes verified through full matches**: the other four (Lyra Sol, Kael, Nyx, Zara — previously never played) each won Standard with perfect lives; Nyx (most exotic mechanics: marks/teleport) added to CI alongside Vex.
- **Hero level-bonus pipeline verified for all five heroes**: seeded max-level saves confirm the `apply` strings parse and apply — deployed maxHp exactly equals base + the hero's hp bonus (550/330/900/280/390). (An initial "mismatch" was the test's own wrong expectations — each hero has exactly one hp+ entry.)
- Bot harness hardened: tapping a cell occupied by the allied AI's tower opened the tower-info panel and stalled builds mid-race; placement failures now close any panel they opened, and both bots begin play() by clearing one.

### Core-Loop Player Actions Round (final)
- **Tower sell and tower abilities — two core player actions no test had ever exercised** — now verified: activating a tower's ability starts its cooldown, selling refunds exactly 60% of spend (150-cost tower → +90), the panel closes, the cell frees, and the radial reopens for rebuilding.

### Save-Corruption Hardening Round (final)
- **Corrupted or old-shape saves bricked the game** (black screen): a non-array `campaign.territories` (truncated/legacy save) crashed the campaign map render (`territories.filter is not a function`), and mistyped settings values (`musicVol: null`) crashed the settings screen. `loadAllState` now sanitizes: campaign saves restore only with a well-formed 20-territory array (else discarded), settings values coerced with type/fallback validation. Regression-tested with garbage saves; boot, settings, and campaign screens all render. This matters commercially: the March-origin release means real players will upgrade with old-shape data.

### Data-Integrity Round (final)
- **Campaign graph had three asymmetric adjacency edges** (10→4, 19→5, 19→6): the hex map draws these connections, but the mechanics (attack targeting, swarm expansion, adjacency checks) read one-directional lists — so e.g. a player holding The Crucible could never attack Relay Station or Watchtower, and the swarm couldn't cross those edges from the far side. Silently impossible conquest paths. Edges made symmetric (4↔10, 5↔19, 6↔19); a data-integrity test now locks bidirectionality, adjacency range, and orthogonal path contiguity across all 10 maps.
- Citadel assault budget 150→200 (flaked 8/10 once; margin for combat randomness).

### Flake Audit (final)
- Full suite run 3× consecutively after the three historical flakes were fixed (Citadel assault margin, allied info-panel race, campaign defend-wait window): **39/39 × 3, zero failures**; browser smoke 2× green (19 checks each). CI is stable under its own randomness (assault combat, clash rolls, swarm timing).

### Release Hygiene (final)
- Version bumped 7.1.0 → **7.2.0** (code header, settings footer, package.json) to distinguish this build's 23 commits of fixes from the prior release. Full suite + browser smoke green on the bumped build.

### App Icon (final)
- **Home-screen icon added**: iOS installs previously got a screenshot tile. `icon.png` (180×180, dark bg + cyan hexagon in the game's exact palette) generated by `tools/make-icon.mjs` — a zero-dependency pure-Node PNG encoder (hand-rolled IHDR/IDAT/IEND + CRC32). Verified valid by decoding in a real browser engine (center pixel = exact #00ccff, corner = exact #0a0e1a). Wired via `apple-touch-icon` + `icon` links; `.gitignore` narrowed from `*.png` to `test-artifacts/*.png` so the icon is tracked.

- Verified `apple-touch-icon` href resolves over HTTP in WebKit: status 200, `image/png`, valid PNG signature, 999 bytes.

- **Offline operation verified** (the last untested real-world scenario — subway/airplane mode, first launch of a Capacitor build without network): Google Fonts requests blocked at the network layer; the game boots, skip-splash works, full navigation to build phase succeeds, battlefield renders 299+ colors, zero page errors. Font stacks fall back cleanly; `document.fonts.ready` resolves despite failed loads.

### Memory-Leak Fix Round (final)
- **Real leak found and fixed by direct measurement**: a 60-wave endless soak showed `G.enemies` holding **9,189 objects between waves** — the filter `e.alive || e.progress < 1` retained every *killed* enemy forever (dead mid-path keeps progress < 1; only *leaked* enemies were dropped). Every tower's targeting scan iterated the full array each frame, so the cost compounded all match and exploded in endless mode (~30k entries by wave 100 → visible late-game slowdown on device). Fixed to filter on `e.alive` alone; after the fix, the same soak retains **1** entry (the wave-ending kill can land after the last filter pass — bounded, not cumulative) and heap is **flat over 55 waves (-0.5MB)**. Regression test locks the bounded invariant with 100+ kills of volume.

### Session Longevity (final measurement)
- **Two complete matches in one session measured** (previously every test played one match per boot): match 1 victory → PLAY AGAIN → match 2 victory with perfect lives; state fully reset between matches (kills/towers/lives fresh), mode flags clean, heap flat (-0.8MB across the second match). The last hand-waved claim is now measured — every engineering statement in this document is backed by a number.

### Debug-Leftover Sweep (final)
- Swept all shipped files for `console.*`, `TODO`, `FIXME`, `XXX`, `debugger`, and `alert()` — **zero findings** across index.html, privacy.html, terms.html. No debug code ships.

## TODO / Next Steps
- Phase 9: Native Packaging (Capacitor wrapper, Xcode, App Store submission)
- Push merged main to origin when network access to the remote is available (history is reconciled; push will fast-forward)
- Human playtest on physical iPhone: fun-factor, safe areas, touch targets (bots prove winnability, not feel)
- Cloud save / account system for cross-device progression
- Real multiplayer for Sector Clash (currently AI simulation)

## Round 33 — First live-device playtest feedback (v7.2.1)

Source: user played on iPhone via LAN/tunnel URLs. Five findings, all fixed (2c3c0de):

1. **Achievement toasts stuck at top** — updateToasts only ran in combat phases;
   menus/result screens drew toasts that never expired. Now ticks in every phase;
   stack capped at 4; notch-safe y offset (safeTop+44).
2. **No way to leave a game** — Swarm Commander + Clash attack had NO exit;
   classic pause hitbox was 24px and dead during wavePreview/waveSummary (and
   tapping it there started the wave). All fixed: 44px hitbox, tryPause() helper,
   ✕ abandon buttons + confirm modals; clash forfeit = loss + Elo penalty;
   pause-quit during clash defend now forfeits properly.
3. **Credit system opaque** — itemized EARNED THIS MATCH block on result screens
   (_creditLog via gainHelixCredits); win payouts scale with performance
   (flawless+10/solid+5/scraped+2, defeat 10→3, stars×5 unchanged); How To Play
   explains ◆ Nexium vs ◇ Helix Credits; menu footer + store show balance/earning hint.
4. **Modes unexplained** — one-time briefing modal per mode (persisted, skippable);
   campaign/biome subtitles; harness seeds briefings seen for bots.
5. **Classic too easy** — Standard lives 25→18.

Tests: +7 (playtest.test.mjs) = 47/47 headless, dual-engine browser smoke green
(briefing dismissal wired into all three browser sessions).

## Round 34 — Difficulty ladder + critical mode review (v7.2.2)

User directives: (1) difficulty via stronger/faster enemies, not lives;
(2) critical review of every mode's logic/premise.

Measurements that drove decisions:
- Stat-only bump (1.15/1.08) left strong-bot Standard margin at 18/18 —
  identical to baseline. Stats alone don't threaten optimized play.
- Density x1.2 on Legendary: bot dies wave 9 (unwinnable) -> Legendary stays
  x1.0 density, rises via 2.05/1.5 stats.
- Fortress-escalation timer for offense: broke Citadel winnability at 90s,
  150s, AND single-pass 180s (6/8 fails) -> reverted. The mode's lack of a
  fail state is a design problem, documented in MODE_REVIEW.md open items.

Final ladder: Std 1.15/1.08/x1.0, Vet 1.45/1.22/x1.1, Elite 1.7/1.32/x1.15,
Leg 2.05/1.5/x1.0. Offense units pinned hp x1.30 / speed x1.0 (decoupled
from DIFFS; also cured the Citadel flake).

Smoking gun found by the review: campaign RECRUIT descriptions described
mechanics that did not exist anywhere in the code. Armies now have distinct,
truthful effects (armor -> spawn shields, artillery -> free Devastators).

Full critique: MODE_REVIEW.md. 48/48 headless + browser smoke green.

## Round 35 — Swarm Commander fail state: finite bio reserve (v7.2.3)

User decision: limited bio reserve (open item 1 from MODE_REVIEW.md).

Mechanic: bio regen (3/s) now draws from a per-map finite reserve. Reserve
spent + bio below cheapest unit + nothing alive = assault lost (offenseResult
defeat; campaign attacks count as a lost battle). HUD shows live reserve,
map-select cards show it, briefing states it. Campaign assaults carry
150 + army-size*25 reserve on top of army-derived start bio.

Tuning was measurement-driven (bot spend per map: Weak Point 246 total,
Gauntlet 300, Iron Wall 729, Fortress 770; Citadel was grinding 2048 regen
bio and still losing 1/8 — its old balance only existed because regen was
infinite). Citadel: start 200->300, reserve 700.

Soak bot upgraded to actually-strong play (uses FRENZY, not just armor/
tunnel): 12/12 green. Naive bot still wins ~90% — right difficulty shape:
clean finite-resource losses instead of infinite grind.

New: finite-reserve regression test (plateau + reachable defeat).
49/49 headless + dual-engine browser smoke green.

## Round 36 — Balance deep dive: measured critique (BALANCE_REVIEW.md)

Goal: be critical about balance goals vs outcomes, numbers over opinions.

Tooling: tools/balance-audit.mjs — extracts live data tables from the game
(tower ROI, wave economy, budget curves, offense unit efficiency) and measures
outcome-space with the real-tap bots (classic margins per tier, weak-bot
deaths, allied ally-vs-player contribution, clash stall exploit, endless
death point).

Headline findings (all measured, details in BALANCE_REVIEW.md):
- Strong play is flawless at EVERY tier: 18/18, 15/15, 10/10 lives, zero
  losses across 40 waves; Standard banks 15,071 unspent (27,573 income vs
  ~4,755 needed). The "a bit too easy" verdict is now a number.
- Skill curve is a cliff: 6-tower casual bot dies wave 35, 16-tower bot never
  loses a life. No measured middle ground.
- The ladder's biggest jump is economic, not enemy: Elite->Legendary
  affordability 0.73 -> 0.42 (-43%) vs enemy challenge +19%. rewM punishes
  exactly during the waves-2-7 pressure peak (which is 2-3x late-wave
  pressure at every tier).
- Tower roster: sentinel 64 dps/$100 = 2x the field (hidden meta confirmed);
  barrier 2.5 dps/$100 near-dead. Armor inversion (nova/fusion/thunder vs
  bosses) genuinely works — keep.
- Clash attack is unloseable: infinite bio regen (measured 551->2,171 over
  9 sim-minutes idle), no timer; stall + skitterling-spam wins 10/10. Defend
  round is a formality (20/20 lives, 600 total budget ~ classic wave 5).
  Round-35's finite reserve fixed offense mode but not clash.
- Allied: ally builds 26 towers vs player 10; runs finish 26-30/30 lives;
  idle player dies wave 6 (not AFK-winnable, but ally carries late game).
  playerKills/aiKills never increment (truth bug).
- Endless passes (strong bot dies w63); offense skitterling dominates
  hp/bio (13.0 vs 10.4 next) — repricing candidates listed.

Prioritized recommendations R1-R8 in BALANCE_REVIEW.md (top: port finite
reserve to clash attack; flatten economy axes of the ladder; trim late-game
income; late-wave density escalation).

No game-code changes this round (analysis only). 49/49 headless green
(one Citadel 9/10 flake, then 4/4 clean — knife-edge margin noted in review).

Gap-closure pass (same round, after self-check): Legendary tier margin
measured with a level-20 seeded save (victory, finished 10/10, one dip to 9
at wave 2, repair ability masking raw leaks; peak bank 3,871 vs Standard's
15,071); tower-ability uptime table added (x1.17-x1.24 sustained if used on
cooldown, all of it human-only upside the bot tables exclude); healer/
spawner hidden HP quantified (+6-9% effective HP, waves 16-40); shockwave
re-framed as the anti-heal answer whose card fails to say so.

Second self-check pass found two un-critiqued systems, both now covered:
- Arsenal cards (F13): automated symbol-read audit found 6 of 18 cards are
  DEAD (equipped, effect never read anywhere): rapid_deploy (no build-time
  system exists at all), hawkeye, heavy_rounds, quick_reflexes, thick_armor,
  drone_support. frost_field is a trap: its `!slowTimer` refill guard never
  re-fires after float decay, so "all towers slow enemies slightly" is a
  one-time 0.5s slow per enemy (measured progress ratio 0.903 vs 0.4 for a
  real aura). 39% of the unlock economy sells duds (R9). Cards are win-drop
  only; the store sells no cards (severity = broken grind promises).
- Campaign strategic layer (F14/F12): threat escalation works (expansion
  0.51-0.85, attacks 0.19-0.70, defense to Elite by ~turn 17) but the
  economy is decorative: outpost = 2-turn payback strictly dominates,
  nothing costs enough to gate a decision past turn ~5 (R10).

Third self-check pass (accuracy audit of the review's own claims):
- F1 strengthened with code evidence: the difficulty card discloses HP/Speed
  % and lives/nexium but hides rewM/costM/cntM — the harshest axes are the
  undisclosed ones.
- F11 extended with progression pacing: level-20 gate = 19,000 XP =
  10-11 flawless wins (1,879-2,090 XP/win, kills dominate). Reasonable.
- Variance honesty: allied idle dies w6-12 across runs; endless death
  w63-68 across runs (both updated from single-run numbers).
Audit tool gained `cards` section + 6c progression table; full pipeline
(all sections) verified end-to-end in one run.

## Round 41 — Quality pass: economy consistency

**Brief**: deep quality pass after the rounds 38-40 feature streak.

### Found and fixed (6 defects)1. **Oracle time-drip survived the economy rework**: Zara Prime's "Nexium
   Resonance" still generated +2◆/sec — the last time-based income stream,
   contradicting round 39's damage-only design. Reworked into a damage-income
   amplifier: +12% (+4% per passiveStr level) while deployed and alive.
   Hero desc, passive desc, and level-bonus copy updated.
2. **Offense kills minted nexium**: the round-39 kill kicker's `max(1,...)`
   floor paid +1◆ for every reward-0 attacker unit the AI defenders killed,
   polluting `totalNexEarned` in a mode with no nexium economy. Reward-0
   enemies now pay exactly 0.
3. **Float ◆ displays**: wave summary ("Nexium earned: ◆78.00000000000001")
   and match-end stats printed raw floats from the damage stream. Both
   rounded (HUD and render_game_to_text were already floored).
4. **Hivemind swarmers skipped the round-40 ramp**: `spawnSwarmer` built HP
   from `15*hpM` while every `spawnEnemy` path compounds `waveHpMult(w)`.
   Swarmers now inherit the ramp like all other mid-wave spawns.
5. **Dead field**: `loadoutBonuses.nexiumGen` still defined/reset but unread
   since the Nexium Extractor rework — removed.
6. **Invisible escalation**: the wave preview now discloses the classic HP
   ramp ("⚠ Enemy strength +X%") so the round-40 difficulty curve is
   player-facing instead of hidden.

### Quality pass II: dead-code sweep found three advertised hero mechanics unwired
A whole-file call-site sweep (228 defined functions, single-use analysis) found
five never-called functions. Two were harmless leftovers (deleted:
`isTerritoryAdjacentToPlayer`, `startScreenFade`). Three were real gameplay
lies — defined, described in the hero roster, and doing nothing:

7. **Vanguard "Battle Cry" (+15% tower damage within 3.5 cells)** —
   `getHeroDamageBonus` existed but no caller. Now folded into
   `getTowerStats` (single site covers projectiles, beams, chains, drones,
   AOE ticks, AND the info panel's displayed stats). AI towers excluded.
8. **Vanguard ultimate "Total War" (all towers fire 2x)** —
   `getHeroFireRateBonus` never called; wired the same way. The dead helper
   also carried a duplicate damage-x2 line that would have double-dipped —
   removed (the ult is fire-rate only, per its description).
9. **Oracle ultimate "Prophecy ... move 30% slower"** —
   `getEnemySpeedMultiplier` never called; wired into classic enemy movement
   (`updateEnemies`). The +50% damage half always worked; the slow half did
   nothing until now.

New test hooks: `_getHeroAuraMults`, `_setHeroUltActive`, `_getTowerStatsFor`.
Two new regression tests: vanguard aura boosts a nearby sentinel's live
stats (8 → 9 damage, fireRate 0.25 → 0.125 under the ult, no damage
double-dip) and Prophecy measurably slows enemy progress (~0.7x).

### Verified
- Damage-hook coverage audit: all 11 live damage sites award income; no
  stale `updateNexGen`/bonus references; achievements have no nexium-earn
  conditions; spawnProjectile is live (technomancer turrets), not dead code.
- 5 new regression tests total (oracle damage-amplification + no-drip, offense
  zero-mint, swarmer ramp, vanguard aura/ult live stats, Prophecy slow);
  90/90 headless green; both browser engines
  clean; audit re-run identical (endless w70, frost 0.820, cards 18/18).

### Version
7.6.1 → 7.6.2 (quality pass II adds working hero mechanics; header, footer,
package.json, package-lock).

## Round 40 — Auto tower abilities, wave escalation

**Brief**: "since more damage gets more cash, the progressing waves should become
more difficult as well... i dont think people are going to click into 50 towers
to use their abilities. maybe the tower abilities should be a passive or auto
usage thing and an ability you can pay for to unlock on the tower."

### Escalating waves (classic)
- `waveHpMult(w) = 1.018^w` compounds enemy HP per classic wave — ~1.4x by
  wave 20, ~2.0x by wave 40. Damage income scales with the HP pools, so the
  richer late-game economy buys harder fights instead of snowballing.
- Gated to classic mode only (`isClassicWave()`): endless keeps its 1.08
  budget curve, allied/clash/campaign/offense untouched.
- Mid-wave spawns (swarm carriers' skitterlings) inherit the ramp.

### Auto-firing tower abilities (pay-to-unlock)
- Abilities start LOCKED per tower. Info panel shows `UNLOCK ◆abCost`
  (abCost ≈ 60% of tower cost, new per-type field, scales with costM,
  adds to totalSpent so sell refunds cover it).
- Unlocked abilities AUTO-FIRE from `updateTowers` on tactical triggers:
  storm/nuke/empblast/fortify/swarm/overload wait for 2+ enemies in range;
  overcharge waits for a target with hp ≥ 4x tower damage (won't waste a 5x
  shot on fodder); stim/flak/meltdown fire on first contact.
- The info button doubles as a manual force-fire while unlocked+ready (player
  agency preserved); cooling shows a status chip. Unlocked towers wear a ⚡
  rune; the ready-glow only pulses for unlocked towers.
- AI towers (allied partner, offense defenders) stay non-auto — zero balance
  drift for bots that never clicked abilities anyway.
- Harness bots now convert surplus (>◆450) into unlocks on upgraded towers.

### Verification
- 5 new headless tests: locked-never-fires, auto-fires-on-trigger,
  overcharge trigger discipline, live wave-37 HP ramp check, endless
  exclusion. Tower-info test rewritten for unlock→force-fire→sell-with-refund.
- 85/85 headless green including all winnability gates (Standard/Veteran/
  Elite/Legendary 40 waves, hard maps, Inferno-Elite, endless 25, allied 30,
  all 5 assaults) — the 2x wave-40 ramp held with the unlock-powered bots.
- Audit re-run: tower table gains ab$ + auto-type columns; economy model
  carries the ramp; endless still dies at w70; frost 0.820; cards 18/18.

### Version
7.6.0 (header, footer — including recovering the lost v7.5.0 footer bump,
package.json, package-lock).

## Round 39 — Damage economy, tower upgrade art, projectile impacts

**Brief**: "towers that get upgraded should have a visual change to appear more
imposing. the projectiles should also be cooler and more effectuous when landing
on enemies. credits to buy towers should come from damage imposed to enemies,
not time. maybe in swarm mode, then it should be a function of how far your
units got plus time or something. essentially progress gets you cash."

### Economy rework (damage-driven)
- `awardNexiumForDamage(e,dmg)`: every effective damage event pays
  `dmg * NEX_PER_HP(0.30) * max(rewM/hpM, 0.5) * killRewardTaper(w) *
  (1+scavenger+campaign bonus) * nexiumDmgMult`. Hooked into ALL damage sites:
  applyDamage (direct/reflect/splash), applySplashDmg, storm/barrier/dronebay/
  fusion towers, orbital strike, hero reflect/barrage/shadow-strike.
- Per-enemy lifetime credit capped at `maxHp * 1.25` (`_nexCredited`) so
  stall-farming healers/tanks can't mint currency.
- Kill rewards cut to a 25% kicker (`max(1, round(reward*rewM*taper*0.25))`);
  score keeps full value.
- Flat wave-clear bonuses (50/40+10w) removed from standard, endless, allied,
  and clash-defend transitions — income is earned during combat only.
- Difficulty fold floored at 0.5: Legendary (rewM/hpM = 0.295) was starved
  without the old flat bonuses; floor restores winnability (bot: victory w40,
  10 lives). Difficulty-select "Reward -X%" copy stays truthful.
- Nexium Generator card → **Nexium Extractor** (+20% ◆ from damage) via new
  `loadoutBonuses.nexiumDmgMult`; the per-second tick (`updateNexGen`) removed.
- Nexium bank is now float; HUD floors it, `render_game_to_text` rounds it.

### Swarm Commander / Clash attack: progress pays
- Bio trickle 3/s → 1.5/s from the finite reserve (time component).
- New progress drip: `Δprogress * unitCost * 1.5` while walking (a full lane
  pays 1.5x the unit's cost), cost-proportional so cheap units dying mid-lane
  can't be spammed for profit. Breakthrough refunds the unit's cost on top of
  counting toward the goal. Clash attack round uses the same formulas.
- Clash stall plateau: 808 bio (was 977) — stalling pays less, pushing pays more.

### Tower upgrade art (imposing by level)
- Generic all-type: Lv1 = four angled armor plates around the base; Lv2 = four
  radiating spikes, counter-rotating dashed containment ring, white-hot pulsing
  reactor core; whole chassis scales 1.0 → 1.13 → 1.26; glow 6+7*lvl.
- Per-type: sentinel gains longer/thicker barrels (twin at Lv2), thunder a
  wider barrel + muzzle brake at Lv2, hawk 3→4→5 missile pods.
- Upgrade now fires a gold particle burst + death ring + vibration.
- Browser-smoke visual gate: distinct-color count in the tower cell must
  escalate lv0 < lv1 < lv2 (measured Chromium 676→1513→2095, WebKit
  520→1276→1711).

### Projectiles + impact FX
- New `VFX.impacts` pool (capped 48): typed landings — shock (expanding ring +
  8 radial spokes) for splash, frost (6 crystal shards + core bloom) for
  slows, stun (bolt ring) for shockwave emitter, hit flash otherwise.
- Trails redrawn as tapering energy streaks; sentinel fires velocity-aligned
  tracer rounds; hawk missiles get flickering exhaust; thunder/nova layered
  plasma orbs with halo; shockwave double pulse rings.

### Verification
- 6 new headless tests (damage-pays-before-kills, no time bonus at wave
  completion, per-enemy cap, extractor card math 331, impact FX spawn, swarm
  progress income > idle) + browser visual gate; 80/80 headless green,
  Chromium/WebKit/touch smokes green.
- Balance audit re-run with round-39 formulas: endless w70 (unchanged — death
  point is DPS-bound, not money-bound), frost aura 0.820 (unchanged), cards
  18/18 read, all 5 assault maps winnable, Legendary w40 win. Standard
  opening is leaner (w1 ~61 vs old ~90 income), late game richer (w40 cum
  ~44.7k vs old ~27.6k): progress gets you cash.
- Tests updated to the new contract: scavenger wave-1 math (378), swarm bot
  window 120s→180s, reserve-exhaustion sim window widened.

### Version
7.5.0 (header, footer, package.json, package-lock).

## Round 38 — Hero manual control, aimed abilities, art overhaul

Branch feat/hero-control-art. User brief: keep auto mode as-is, add opt-in
tap-to-move and aimed casting, and make heroes visually recognizable (the old
shape-blob art was "bland and forgettable").

- **Manual control (opt-in)**: tap the hero to toggle `heroState.manual`.
  While manual: tap any non-buildable ground (path/void) to issue a move
  order (marker FX, hero walks there and holds); tap the hero again to hand
  control back. Auto-chase is suppressed in manual, everything else (auto
  attack, passives, damage) unchanged. Buildable cells still open the tower
  radial in manual mode — tower placement is never blocked.
- **Aimed abilities (opt-in)**: while manual, tapping an aimable ability
  button (Vex Orbital Barrage / Warden Shield Wall / Phantom Shadow Strike)
  arms targeting instead of casting; tap the field to cast there. Auto mode
  (or non-aimable abilities) casts instantly exactly as before. Phantom
  snaps to the enemy within 80px of the tap; missed phantom taps refund the
  cooldown. Cast bodies extracted to `castHeroAimAt(px,py)` so auto and
  aimed paths share one implementation.
- **Art overhaul**: drawHeroIcon rewritten per hero — Vex gets pauldrons,
  cape, glowing visor slit, rifle, pulsing chest core; Lyra hovers with
  thruster glow, round goggles, two orbiting tether-drones; Kael carries a
  full-height tower shield with cross-brace and pulsing rune diamond, horns,
  hammer peeking over the shoulder; Nyx is a dagger-cloak silhouette with a
  ghost afterimage, glowing eye slit, and wavy scarf ribbons; Zara floats
  under a rotating dashed halo with an 8-point star body, all-seeing eye
  core, and orbiting sparks. Heroes now draw at ~1 cell tall on field
  (visual radius max(stats.size, cellSize*0.85)) instead of a half-cell
  blob. Skins still recolor via getHeroColor.
- **HUD**: crosshair badge on aimable ability buttons (lit in manual),
  TAP TARGET pulse while aiming, MANUAL badge on the nameplate, rotating
  dashed selection ring, move-order ping, aim reticle with barrage radius.
- **State hygiene**: `G.heroAim` cleared on deploy/reset/startGame/
  endless+allied starts and on pause; manual/moveOrder reset per match.
- **Tests** (test/hero-control.test.mjs, 11 new): auto default + chase
  target tracking, toggle on/off, hold-position suppression, move order to
  a path point, radial-not-hijacked in manual, aim arm/cancel/no-cd, aimed
  warden wall snap + cd 40, auto-cast instant, phantom snap strike + cd 20,
  phantom miss refunds cd, roster renders all five artworks. 74/74 green;
  audit unchanged from round 37 (endless w70, frost 0.820) — zero balance
  drift since bots never leave auto mode.
- v7.3.0 → v7.4.0 (header, footer, package.json, lock file synced).
  How-to-play gained two lines (hero control + aimable abilities), checked
  to fit the existing layout budget on small screens.

## Round 37 — Balance upgrades: all ten review recommendations implemented

Branch feat/balance-upgrades (ff to main after). No review verdict was
taken on faith: every change re-measured with the audit tool and the
winnability gates re-run until green.

- **R9 cards (0986dab + second verification pass)**: hawkeye/heavy_rounds
  multiply getTowerStats range/damage; quick_reflexes scales
  orbital/chrono/repair CDs AND hero ability/ultimate CDs (the card says
  "Ability CD -15%" with no global-vs-hero carve-out, so the second
  verification pass extended it — verified Vex 45 -> 38.25 via real taps);
  thick_armor cuts leak life damage; drone_support = first Drone Bay
  free; rapid_deploy powers a REAL build-time system (1.5s mid-wave
  spin-up, 0.75s with card, progress arc drawn, build-phase placements
  are instant so pre-wave planning is never punished); frost_field is a
  true permanent 18% aura (probe ratio 0.820) — the per-frame slowTimer
  refill loops deleted, including the offense-mode copy that actively
  helped the AI's towers slow the player's own swarm.
- **R1+R8 clash (d4d85a4 + 0a6cedc retune)**: attack bio draws from a
  finite 360 reserve (120s x 3/s) + hard 120s round timer in the HUD;
  stall probe now caps at +359 bio and times out; skitterling-spam 0/10
  (attack takes mixed play; strategy bots still win). Defend budgets
  120+60i (classic midwave equivalent) — the naive x3.5 first reading
  made round-1 wave 5 endless-wave-23 hard and beat the bot outright.
- **R2-R4 economy (d4d85a4 + verification-pass deepening)**: Elite
  0.75/1.05, Legendary 0.65/1.1 with hpM 2.2 / cntM 1.1 carrying the
  tier; difficulty card discloses rewards/costs/density. Kill taper
  after w25, deepened in the verification pass from 0.025/60%-floor to
  0.035/50%-floor after an A/B against the pre-round build showed the
  first cut only trimmed 3% of the bank (Standard strong-bot peak bank
  15,071 → 14,602 → 13,295, -12% total; Legendary 7,681); waves 30-40
  density x(1+wave/120). Measured: afford cliff -43% -> -21%;
  **Legendary strong-bot minLives 10 -> 3** (dips w9-17, recovers) —
  the top tier now threatens strong play while staying winnable; weak
  6-tower bot still dies (w32).
- **R5**: barrier 5 -> 12 dps; sentinel card text honest ("Best damage
  per ◆"). The Citadel (only barrier offense map) keeps its
  skitterling-flood counter in the soak test.
- **R6**: skitterling 4 bio, blisterbomb 6. hp/bio spread now
  ironshell 13.0 > venomspine 10.4 > skitterling 9.8.
- **R7**: allied playerKills/aiKills attributed through the kill chain
  (t.isAI on direct kills, p._towerIsAI on projectiles) and shown on
  the victory screen.
- **R10**: campaign building costs +50% per same-type owned; helper is
  top-level (first nesting inside the tap handler broke rendering —
  caught by the new test).

**Two bot-infrastructure bugs surfaced by the retune (7b64c4a)**:
the plan/generic bots used a stale base-price table, so under costM>1
they burned plan slots on unaffordable taps (alone this flipped
Legendary from winnable to dead at w3); the generic bot had no
late-game flood and sat on a 17k bank while w37-40 stacked up. Both
fixed (live costs via _getTowerCosts, slot-burn stopped, flood added).

Tests: 49 -> 62 (new test/balance-fixes.test.mjs, 13 tests covering
every R mechanic). Full suite green, browser smoke green (Chromium +
WebKit + touch), audit re-run: cards 18/18 read, stall capped, ladder
re-measured, endless w70 (bot stronger), allied unchanged shape.

Verification pass (goal-completion audit) found and closed three gaps:
- R8's stated criterion ("bot still wins ~50-70% at 1000 elo") had never
  been measured. Measured via 3 full clash matches with _getClashState:
  6/6 defend rounds held at mean 14.3/20 lives (round-2 budgets at
  aiThreat 60 cost 8-12 lives) — defend is winnable by strong play and
  now visibly costly; attack stays winnable under the 120s timer.
- R3's first cut measured only -3% bank (A/B against a frozen
  pre-round-37 build in /tmp: baseline 15,071 exactly reproduced).
  Deepened the taper to 0.035/50% floor; Standard bank -12% total,
  Legendary -49% (7,681), minLives=3 preserved, all gates green.
- One assault soak 9/10 (map 1) investigated: flake (random spawn-path
  assignment on multi-path maps), 3x consecutive clean after.
New test hooks: _getClashState, _getEconomy.

Second verification finding — the assault soak flake was path-RNG, not
balance: The Citadel failed 3-6 runs in 6 regardless of strategy or the
R5 barrier value, and the frozen pre-round build failed it too (4/6)
with the same strategy — the map has 3 spawn paths and offense spawns
picked them RANDOMLY while defense waves already used deterministic
round-robin. spawnOffenseEnemy now round-robins paths like every other
spawn system: assault play becomes plannable instead of a free-lane
lottery, the gate is deterministic (5/5 clean since, across barrier 10
and 12 and reserve 700 and 800), and barrier returns to the full spec
value 12 with The Citadel at its original 700 reserve. Soak tempo for
rich maps tightened 40 -> 25 (faster, more robust clears).
