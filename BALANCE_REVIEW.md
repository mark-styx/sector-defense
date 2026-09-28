# BALANCE REVIEW — Sector Defense

Round 36 deep dive: mechanics and logic of the balance goals, judged against measured outcomes.
Method: static math extracted from the live game data tables (`node tools/balance-audit.mjs static`)
plus outcome-space measurement with the real-tap bots (`classic|allied|clash|endless`).
Every number below is machine-measured on the current build (v7.2.3, main @ 93d6968).

> **ROUND 37 STATUS: all ten recommendations implemented** (branch `feat/balance-upgrades`).
> Re-measured outcomes on the fixed build:
> - R1 clash attack: stall capped (bio 587→946 = +359 of 360 reserve), 120s timer ends
>   stalled rounds; skitterling-spam now LOSES 0/10 (attack needs mixed play; the
>   modes.test bot still wins it). Defend budgets recalibrated 120+60i (classic midwave).
> - R2 ladder: afford now 1.00/0.90/0.82/0.65 — the Elite→Legendary cliff is -21% economy
>   (was -43%) plus a visible stat jump (HP +120%, density +10%, disclosed on the card).
> - R3+R4 late game: Standard strong-bot peak bank 15,071→14,602 (30-tower flood absorbs
>   the rest); **Legendary strong-bot is no longer flawless: minLives=3 (dips waves 9-17),
>   recovers to 10** — the top tier finally threatens strong play. Weak 6-tower bot dies
>   w32 (was w35): skill cliff preserved.
> - R5 barrier 12 dps base (dps/100 5.0→6.0); sentinel card states its real role.
>   The Citadel (only barrier offense map) needed its skitterling-flood counter kept.
> - R6 skitterling 4 bio / blisterbomb 6: hp/bio spread now ironshell 13.0 > venomspine
>   10.4 > skitterling 9.8 (was skitterling dominant at 13.0).
> - R7 allied kills attributed live (playerKills/aiKills shown on the victory screen).
> - R9 cards: all 18 audit-read; frost_field probe 0.820 = the designed 18% aura;
>   rapid_deploy powers a real build-time system (1.5s spin-up mid-wave, 0.75s carded).
> - R10 campaign: building costs +50% per same-type owned (outpost 30→45→60...).
> Numbers in the findings below describe the round-36 build the review measured.


---

## The balance goals (as the project states them)

1. Standard = accessible baseline; "a bit too easy" was the live playtest verdict (round 33).
2. Difficulty ladder strictly harder per tier; winnable with strong play at every tier (rounds 34-35).
3. Offense maps: naive play ~90% winrate, strong play 12/12 (round 35).
4. Endless = survival marathon with a real death point.
5. Clash = Elo duel: defend a round, then attack the rival; Elo should track skill.
6. Allied = 30-wave co-op where the AI ally "helps".

## Verdict table

| System | Stated goal | Measured outcome | Verdict |
|---|---|---|---|
| Classic difficulty ladder | Strictly harder, winnable | Winnable: yes. Harder: only waves 2-7; flawless or near-flawless at all four tiers | **Broken at the top: no tier threatens strong play** |
| Classic economy | Constrain builds | Standard: 27,573 income vs ~4,755 needed; 15,071 banked | **Floods; money is meaningless after ~wave 16** |
| Skill curve | Casual wins, expert sweats | 6 towers = death w35; 16 towers = flawless all tiers | **Cliff, not slope; no nail-biter middle** |
| Tower roster | 10 meaningful choices | Sentinel 64 dps/$100 = 2x the field; barrier 2.5 | **One dominant tower, one dead tower** |
| Armor system | Big hits beat armor | 30-50% of late HP armored; nova 85.8 vs fusion 62.5 vs sentinel 20 dps vs arm10 | **Works. Genuine strength.** |
| Endless | Real death point | Strong bot dies w63 (10,466 kills) | **Passes; death is a 40+ min grind** |
| Clash defend | Duel pressure | 20/20 lives held; total budget 600 = classic wave ~5 | **Formality** |
| Clash attack | Contest vs AI | bio +9/s forever, no timer; stall+skitterling-spam = 10/10 | **Unloseable; Elo measures patience** |
| Allied | Co-op where ally helps | Ally builds 26 towers vs player 10; 26-30/30 lives; idle player dies w6 | **Ally carries late game; not AFK-winnable** |
| Offense unit menu | 7 meaningful units | Skitterling 13 hp/bio vs 10.4 next best; 32.5 survival-proxy vs 15.6 | **Cheapest unit dominates bio-efficiency** |

