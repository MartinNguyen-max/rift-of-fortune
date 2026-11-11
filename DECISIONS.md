# Decisions Log

Decisions made while building the MVP autonomously, with the reasoning.

## Step 1 – Scaffold

- **ESLint instead of oxlint.** The current Vite template ships oxlint, but CLAUDE.md and the task ask for ESLint. Used ESLint 10 flat config with `typescript-eslint` (strict preset), `react-hooks` and `react-refresh`.
- **TypeScript 6.0 instead of 7.0.** The Vite template uses TS 7, but `typescript-eslint` only supports TS < 6.1 for now. Upgrade once it supports TS 7.
- **Strict TS plus `noUncheckedIndexedAccess`.** Safer access into champion/item maps and arrays.
- **Vitest `pool: 'vmThreads'`.** The default `forks`/`threads` pools crash on this Windows machine (`Cannot read properties of undefined (reading 'config')`) in both Vitest 4 and 5, likely because of the lowercase drive letter in the path. `vmThreads` works. Try removing it on another machine or in CI.
- **Tailwind v4 via `@tailwindcss/vite`.** No `tailwind.config.js` needed. Theme colours live in `src/index.css`.
- **`npm run data` runs `node scripts/fetch-data.ts` directly.** Node 22.18+ strips TypeScript types natively, so no `tsx`/`ts-node` dependency.
- **`@dnd-kit/core` only.** Sortable/utilities aren't needed for dropping cards into slots.
- **npm audit warning (minimatch, moderate)** comes from ESLint's dev-only tooling. It does not ship to the browser. The only "fix" downgrades ESLint, so it was left as is.

## Step 2 – Data

- **One output file, `src/data/game-data.json`** (`{ patch, champions, items }`), typed by `src/data/types.ts` and loaded through `src/data/index.ts`.
- **Pure transform logic lives in `scripts/transform.ts`** (tested), the network/file code in `scripts/fetch-data.ts`.
- **"Full item" filter:** on Summoner's Rift (map 11), purchasable, built from components and builds into nothing, total cost ≥ 2000 gold, not boots/consumable, no champion- or Ornn-only items, id < 10000. The id rule drops copies of items for other modes (Arena/Swiftplay ids like `323003`). The gold rule drops support-quest upgrades (400g), Mejai's (1500g) and Gunmetal Greaves. Duplicates by name keep the lowest id. Result: ~105 items.
- **Item stats are parsed from the description's `<stats>` block**, not Data Dragon's `stats` object, because the latter misses Ability Haste, Lethality, Omnivamp and more.
- **Damage type and melee/ranged come from Meraki** (`adaptiveType`, `attackType`).
- **New champions missing from Meraki** (currently Locke and Zaahen) get positions guessed from their main Data Dragon class, and a damage type from `info.attack` vs `info.magic`. The script prints a warning listing them.
- **Images are loaded from Riot's Data Dragon CDN at runtime**, not committed. This keeps the repo small, and it's how Riot intends the CDN to be used. Only the JSON data is committed.

## Step 3 – Map

- **Map background is Data Dragon's `map11.png` minimap.** Slots sit on top of it at fixed percentages, so the map scales with the screen.
- **The team is drawn on the blue side** (bottom-left base), so Jungle sits in the blue jungle and ADC/Support share the bottom-right lane corner.
- **Role labels:** Top, Jungle, Mid, ADC, Support. Internally they map to Meraki's `TOP/JUNGLE/MIDDLE/BOTTOM/SUPPORT`.

## Step 4 – Roll and placement

- **Game state is a pure reducer** (`src/game/gameState.ts`). Randomness happens outside it (`rollChampion` gets a random function), so the reducer and tests stay deterministic.
- **Roll animation:** about 24 random champion icons flash by while the delay grows (slot-machine style), then it lands on the pre-chosen champion. Framer Motion adds the slide-in per frame and a spring "pop" on the reveal. Icons are preloaded right before the spin.
- **Placement:** drag the champion with dnd-kit, or click a glowing empty slot. Click is the accessible fallback. Keyboard dragging also works via dnd-kit's `KeyboardSensor`. A placed slot can't be changed (locked).
- **The player presses "Roll" for each pick** (no auto-roll), so every roll is a moment of anticipation.
- **The champion card shows "Usually plays: …"** so the player can make an informed (or brave) placement.

## Step 5 – Items

- **The item phase starts with a "Draw 10 items" button** after the 5th pick, rather than automatically, so the player sees the finished team first.
- **10 distinct items** are drawn from the full-item pool with no balancing (per the spec: fully random).
- **Assignment state is `itemId -> role`.** A role holds at most 2 items, and "Rate my team" unlocks only when all 10 are assigned (so exactly 2 each).
- **Interaction:** drag an item onto a champion, or click an item and then a glowing champion. Equipped items can be dragged to another champion, dragged back to the list, or clicked to return them. Hovering an item shows its stats in a tooltip, and the list shows them inline.
- **Item stats are shown in short form** (AD, AP, MR, Haste, ...) to fit the side panel.

