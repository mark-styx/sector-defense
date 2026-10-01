# Sector Defense — Critical Mode Review (Round 34)

Verdict per mode, grounded in code paths (line refs from v7.2.1). Written as a
design critique, not a changelog. Fixes applied this round are marked **[FIXED]**.

## The core problem: no connective fiction

Six modes share one fiction loosely at best. The Swarm is "the enemy" in
Classic/Endless/Allied/Campaign-defense — then you *play as the Swarm* in
offense modes with zero narrative bridge. Nothing tells you that offense is
"weaponized captured strains." The premise existed only in fragments
("Command the Vanguard forces", "The Swarm Hive has been destroyed"), never
stated up front, never connected across modes.

**[FIXED]** Unified premise now threaded through every mode briefing:
"The Swarm overran the Helix Sector. You command the last Vanguard — and you
wield a captured hive-strain as a weapon." Attack modes are explicitly the
captured strain; defense modes are the Vanguard.

## Helix War (campaign) — mechanically sound, verbally dishonest

The underlying systems are real and complete (verified in code):
- Turn economy: 2 AP/turn (build 1, recruit 1, attack 2), income per territory
  +15/outpost, collected on end-turn. getCampaignIncome() does exactly this.
- Buildings do what they say: outpost +15/turn AND +50 start nexium in defense;
  garrison +3 defense lives per level; lab +5% tower damage.
- Win: capture territory 18 (Swarm Hive) or hold 15/20. Lose: capital (0) falls
  or fewer than 2 territories. checkCampaignVictory/Defeat().
- Swarm turn: aggression +0.35/turn drives expansion chance, attack chance and
  defense-battle difficulty. Genuine escalating pressure.

What was broken was the *communication*:
1. **RECRUIT descriptions were lies.** Infantry "+3 lives when attacking",
   Armor "+15% tower damage", Artillery "Free starting tower" — none of these
   mechanics existed. Army had exactly ONE effect: bio-mass at assault start
   (220 + inf×35 + arm×25 + art×50). The game actively misdescribed its own
   mechanics. **[FIXED: descriptions now truthful AND armies have distinct
   effects — armor pre-shields the swarm, artillery deploys free Devastators]**
2. **No owner legend, no on-map objective.** Blue/red/gray hexes with no key;
   win condition buried in the entry menu, absent from the map. **[FIXED:
   legend + "take the Swarm Hive" objective line on the map header]**
3. "Threat" is the swarm's aggression meter but reads like a danger stat you
   should fear passively. **[FIXED: renamed "Swarm Aggression"]**
4. Defense battle length was invisible before committing. **[FIXED: wave count
   shown on the attack warning screen]**
5. The army→bio-mass connection was never stated where you spend it.
   **[FIXED: stated in attack-select + recruit UI]**

### Campaign assault follow-up (2026-10-01)

Occupied territory now has a live defender that buys towers and upgrades during
the assault, funded by starting Nexium and capped damage income. Purchases obey
map restrictions, placement rules, ordinary prices and construction time.
Attacker cards and hero bonuses do not strengthen the defending towers.

Neutral land without a garrison or stationed army now auto-captures for 2 AP.
The army moves into the captured territory intact, and no battle rewards or
battle-win count are granted. Swarm occupation always requires combat.
Capture feedback and the assault HUD explain these outcomes. Regression tests
cover capture, defender spending, pause/cleanup and a recruitable Hive assault;
Chromium and WebKit verify the touch flow and visible construction.

## Swarm Commander — two currencies named "bio", no pressure

- Premise was "reverse roles," a mechanic, not a reason. **[FIXED: captured
  hive-strain framing]**
- bio-mass (spawns, regenerates) vs bio-energy (abilities, charges over time):
  two resources both named "bio" with different symbols. **[FIXED: bio-energy
  relabeled PULSE ⚡]**
- Lose condition is near-unreachable (bio regenerates forever; you can only
  abandon). A fortress-escalation timer was prototyped this round to add
  pressure and **reverted**: it repeatedly broke winnability of Citadel for
  the weakest viable strategy. Honest conclusion: this mode is an
  unlimited-attempt siege puzzle; the abandon-with-confirm (added round 33)
  is the right exit, and stakes come from the mapsCleared/Titan progression.
  A real fail state needs a redesign (e.g. limited bio reserve), not a patch.
- Difficulty is not selectable and silently borrows DIFFS[0] stat multipliers.
  **[FIXED: player-swarm units pinned to fixed hp×1.30/speed×1.0 so defense
  difficulty tuning no longer leaks into assault balance]**

## Sector Clash — hidden logic, anonymous opponent

- The defend/attack alternation and best-of-5 structure are sound; the
  momentum economy (kills → threat → attack bio; AI mirror) is real but was
  labeled "Threat," a word that reads as bad news, not as a spendable resource
  you build. **[FIXED: "Momentum built / Rival momentum"]**
- The opponent was "the AI." No identity, no stakes. **[FIXED: RIVAL VEK,
  named on the attack HUD]**
- Elo/badges work; payouts itemized since round 33.

## Allied Defense — coherent but unexplained

Shared lives, split map, 30 waves: internally consistent. Kira's economy
(own nexium, own build AI) is real. Only the framing was missing.
**[FIXED: briefing states the pact, the split, the shared lives]**

## Classic / Endless — the good ones

Classic is the reference implementation: honest HUD, clear economy, wave
previews, 3-star logic. Endless reuses it with budget scaling and tier gates.

## Difficulty (the other round-34 directive)

Lives were the wrong lever (user's call, confirmed by measurement: a strong
bot finished Standard 18/18 before AND after the first stat bump — stat
multipliers alone don't threaten optimized play). New ladder, all axes up at
every stage vs v7.2.0:

| Stage      | HP    | Speed | Density | (old)        |
|------------|-------|-------|---------|--------------|
| Standard   | ×1.15 | ×1.08 | ×1.00   | 1.0/1.0/1.0  |
| Veteran    | ×1.45 | ×1.22 | ×1.10   | 1.3/1.15/1.0 |
| Elite      | ×1.70 | ×1.32 | ×1.15   | 1.6/1.3/1.0  |
| Legendary  | ×2.05 | ×1.50 | ×1.00   | 2.0/1.5/1.0  |

Density (cntM) multiplies wave composition for classic/campaign-defense only;
endless keeps budget scaling; clash keeps its own threat curves. Legendary runs
density ×1.0 because ×1.2 was proven unwinnable-by-strong-play (bot dies wave 9).

## Open items this review exposes (not fixed this round)

1. ~~Swarm Commander still lacks a true fail state~~ **RESOLVED (round 35):**
   bio regen now draws from a finite per-map reserve (Weak Point 250,
   Gauntlet 200, Iron Wall 600, Fortress 600, Citadel 700 + start 300).
   Reserve spent + bio below the cheapest unit + nothing alive = assault
   lost. The reserve is on the HUD, the map-select cards and the briefing.
   Citadel rebalanced (200→300 start) because its old design was only
   "winnable" by grinding ~2000 regen bio — exactly the pathology the
   reserve kills.
2. Five in-combat currencies across modes (nexium, bio, pulse, momentum,
   campaign nexium-bank). Momentum and campaign-bank are the same concept
   ("war resources from performance") and could merge in name.
3. Allied Defense is 30 waves (~15 min) — the longest mode; consider 20.
4. Campaign difficulty (di) derives from map distance only; aggression affects
   defense but not enemy composition of your own attacks.
