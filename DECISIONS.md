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

---

# Summary

## What was built

The full MVP loop from SPEC.md:

1. **Map:** Summoner's Rift minimap with Top / Jungle / Mid / ADC / Support slots.
2. **Roll:** a slot-machine style champion roll (Framer Motion) that lands on a random champion not already on the team.
3. **Place:** drag the champion onto an empty slot (dnd-kit), or click a glowing slot. Placed champions are locked.
4. **Items:** 10 random full items (from ~105 legendaries), exactly 2 per champion. Drag/drop or click-to-assign, and items can be moved or taken back.
5. **Rating:** a team grade (S–F) and score, a team-balance checklist, and a score per champion with short funny feedback lines. Badges also appear on the map.
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