## Step 6 – Scoring

All numbers live in `src/game/scoring/config.ts`. Every score is 0–100.

- **Role fit:** on-role 100, off-role but the class suits the role 50 (e.g. a tank in top), fully off-role 15. Meraki lists positions alphabetically, not by popularity, so there is no "main vs secondary role" bonus.
- **Item fit:** each item gets tags from its stats (AD, AP, CRIT, ATTACK_SPEED, LETHALITY, TANK, ENCHANTER). A champion's affinity per tag comes from its best class. AD/AP depend on whether the item matches the champion's damage type, weighted by how much that class wants damage. Item fit is the average over the item's tags, so Infinity Edge has to be good for both "AD" and "CRIT" (great on Jinx, 20 on Leona).
  - Defensive stats only count as TANK when the item has no offensive stats, so Zhonya's and Liandry's count as mage items, not tank items.
  - Heal & shield power or base mana regen marks an enchanter (support) item.
- **Champion score** = 50% role fit + 50% average item fit.
- **Team balance** starts at 100 and loses points for: one damage type only (−30), no frontline (−35), no carry (−25), fewer than 3 damage items (−25). A frontliner is a Tank, or a Fighter holding a tank item. A carry is a Marksman, Mage or Assassin.
- **Team score** = 75% average champion score + 25% balance, mapped to grades S/A/B/C/D/F. The split started at 70/30, but a sanity run with real data rated an obviously chaotic team a B, so champions now weigh more.
- **Feedback is deterministic** (rule-based, no randomness), so it is testable. Each champion gets a role line plus a line for every clearly good (≥75) or clearly bad (≤30) item. Average items stay quiet to keep it short.

## Step 7 – Play again, footer, README

- **Play Again** sits right under the grade, so it's visible without scrolling, and resets everything (reducer `reset` + clears the selected item).
- **The footer** shows Riot's full "Legal Jibber Jabber" disclaimer plus the data sources and patch number.
- **README** now covers how to play, scoring, commands, data sources and the disclaimer.
- **Playtested in headless Chrome** (Playwright driver kept outside the repo). It dragged champions into slots, click-assigned items, rated the team and played again, with no console errors. That run surfaced two layout fixes: score badges now sit on the portrait, and the ADC/Support slots moved apart so their items don't overlap.

## Polish pass (after the MVP)

- **Mobile:** smaller portraits, the role prefix hidden on placed slots, and the Jungle/ADC/Support slots moved apart so nothing overlaps on a 390px phone. In the item phase, small screens show a 5×2 icon grid plus the selected item's stats, instead of a long list that pushed the map off-screen.
- **Look:** Cinzel heading font from Google Fonts (a stylesheet link, not an npm dependency), a subtle hextech/gold background glow, a tagline, a Draft → Items → Rating stepper, splash art behind the revealed champion, a custom roulette-wheel favicon (replacing the Vite logo), and item borders in the results coloured by fit (green/gold/red).
- **Feedback variety:** each situation has 2–3 lines. The line is picked by hashing champion + role/item, so the same team always gets the same text and tests stay deterministic, but the lines no longer repeat word for word.
- **Performance:** item icons are preloaded when items are drawn, and the champion splash during the roll.
- **Accessibility:** animations follow the OS "reduce motion" setting (`MotionConfig reducedMotion="user"`), and the roll skips the spin when the OS asks for reduced motion.

## Item roll and bot lane (after playtest feedback)

- **Items roll one at a time**, using the same slot-machine spin as the champion roll. The player chose this over spinning all 10 at once. The spin lives in a shared `useSpin` hook, so the two rolls stay consistent. Item spins use fewer, faster frames and a short pause between items, about 6.5s for all 10.
- **The 10 items are still drawn up front.** The roll is only for show, so the game logic is unchanged. Items can't be assigned until the roll finishes. With "reduce motion" turned on, the roll skips the spins.
- **ADC and Support sit closer together** (ADC 73/87, Support 87/72), so they read as one bot lane. Checked at 1400px and 390px wide with no overlap.

## Item rounds and ranked tiers (after playtest feedback)

