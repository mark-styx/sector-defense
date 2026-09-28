# BALANCE REVIEW — Sector Defense

Round 36 deep dive: mechanics and logic of the balance goals, judged against measured outcomes.
Method: static math extracted from the live game data tables (`node tools/balance-audit.mjs static`)
plus outcome-space measurement with the real-tap bots (`classic|allied|clash|endless`).
Every number below is machine-measured on the current build (v7.2.3, main @ 93d6968).

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
| Classic difficulty ladder | Strictly harder, winnable | Winnable: yes. Harder: only waves 2-7; flawless at all tiers | **Broken at the top: no tier threatens strong play** |
| Classic economy | Constrain builds | Standard: 27,573 income vs ~5,025 needed; 15,071 banked | **Floods; money is meaningless after ~wave 16** |
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

### F3. Outcome-space: no tier threatens strong play; casual play hits a wall

Strong plan-bot, map 0, all 40 waves, real taps (measured this round):

| tier | result | lives lost across entire match | peak bank |
|---|---|---|---|
| Standard | victory | 0 of 18 | 15,071 |
| Veteran | victory | 0 of 15 | 14,140 |
| Elite | victory | 0 of 10 | 11,418 |
| Legendary | (locked at lvl 20; proven winnable round 34, bot died only in the ×1.15-density variant) | | |

Weak-bot (casual proxy), Standard: 4 towers → **gameover wave 17**; 6 towers → **gameover wave 35**.

So the outcome distribution is bimodal: placement quality + tower count either flawless-wins or loses mid-run. There is no configuration measured where a decent player sweats. The user's "a bit too easy" is quantified: 18/18 lives, 15k unspent.

### F4. The economy floods after the mid-game

Standard 40-wave income: 27,573 total (start 300 + kills + bonuses) vs ~5,025 for a full endgame board. Even the late-mix tower spam only spends it down to a 15k peak bank. Kill income alone at wave 40 (2,036) exceeds the entire plan investment every ~2.5 waves. Consequences: no build-order decisions late, no sell/refund decisions, upgrades are no-brainers, and the emergencyFund/tactical_retreat card perks are dead weight for anyone past wave 20.

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
- Idle probe (player builds nothing, waits 30s per build phase): **gameover at wave 6 of 30** (9 ally towers). The ally cannot solo; the player's early towers are load-bearing.
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

### F12. Campaign (recap, mostly resolved in rounds 34-35)

Defense now scales (diffIdx = min(2, threat/3), waveCap 10-18) and army effects are real. Remaining known gap (open item 4 in MODE_REVIEW.md): attack difficulty derives from map distance only.

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
node tools/balance-audit.mjs allied     # table 9 (~10s)
node tools/balance-audit.mjs clash      # table 10 (~20s, includes the 180s stall test)
node tools/balance-audit.mjs endless    # table 11 (~15s)
```
 # table 11 (~15s)
```