---

## Findings

### F1. The difficulty ladder punishes the wallet, not just the enemies (six-axis stack)

| tier | hpM | spdM | cntM | lives | start$ | rewM | costM | challenge* | afford** | stress |
|---|---|---|---|---|---|---|---|---|---|---|
| Standard | 1.15 | 1.08 | 1.00 | 18 | 300 | 1.00 | 1.00 | 1.24 | 1.00 | 1.2 |
| Veteran | 1.45 | 1.22 | 1.10 | 15 | 225 | 0.85 | 1.00 | 1.95 | 0.94 | 2.1 |
| Elite | 1.70 | 1.32 | 1.15 | 10 | 175 | 0.70 | 1.10 | 2.58 | 0.73 | 3.5 |
| Legendary | 2.05 | 1.50 | 1.00 | 10 | 150 | 0.50 | 1.20 | 3.08 | 0.42 | 7.4 |

\* hpM×cntM×spdM (spdM = time-in-range loss). \** kill income per wave / tower cost (rewM×cntM/costM).

- Stat-space difficulty rises smoothly (1.24 → 3.08, ~2.5x). But the **economy axis is where the ladder explodes**: Elite→Legendary affordability drops 0.73 → 0.42 (-43%) while enemy challenge rises only 19%. The single biggest jump between any two tiers is in the player's wallet.
- rewM (0.85/0.7/0.5) cuts kill income exactly when kills matter: kill rewards are ~50% of income during waves 1-10 (the pressure peak, F2) but only ~18% by wave 40 (flat 50+10w bonus dominates late). So the poverty penalty concentrates on the opening.
- Disclosure is code-verified one-sided: the difficulty select card shows "HP +X%, Speed +Y%" and "N lives • M nexium", but rewM (kill income -15/-30/-50%), costM (tower cost +10/+20%) and cntM (density) appear nowhere in the UI. The two harshest axes are the hidden ones; the milder ones are disclosed. Either disclose all axes or move the challenge into the disclosed ones.
- Genre critique: "enemies are tougher" reads fair; "you earn half and pay 20% more" reads punitive and is invisible until mid-match. Elite/Legendary punish experimentation (can't afford to try a tower) and slavishly reward the one proven build (F5).

### F2. The whole match is decided in waves 2-7; everything after is cleanup

Peak single-wave pressure (waveHP / cumulative income), per tier:

| tier | peak waves | w40 pressure |
|---|---|---|
| Standard | w7=0.95, w5=0.88 | 0.84 |
| Veteran | w5=1.40, w7=1.39 | 1.23 |
| Elite | w7=1.99, w5=1.80 | 1.57 |
| Legendary | w7=2.30, w5=2.16, w40=2.13 | 2.13 |

The opening (before the flat wave bonus + kill income compound) is 2-3x the pressure of the average late wave. Strong play that survives wave 7 has effectively won at every tier; the plan bot's full investment (~4,755: 1,750 towers + 3,005 upgrades) is fully re-earned by cumulative income at ~wave 16 (Standard: cumIncome w16 = 4,592, w20 = 6,572).

Caveat that strengthens the finding: the wave tables above exclude healer/spawner hidden HP. Plaguebearers heal 5 hp/s (stacking per healer, countered only by shockwave's heal-block) and hiveminds spawn 2 swarmers every 4s alive; estimated impact is +7.2% / +9.2% / +6.2% effective HP for waves 16-19 / 20-29 / 30-40 at Standard. Even with that correction the late waves sit well below the waves-2-7 peak.

### F3. Outcome-space: no tier threatens strong play; casual play hits a wall

Strong plan-bot, map 0, all 40 waves, real taps (measured this round):

| tier | result | lives lost across entire match | peak bank |
|---|---|---|---|
| Standard | victory | 0 of 18 | 15,071 |
| Veteran | victory | 0 of 15 | 14,140 |
| Elite | victory | 0 of 10 | 11,418 |
| Legendary | victory | finished 10/10, one observed dip to 9 (wave 2; the repair ability, +5 lives/120s, is in constant use from wave 1 at this tier since lives start at 10, so raw leak count is masked but small) | 3,871 |

Weak-bot (casual proxy), Standard: 4 towers → **gameover wave 17**; 6 towers → **gameover wave 35**.

So the outcome distribution is bimodal: placement quality + tower count either flawless-wins or loses mid-run. There is no configuration measured where a decent player sweats. The user's "a bit too easy" is quantified: 18/18 lives, 15k unspent.

### F4. The economy floods after the mid-game

Standard 40-wave income: 27,573 total (start 300 + kills + bonuses) vs ~4,755 for a full endgame board. Even the late-mix tower spam only spends it down to a 15k peak bank. Kill income alone at wave 40 (2,036) re-earns the entire plan investment every ~2.3 waves. Consequences: no build-order decisions late, no sell/refund decisions, upgrades are no-brainers, and the emergencyFund/tactical_retreat card perks are dead weight for anyone past wave 20.

### F5. Tower roster: sentinel doubles the field, barrier is nearly dead

Per-nexium single-target DPS (armor 0), live formulas from `getTowerStats`:

| tower | cost | dps@L0 | dps@L2 | dps/$100 @L0 | dps/$100 @L2 | vs armor-10 @L2 |
|---|---|---|---|---|---|---|
| sentinel | 50 | 32 | 70 | **64.0** | **46.7** | 20 |
| fusion | 250 | 83.3 | 187.5 | 33.3 | 28.8 | 62.5 |
| dronebay | 275 | 75 | 168.7 | 27.3 | 24.3 | 75 |
| hawk | 100 | 30 | 66.7 | 30.0 | 24.7 | 45.8 |
| arctesla | 225 | 48.8 | 110.9 | 21.7 | 19.3 | 48.4 |
| thunder | 150 | 26.7 | 60 | 17.8 | 15.0 | 51.7 |
| shockwave | 175 | 30 | 67.5 | 17.1 | 14.4 | 42.5 |
| nova | 300 | 40 | 90 | 13.3 | 11.2 | **85.8** |
| neural | 200 | 10 | 20.8 | 5.0 | 4.2 | 4.2 |
| barrier | 200 | 5 | 9 | 2.5 | 1.7 | 9 (bypasses armor) |

- **Sentinel is 2x the field on dps-per-nexium** at L0 and still 1.6x at L2. Optimal play is sentinel flood + big-hit towers for bosses; both bots that "prove winnability" independently converged on sentinel-majority builds. That IS the meta, hidden in plain sight.
- **Barrier is nearly dead**: 5-9 dps for 200. Its slow doesn't stack (same 0.4x as neural) and neural covers the same role with 10-20 dps and a bigger radius. Barrier's only unique trick is armor-bypass, at a dps level where it doesn't matter.
- **Shockwave reads as a bad dps tower but is actually the anti-heal answer**: any shockwave hit disables Plaguebearer healing for 3s (healDisabled), the only counter to a mechanic that adds an estimated +6-9% effective HP in waves 20-40 (see F2). Nothing in its card ("Disable heal" is the entire description) conveys that this is its job, so players will skip it reading it as a weak damage tower, then lose slowly to heal-stacked waves. Role clarity fix, not a stat fix.
- **Tower activated abilities are pure upside humans get and the measured tables don't include** (bots never tap them): sustained value if used on cooldown is x1.17 (sentinel Overdrive) to x1.24 (barrier Fortify), plus burst/control actives (Firestorm nuke, Barrage, Neural Storm AOE that bypasses armor, Supercharge 5x, Shockpulse stun). Every number in this review is therefore a floor for human play.
- Fusion L2 is the single-target king (187.5) and armor flips it vs nova, which is good rock-paper-scissors... except armor values (5/10) hit fusion's per-tick (dmg/6) hardest: the design works, see F6.
- Air coverage is implicit: only hawk can *target* flying, but fusion/arctesla/dronebay/barrier all hit air incidentally and splash damages it. Air pressure is therefore soft everywhere; stingwing/phasewraith never force the anti-air answer.

### F6. The armor system is the one balance mechanic that genuinely works

Armored (>=5) share of wave HP: waves 1-9: 29.7%, 10-19: 37.2%, 20-29: 43.8%, 30-40: 40.8%.
Vs armor 10 the ranking inverts: nova 85.8 > dronebay 75 > fusion 62.5 > thunder 51.7 > arctesla 48.4 > sentinel 20.
Chaff-tower spam alone struggles vs bosses; big-hit towers alone waste damage on chaff. This is real, loadout-visible rock-paper-scissors and should be protected in any retuning.

### F7. Clash: the duel is decided by patience, and it cannot be lost on attack

Measured (this round, elo 1000):
- **Defend round is a formality**: total 5-wave budget = 600 threat-dollars ≈ classic wave 5-6 pressure; generic bot holds 20/20 lives.
- **Attack round is unloseable**: bio regenerates +3/s with no cap (measured 551 → 2,171 over 180s idle), there is no round timer, and the only defeat check requires bioMass<=0 which infinite regen makes unreachable. From a stalled bank, pure skitterling spam wins 10/10.
- The code comment says "Bio regenerates (parity with offense mode)" — that parity was deleted in round 35 when offense got a finite reserve; clash attack kept the infinite regen.
- Net: clash Elo (+/-20/round) inflates for anyone willing to wait. At 1800 elo the defend budget only reaches 324/wave — still below classic wave 8. aiDifficulty scaling (1.0 → 1.8) is far too weak to matter.

### F8. Allied: the ally carries the late game; the player carries the early game

Measured (player bot restricted to the left half, ally owns the right half):
- Ally out-builds the player **26 towers to 10-11** by wave ~22 (ally income 25+5w every ~5s during build+wave ≈ 900-1,800 per wave-cycle late game, vs player ~550-800: 50+10w bonus + kills).
- Runs finish 30/30 and 26/30 lives (variance) with a 10-tower player.
- Idle probe (player builds nothing, waits 30s per build phase): **gameover at wave 6-12 of 30 across runs** (9-25 ally towers, RNG-dependent). The ally cannot solo; the player's early towers are load-bearing.
- Verdict: the mode is a spectator sport after ~wave 15 unless the player deliberately builds little. Also `allied.playerKills`/`aiKills` are initialized, reset, displayed-adjacent, and **never incremented anywhere** — the end screen shows 0/0 kills no matter what happens (truth-in-UI bug, same class as the round-34 RECRUIT descriptions).

### F9. Offense: the cheapest unit is the most bio-efficient

| unit | bio | hp (1.3x pin) | hp/bio | hp×spd/bio |
|---|---|---|---|---|
| skitterling | 3 | 39 | **13.0** | **32.5** |
| blisterbomb | 5 | 52 | 10.4 | 31.2 |
| tunneler | 12 | 130 | 10.8 | 19.5 (+burrow immunity) |
| venomspine | 10 | 104 | 10.4 | 15.6 |
| devastator | 40 | 1040 | **26.0** | 15.6 (+armor 10) |
| ironshell | 20 | 260 | 13.0 | 13.0 (+armor 5) |
| stingwing | 15 | 78 | 5.2 | 11.4 (+flying) |

- Skitterling leads hp/bio among small units AND hp×spd/bio by 2x (the survival proxy that accounts for time under fire). The global spawn CD (0.2s, 5 units/s) is the only thing keeping spam in check; the round-35 reserve caps total bodies.
- Devastator's raw hp/bio (26) is fair for a slow boss; the middle of the menu (venomspine, stingwing) is dominated. FRENZY (0.1s CD) multiplies spam value by exactly 2.
- The 12/12 soak bot used venomspine+devastator and won anyway — the mode tolerates suboptimal play (by design, ~90% naive winrate), but the efficiency table shows the intended "unit puzzle" has a known answer. Postscript: during this round's verification the Citadel soak test flaked once at 9/10 units, then passed 4/4 consecutive runs — the strongest map's strong-play margin is thin enough to straddle randomness, consistent with the round-35 tuning history (reserve 500 → 700, bio 200 → 300).

### F10. Endless passes, but the death curve is a grind

Strong bot: dies at wave 63 with 10,466 kills. Budget 100×1.08^w compounds at the same rate as kill income (~0.65 × budget) plus a linear bonus, so marginal difficulty is nearly flat from wave ~25 until the map saturates; the last ~20 waves are endurance, not escalation. Fine for a marathon mode; listed for completeness.

### F11. Heroes sit on top of the economy, not inside it

Oracle's passive (+2 nex/s ≈ +120/min) is a bigger economy lever than the entire Elite-vs-Standard rewM gap at mid-game. Vanguard's ult (2x fire, 10s/90s ≈ +11% average dps) and Phantom's 500-dmg/20s strike are large-but-optional power adds. Balance was tuned (and bot-proven) without heroes, so heroes make every tier easier for humans than the bot measurements show — worth stating in the difficulty select screen ("+hero = one tier easier") rather than retuning around.

Progression pacing (the Legendary gate): addXP = waves×10 + kills + stars×50 and commander level L needs 50×L×(L-1) cumulative XP, so level 20 = 19,000 XP. A flawless win earns 1,879-2,090 XP depending on tier (kills dominate), making the gate 10-11 flawless wins — roughly 3-5 hours of strong play, longer for casual. Reasonable for a mobile arc; no change recommended.

### F12. Campaign strategic layer: escalating defense is real, the economy is decorative

- Income: start 60/turn (3 starting territories at 25/20/15), full map ~300/turn. The only building with a return is the Outpost: 30 cost, +15/turn = 2-turn payback, plus +50 defense nexium — strictly dominant over Garrison (40, +3 lives) and Lab (50, +5% damage), which are defense-only side-grades. No upkeep, no cost scaling, no sink past mid-game; the bank floods exactly like the tactical economy (F4).
- Swarm pressure is the layer's real tension and it works: threat +0.35/turn drives neutral-expansion probability 0.51 → 0.85, player-attack probability 0.19 → 0.70, defense waveCap 10 → 18 and defense difficulty to Elite by ~turn 17. Turtling is genuinely punished with harder fights.
- But money never gates a decision: attacking costs 2 AP (not nexium), buildings and recruits cost 20-50 against an income that passes 100/turn by mid-game, so by turn ~5 every option is always affordable. Strategic decisions are only "what order", never "afford or not".
- Attack difficulty still derives from map distance only (open item 4, MODE_REVIEW.md).

### F13. Arsenal cards: six of eighteen are dead, one is a trap

Automated symbol-read audit (every card's bonus symbol must be read somewhere past its setup code — `node tools/balance-audit.mjs cards`) plus live probes:

**Dead — equipped, zero effect (6):** rapid_deploy ("Towers build 50% faster": no build-time system exists in the game at all), hawkeye (+10% range: rangeMultiplier never read), heavy_rounds (+10% damage: damageMultiplier never read), quick_reflexes (ability CD -15%: abilityCdMultiplier never read), thick_armor (enemies deal 1 less life dmg: thickArmor never read — leaks subtract `e.livesCost` raw), drone_support (free Drone Bay: droneSupportUsed never consumed).

**Trap — works, but not as described (1):** frost_field ("All towers slow enemies slightly") applies a 0.5s 40% slow only when an enemy's slowTimer is exactly 0. The refill guard is `!slowTimer`, but floating-point decay from 0.5 by 1/60 steps never lands on exactly 0 again, so each enemy is slowed once for its first half-second and never after. Measured: 180-frame path-progress ratio 0.903 vs unequipped (a permanent slow would read ~0.4). Net effect over a full path traverse: ~2-3% average speed reduction — the card that reads strongest is close to worthless.

**Working as described (11):** deep_pockets, scavenger, iron_will, lucky_strike, tactical_retreat, chain_reaction, emergency_fund, veterans_insight, overclocked, reflective_shield, nexium_generator.

Commercial severity: cards are the unlock economy (a random card per win, on top of store purchases). 7 of 18 (39%) are duds or near-duds — players grind matches to unlock effects that do not exist. Same truth-in-mechanics class as the round-34 RECRUIT bug, but in the progression/monetization layer. Among the 11 working cards the power spread is reasonable (iron_will +30% effective lives at Elite/Legendary, nexium_generator ~+1.8-3k nex per full match, scavenger ~+2.6k at Standard, overclocked/lucky_strike ~+10-11% dps) and the 3-card equip limit keeps stacking in check.

---

## Recommendations, prioritized

| # | Fix | Expected effect | Effort/risk |
|---|---|---|---|
| R1 | **Port the finite bio reserve to clash attack** (and/or add a 120s round timer) | Closes the unloseable-round hole; makes clash Elo mean something | Small; mirror of round-35 code, low risk |
| R2 | **Flatten the economy axes of the ladder**: rewM 0.85/0.75/0.65, costM 1/1.05/1.1; push the difference into hpM/cntM (e.g. Legendary cntM 1.0→1.1, hpM 2.05→2.2 if needed) | The Elite→Legendary cliff becomes a stat change the player can see and respect, not a pay cut | Medium; re-run the bot ladder after |
| R3 | **Trim late-game income** (kill rewards taper after wave 25, or wave bonus scales down instead of up) | Money stays scarce; late waves force sell/upgrade decisions; fixes F4 | Medium; watch weak-bot results |
| R4 | **Add late-wave escalation for strong play**: waves 30-40 density bump (cntM applied progressively, e.g. ×(1 + wave/80)) so flawless runs stop being free | Direct answer to "a bit too easy" without touching the accessible opening | Medium; must re-verify all tiers + gauntlet |
| R5 | **Buff barrier** (dps 5→12, or make its slow stack to 0.65x) and **state sentinel's role honestly** ("best sustained damage per nexium") in its card | Roster feels like 10 choices instead of 8 + 2 traps | Small |
| R6 | **Reprice offense skitterling** 3→4 bio (and blisterbomb 5→6) | Menu middle becomes viable; spam stops dominating efficiency table | Small; re-run 5-map soak |
| R7 | **Fix `allied.playerKills`/`aiKills`** (increment in killEnemy by tower ownership) or remove the stat from the UI | Truth-in-UI, round-34 class of bug | Small |
| R8 | **Scale clash defend budgets** to classic-midwave equivalents (budget ×3-4) so the defend half of each round is a real contest | Both halves of the duel matter | Medium; verify bot still wins ~50-70% at 1000 elo |
| R9 | **Wire or remove the six dead arsenal cards** (rapid_deploy, hawkeye, heavy_rounds, quick_reflexes, thick_armor, drone_support) and fix frost_field's refill guard (`!slowTimer` → `slowTimer<=0`) | 39% of the unlock economy stops selling duds; frost_field becomes the aura its card promises (then re-check dominance: a true permanent 40% global slow may need toning to 15-20%) | Small for wiring/removal; frost_field rebalance medium |
| R10 | **Campaign economy sink**: scaling building costs (cost × (1 + owned × 0.5)) or per-turn upkeep, so "afford or not" becomes a decision | Strategic layer gains real trade-offs; outpost spam stops being a no-brainer | Medium; replay a full campaign after |

Not recommended: retuning around heroes (F11), endless curve changes (F10 passes), touching the armor system (F6 works).

## What is genuinely good (keep)

- Armor/counter-armor inversion (F6): the deepest mechanic in the game; boss waves genuinely change the answer.
- Winnability discipline: every mode is bot-proven winnable with real taps; that bar caught real regressions in rounds 34-35.
- The 1.08 endless curve with tier-gated units: no unfair early bosses.
- Mode-premise unification (round 34) and the finite offense reserve (round 35) did fix what they claimed to fix.

## Reproduce

```
node tools/balance-audit.mjs            # full report (static + all dynamic)
node tools/balance-audit.mjs static     # tables 1-6 (pure math, ~instant)
node tools/balance-audit.mjs classic    # tables 7-8 (~60s: 3 full 40-wave runs + weak-bot runs)
node tools/balance-audit.mjs legendary  # table 7b (Legendary margin, ~20s)
node tools/balance-audit.mjs allied     # table 9 (~10s)
node tools/balance-audit.mjs clash      # table 10 (~20s, includes the stall test)
node tools/balance-audit.mjs endless    # table 11 (~15s)
node tools/balance-audit.mjs cards      # table 12: card symbol-read audit + frost_field probe (~10s)
```