- **Items come in 2 rounds of 5.** Roll 5 (one at a time), hand them out, press "Roll next 5 items", hand those out, then rate. The player chose: round 1 items can go to anyone (max 2 per champion) and **lock when round 2 starts**, so early choices matter like locked champion picks. All 10 are still drawn up front; the reducer tracks `itemRound` and `itemsRevealed` (the roll animation), and only current-round items can move.
- **Ranked tiers replace S–F grades.** Iron to Challenger, with divisions IV–I for Iron–Diamond (the player chose divisions). Master, Grandmaster and Challenger have none. Cut-offs: Challenger 95, Grandmaster 90, Master 85, Diamond 78, Emerald 70, Platinum 62, Gold 54, Silver 45, Bronze 35, Iron 0. Each tier's range is split evenly into four divisions. All in `config.ts` (`RANK_THRESHOLDS`).
- **Rank emblems come from CommunityDragon** (Data Dragon has none). `npm run data` saves them to `public/ranks/` (~1.5 MB, committed), so the game doesn't depend on a fan site at runtime. The tier list lives in `src/data/types.ts` so the script can import it under Node's stricter module rules. CommunityDragon is credited in the footer and README.

## Scoring rework (after playtest feedback)

A team of four off-role junglers plus Lee Sin ADC got Platinum. Causes: off-role picks whose class "fit" the role still got 50, Vi and Lee Sin counted as carries (secondary Assassin class), team balance was easy to max out, and balance *added* 25% of the score.

- **Stricter role fit:** class fits 35 (was 50), fully off-role 0 (was 15).
- **Balance only takes points away:** team score = average champion score − balance penalties, capped at 45. New checks: lopsided 4–1 damage (−5), one damage type (−20), no frontline (−20), 4+ frontliners (−10), no carry by *main* class (−15), no marksman in the ADC slot (−10), all melee (−10), fewer than 3 damage items (−15).
- **Ranks calibrated by simulation** (`simulate.ts`, seeded): a bot that always picks the best-fitting role and item has a median of 65 (Gold/Platinum) and reaches Challenger in under 1% of games; a random bot has a median of 29 (Iron). New cut-offs: Challenger 96, Grandmaster 92, Master 88, Diamond 82, Emerald 75, Platinum 66, Gold 56, Silver 45, Bronze 30. `simulate.test.ts` guards this, so tuning numbers can't silently make ranks too easy.
- **The playtest team is a regression test:** it must rank Iron even with good items.
- **More feedback:** a Coach's notes block (MVP, liability, comp jokes like "4 junglers on one team. Who is taking Smite?"), a short verdict per champion ("Hard carrying." … "Inting."), 2 variants per balance line, and the penalty shown next to each failed check.
- **Champion roll is faster:** 20 frames from 35ms (about 2.2s, was about 3.5s).

---

# Summary

## What was built

The full MVP loop from SPEC.md:

1. **Map:** Summoner's Rift minimap with Top / Jungle / Mid / ADC / Support slots.
2. **Roll:** a slot-machine style champion roll (Framer Motion) that lands on a random champion not already on the team.
3. **Place:** drag the champion onto an empty slot (dnd-kit), or click a glowing slot. Placed champions are locked.
4. **Items:** 10 random full items (from ~105 legendaries) in two rounds of 5, exactly 2 per champion in the end. Drag/drop or click-to-assign. Items can be moved or taken back until the next round locks them.
5. **Rating:** a ranked tier (Iron IV to Challenger) with its emblem, a score, a team-balance checklist, and a score per champion with short funny feedback lines. Badges also appear on the map.
6. **Play Again**, the Riot disclaimer footer, an updated README, and `npm run data` to refresh the data for a new patch.

Game logic is pure and lives in `src/game/` (93 unit tests, covering every scoring rule). All scoring numbers are in `src/game/scoring/config.ts`.

## What to test

- `npm install && npm run dev`, then play a few rounds.
- **Does the score feel fair?** The main thing to tune. Try deliberate on-role + good-item teams (should be A/S) and chaos teams (should be D/F).
- **Feedback lines:** are they funny, and do they repeat too much?
- **Drag and drop on a touch device** (phone/tablet), and keyboard play (Tab + Space/Enter).
- **Mobile layout:** the map and panel stack vertically, so check that slot labels and items stay readable on a small screen.
- **Locke and Zaahen** have guessed positions (not in Meraki yet). Check they look sensible, and re-run `npm run data` later.

## Suggested next steps

1. **Tune scoring after playtesting.** Most likely candidates: the off-role penalty (15 may be too harsh), hybrid items, and enchanter items on mages.
2. **More feedback variety:** several lines per situation, picked with an injected random function so tests stay deterministic.
3. **Show *why* an item fits** (e.g. "AP item, AP champion ✓") in the results tooltip.
4. **Use better position data** if a source with role popularity is found, to bring back main vs secondary role.
5. **Share result** as an image or link (no backend needed).
6. **Upgrade to TypeScript 7** once `typescript-eslint` supports it, and remove the Vitest `vmThreads` workaround if it works on another machine or in CI.
7. Then look at the Future Ideas in SPEC.md (match vs bots first, since it reuses the team score).
