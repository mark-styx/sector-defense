# Sector Defense — App Store Compliance Guide

## Age Rating

**Recommended rating: 9+**

Apple's age rating questionnaire answers:

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | Infrequent/Mild |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, or Drug Use or References | None |
| Simulated Gambling | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Mature/Suggestive Themes | None |
| Unrestricted Web Access | None |
| Gambling and Contests | None |

**Rationale:** The game features abstract geometric shapes (circles, hexagons, pentagons) attacking along a path. No blood, gore, or realistic violence. Enemies "die" by shrinking/fading with particle effects. This is comparable to Bloons TD 6 (rated 9+) and Kingdom Rush (rated 9+).

## Export Compliance (ECCN)

**Uses encryption: YES (HTTPS only)**

The app uses HTTPS for loading Google Fonts. It does NOT implement custom encryption or use encryption for purposes other than standard web protocols.

**ECCN exemption applies:** The app qualifies for the TSU (Technology and Software Unrestricted) exception under EAR 740.13(e). Standard HTTPS/TLS used by web browsers is exempt.

When submitting to App Store Connect:
- "Does your app use encryption?" → **Yes**
- "Does your app qualify for any of the exemptions?" → **Yes**
- "Is your app designed to use cryptography or contain/incorporate cryptography that is not listed?" → **No**
- Select: "Your app makes HTTPS connections only"

No Encryption Registration (ERN/CCATS) filing required.

## Privacy Questionnaire (App Store Connect)

| Question | Answer |
|---|---|
| Data collected | None |
| Data linked to user | None |
| Data used for tracking | None |
| Third-party analytics | None |
| Third-party advertising | None |

**Privacy Nutrition Label:** The app collects NO data. Select "Data Not Collected" for all categories.

The app stores gameplay progress locally on the device using localStorage. This data never leaves the device and is not accessible to the developer.

## In-App Purchases

All IAP will be processed through Apple's StoreKit. Current IAP items to register:

| Product ID | Type | Price | Description |
|---|---|---|---|
| `com.helixgames.sectordefense.credits100` | Consumable | $0.99 | 100 Helix Credits |
| `com.helixgames.sectordefense.credits500` | Consumable | $3.99 | 500 Helix Credits (+50 bonus) |
| `com.helixgames.sectordefense.credits1200` | Consumable | $7.99 | 1200 Helix Credits (+200 bonus) |
| `com.helixgames.sectordefense.credits3000` | Consumable | $17.99 | 3000 Helix Credits (+750 bonus) |
| `com.helixgames.sectordefense.bundle_starter` | Non-Consumable | $2.99 | Starter Bundle |
| `com.helixgames.sectordefense.bundle_commander` | Non-Consumable | $6.99 | Commander Bundle |
| `com.helixgames.sectordefense.bundle_ultimate` | Non-Consumable | $14.99 | Ultimate Bundle |

Note: IAP is currently simulated in the web version. Real StoreKit integration will be done during the Capacitor/native packaging phase.

## Third-Party Content

| Library/Asset | License | Commercial Use |
|---|---|---|
| JetBrains Mono (Google Fonts) | SIL Open Font License 1.1 | Allowed |
| Inter (Google Fonts) | SIL Open Font License 1.1 | Allowed |

No other third-party libraries, SDKs, or assets are used. All game code, art, sound, and music are original.

## App Store Metadata (Draft)

**App Name:** Sector Defense  
**Subtitle:** Tower Defense Evolved  
**Category:** Games → Strategy  
**Keywords:** tower defense, strategy, sci-fi, tactical, campaign, heroes, endless mode  
**Price:** Free (with IAP)  

**Description:**
Defend The Helix Sector in this deep, feature-rich tower defense experience. Build, upgrade, and command 10 unique tower types across 10 maps in 3 biomes. Deploy powerful heroes with unique abilities, conquer territories in the strategic Helix War campaign, and test your skills across 6 game modes.

Features:
• 6 game modes including Classic Defense, Endless Mode, and the strategic Helix War campaign
• 10 unique towers with upgrade paths and special abilities
• 5 heroes with passive abilities, active skills, and ultimate powers
• 10 hand-crafted maps across Urban, Volcanic, and Arctic biomes
• 4 difficulty levels from Standard to Legendary
• Helix Store with cosmetic hero skins, tower packs, and map themes
• Achievement system with 20+ challenges
• Commander profile with XP and leveling

**Privacy Policy URL:** [Will be set to deployed privacy.html URL]
**Support URL:** [Will be set to deployed index.html URL]

## Content Rights

All game content (code, visual design, audio, game design) is original work.

**IP Clearance:**
- "The Helix Sector" — original universe, no existing IP conflicts
- "Nexium" — original in-game currency name
- All hero names (Commander Vex, Dr. Lyra Sol, Kael Ironhart, Nyx Shade, Zara Prime) — original
- All tower names — original (Arc Tesla, Nova Cannon, Fusion Beam, etc.)
- All enemy names — original (Skitterling, Devastator, Hivemind, etc.)
- Game mechanics are genre-standard tower defense, no patented systems used

## GDPR / CCPA Compliance

- No personal data collected, processed, or stored on any server
- No user accounts or registration
- No analytics or tracking
- All data is local to the device and controlled entirely by the user
- Users can delete all data by uninstalling the app or clearing app data
- Privacy policy clearly states all of the above
