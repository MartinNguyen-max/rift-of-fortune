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
