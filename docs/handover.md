# Handover: feedback round 2 (in progress)

Written 2026-11-13 for the next Claude session (the owner switched accounts). Read this file first, then `CLAUDE.md`, then both feedback files.

## Who the owner is and how they like to work

- Plays and tests on phone and desktop, often via remote control. Works in short sessions.
- **Said for this task: "Don't ask me anything now. Just do as you like. Leave the questions and requests for later."** Build everything, then list questions at the end.
- **Commit and push to `main` without asking** once the work builds and tests pass. Vercel deploys `main` (rift-of-fortune.vercel.app), so **never push a broken build to `main`**. Use a branch for half-done work.
- **Never add a `Co-Authored-By` trailer or any Claude/AI attribution** to commits or PRs. Plain messages, e.g. `git commit -m "feat(minigames): ..."`.
- Keep explanations short and simple. The owner is Danish; English is fine.
- Never change the localStorage prefix `rift-of-fortune:` or the Daily seed.
- No new dependencies without asking (none are needed for this work).

## IMPORTANT: git identity (work PC)

The owner may run this session on a work PC that is logged into a different (work) account. **The work account must never appear in this project**: not as a commit author and not as the account that pushes.

- Before any commit, set this repo's identity (local only, never `--global`):
  `git config user.name "martin"` and `git config user.email "martintn09@gmail.com"`.
- Check every commit before pushing: `git log --format="%an <%ae>" origin/main..HEAD` must show only `martin <martintn09@gmail.com>`. If anything else shows, fix it (e.g. `git commit --amend --reset-author --no-edit`, or rebase with `--exec`) before pushing.
- Push only as the owner's personal GitHub account (`MartinNguyen-max`). The remote should be `https://MartinNguyen-max@github.com/MartinNguyen-max/rift-of-fortune.git`, so Git asks for that login. If the push is refused or would use another account, stop and tell the owner. Don't try other credentials.
- If the owner asks for it, don't push at all: hand over the branch as a bundle, `git bundle create rift-of-fortune.bundle wip/minigames-v2`, and tell the owner where the file is.
- Never add Co-Authored-By or any Claude attribution.

## The task

The owner wrote two feedback files: **`docs/feedback/mini_games_feedback.md`** and **`docs/feedback/overall_feedback.md`**. Read both carefully; they share one vision. Do everything in them, then push.

## State of the code

### Already done and pushed to `main`

- Sound: music could not be turned back on (fixed by recreating a failed player); click sounds lagged (effects are preloaded and cloned); champion voices overlapped (only one voice plays at a time).
- Item roll sounds made with Web Audio (`playSynth('roll' | 'tick' | 'land')` in `src/services/sound.ts`).
- Small "♪ Music? Tap to turn it on" hint by the music button on the homepage (`SoundToggle hint`).
- Long names wrap instead of showing "..." (`truncate` → `[overflow-wrap:anywhere]`).
- Multiplayer versus screen is 10 s (`TIMINGS.versus`).

### Half done, on branch `wip/minigames-v2` (pushed). The build is broken there until the UI is updated.

```
git fetch && git switch wip/minigames-v2
```

**New shared model, `src/game/minigames/versus.ts`.** Every mini-game is two lists of integer moves, one per player (player 0 = you in solo or the host/blue in Multiplayer; player 1 = the bot or the guest). Each game exports a `MiniGameRules` object:

- `chances`: 1 = both do the same thing (a fair duel). 2 = a role game (hide/guess, plant/walk). With the Multiplayer option `bothRoles`, each player plays each role.
- `settle(moves, setup)`: the winner (null = tie) and scores, or null while undecided. Used by the solo screen and by the Multiplayer host.
- `owed(moves, setup)`: which moves are still missing. The host uses it, with `fallback()`, to fill in for a player who is gone or out of time.
- `botMove(step, moves, setup)`: the solo bot. `botMoves()` plays every bot move that is possible right now.
- `liveSeconds`, `formatScore`, and an optional `best` (personal best per game).
- `GameSetup = { seed, variant: 'solo' | 'live', bothRoles, late }`. `live` is the shorter Multiplayer version. `late` = the smite event fights Elder instead of Baron.
- Helpers: `firstPlayer` (who takes the first role: you in solo, the seed in Multiplayer), `stepSeed`, `packDigits`/`unpackDigits`, `settleScores`, `owedScores`.

**Rules done on the branch (with tests):**

- `duel.ts`: `DUEL_RULES`. Move = shot time in ms from the round start (`NO_SHOT` = never shot). `drawTimes(seed)` and `botShots(seed)`. Best of 3. Shooting first before DRAW loses. A dead heat goes by round parity. Best = fastest reaction.
- `hook.ts`: `hookRules(pool)`, a factory so the rules don't import data. `HOOK_SECONDS = { solo: 25, live: 15 }`. `botGrabs(field, seed, duration)`. Move = gold.
- `combo.ts`: `COMBO_RULES`. Solo: Simon, move = longest spam. Live: `liveCombos(seed)` gives 3 new spams (3, 4, 5 keys); a wrong key does not end it; move = right keys (`rightKeys`), max 12. `FIRST_KEY_FACTOR` makes the first key show longer (still to use in the UI).
- `shrooms.ts`: `SHROOM_RULES`. Lanes are now `'up' | 'down'` (a horizontal path, left to right). One move per half: plan or walk (`encodePlan`/`encodeWalk`). `planterOf(half, setup)`. Solo plays pairs of halves until one isn't a tie (max 3 games). Live with one role: the walker wins with `WALKER_GOAL` = 3 or more safe steps. Live with both roles: the furthest walk wins.
- `forge.ts`: `forgeRules(items, components)`. Orders have 2, 2, then 3 parts (`ORDER_PARTS`). `TRAY_SIZES` solo `[6, 6, 7]`, live `[4, 4, 6]`. `forgeOrders(seed, items, components, variant)`. Move = time in ms, lower wins. `FORGE_LIMIT_SECONDS` = 40.

**Still to write on the branch:**

1. **`cleaver.ts`** (Mundo) to the new model, with the owner's changes: 3 round spots per side (top/mid/bot) instead of full lanes. You stay where you were last round and can only move one spot (from top: top or mid). The thrower can target all 3 spots. Moves per turn: thrower = target spot, dodger = new spot. Start mid. Hits to win: 3. Max turns: solo about 12, live 6 (3 throws each); at the max, most hits wins and a tie is null. Bot reads habits (the existing `botThrow`/`botDodge` ideas, limited to reachable spots).
2. **New solo games made from the old Multiplayer live events.** Each needs a champion, a name, rules and a tutorial:
   - `gank` ("I Was Hiding", Shaco vs Rengar or similar): 3 bushes; hider vs guesser. Move = bush, or 3 for no guess. Solo: 6 halves (3 per role), points (a right guess scores for the guesser, otherwise for the hider). Live: 1 half, or 2 with `bothRoles`.
   - `ult` ("Unstoppable Force", Malphite): reuse `src/game/multiplayer/ult.ts`. Solo: 3 bars, total score. Live: 1 bar.
   - `smite` ("Baron Steal", Lee Sin vs Nunu): **rework `src/game/multiplayer/smite.ts`**. Health drains smoothly (no jumps) with a changing pace (piecewise linear segments, random rates). Smite range is reached around the middle of the duel, not at the end. Solo: Baron then Elder, total score. Live: one target (`late` → Elder). The bot smites at range-entry + 0.25–0.6 s. Update `smite.test.ts` and `SmiteGame`.
3. **A registry** (e.g. `src/game/minigames/registry.ts`, which may import `gameData`): `RULES: Record<MiniGameId, MiniGameRules>` and a catalog entry for each game (name, champion, bot champion, tagline, 3 tutorial captions). Add `gank`, `ult` and `smite` to `MINI_GAME_IDS` in `catalog.ts`.

## Remaining work: solo mini-game screens (`src/components/minigames/`)

The components still use the old APIs (`duelRounds`, `HOOK.duration`, `botPlan`, `'left'/'right'`...), which is why the branch doesn't build. Rebuild them on the moves model: a component gets `{ setup, opponent moves, sendMove(step, value) }`. For solo, a hook can compute the bot's moves with `botMoves()`. Then the same component can run in Multiplayer, with the opponent's moves coming from the network. The shell settles with `rules.settle` and shows Victory/Defeat/Draw.

The owner's points, per game:

- **All intros:** far less text. Show a visual tutorial: 3 numbered small pictures with a few words each (icons and simple drawn scenes). Use the same intro in Multiplayer.
- **Personal bests** for every game, in localStorage (`readJson`/`writeJson`, key e.g. `minigame-bests`). Show them on the cards and "New best!" on the result.
- **Duel:** keep it as it is, but make the round result huge and animated: a big "WON" or "LOST", no doubt possible.
- **Hook:** popups show only the gold ("+300g"), never "Missed" or minion text (they blocked the view). Make the cooldown much more visible (e.g. a ring around Blitzcrank or a big icon by him; the corner icon wasn't noticed). The game seemed to stop early: that is the "all champions grabbed" early end. Make it clear (a big "ACE!") or let the timer run. Live = 15 s.
- **Udyr:** loved as is. A slower start (a "get ready" moment) and a longer first key. Live: 3 rounds of 3, 4, 5 fresh keys, keep the timer, most right keys wins.
- **Teemo:** no left/right buttons: highlight the two spots you can step on. A path that looks like a path, left to right, with direction arrows. Top lane art as the background is an option. Show "Master Yi goes from A to B, block him" while planting. Make "one shroom per step" obvious (the other spot in that column greys out).
- **Ornn:** too hard. Now 2, 2, 3 parts with smaller trays. Make a right part and a finished item clear: glow, "Forged!", a short pause before the next order.
- **Mundo:** visual intro; make it very clear whose turn it is (a big THROW / DODGE banner in the player's color); 3 circle spots per side, only reachable ones highlighted; more throw animation (spinning cleaver, trail, impact shake, damage number); a big visible timer; health bars stay.

## Remaining work: match and Multiplayer (`overall_feedback.md`)

- **Smite** rework (above).
- **Matches end early when one side stomps.** In `src/game/match/simulateMatch.ts`, `liveEventsLeft()` blocks any ending while live events are left. Change it so the match can end once the events are decided (one side's wins > the other's + the events left), and when the win chance is very high (e.g. ≥ 93%) let the leader push to end quickly. This also helps vs bots. Check the `simulateMatch`, `liveMatch` and `winChance` tests; the win chance weights are fitted, so rerun or adjust the tests if needed.
- **Win chance bar** (`src/components/match/WinChanceBar.tsx`): wilder. Exaggerate swings, add a wobble so it looks like a coin flip, add effects near a win, but still show the favourite. Matches should not sit at 87–99% (fixed by the early ending above).
- **Commentary:** in Multiplayer, show the caster lines stacked: the newest on top, the older ones faintly peeking out below. The full feed only in a collapsible section.
- **Less on screen in Multiplayer:** the champion scoreboard collapsed by default (open on tap); no gold or towers. After the match: the commentary collapsed, and "How it went" and the enemy MVP moved further down. The main end card shows only Victory/Defeat, the live event results, the series score, Rematch, and the emotes under it.
- **Surrender earlier** in Multiplayer (also on the versus screen). A surrender ends the game right away with Victory/Defeat, the score and Rematch.
- **A player gone 30 s = surrender** (the host checks presence in `useRoom`/`hostMessages`).
- **Emotes visible on every live event result screen** (the `EmoteBar` inside `LiveEventStage`).
- **Clearer live event results:** animations instead of text. Gank: show the bush they hid in (champion pops out, e.g. Shaco "I was hiding!") and the guessed bush. Baron/Elder: show clearly who got it (the icon flies to the winner's side) and a big WON/LOST.
- **Lobby settings** (the creator = host edits them; both see them; share them through the host's Presence, validated in `parsePresence`, and send them in `startDraft`):
  - Pace: **normal** (as now) or **fast** (no rolling: 5 random champions shown at once to place, then all 10 items at once with no roll animation; needs `GameRules`/`gameState` support, e.g. a `pick` action and one item round of 10).
  - **Rerolls** on/off (`championRerolls`/`itemRerolls` 3 or 0).
  - **Live events: 3 random, 5 random, or custom** (a list of all mini-games to switch on). Roll the random picks in the lobby and show them, with a shuffle button.
  - **"Both roles"** checkbox. Mark each game in the list as "1 chance" (both do the same) or "2 chances" (a role game, both play each role when the box is on). A role game with both roles is still ONE event, so the event count never grows.
  - Defaults: normal pace, rerolls on, 3 random, one role.
- **Mini-games as live events.** Replace the 4 fixed events (`liveEvents.ts`: gank, teamfight, baron, elder) with the chosen games:
  - Protocol: a generic `move` message `{ round, event, player, step, value }` and an `eventReady` message: the intro shows until both press Ready, or 10 s. `score`/`score ≤ 100` validation no longer fits; moves are integers up to about 10^6.
  - Session: store moves per event and per player. The host settles with `rules.settle`, breaks a tie with `tieBreaker`, and fills `owed` moves with `fallback` for players who are offline, or for everyone once `liveSeconds` + grace has passed.
  - Order events with gank games early, smite last (Baron, or Elder if late). Spread their times between about 7:00 and 31:00.
  - Effect on the match: gank → `gank`, smite → `baron`/`elder`, every other game → a `teamfight` won by the event winner.
  - **Fair points:** split a fixed total of event gold (about 9000, as now) evenly over the chosen events, so 3 or 5 events weigh the same in total.
  - Old components to reuse or retire: `src/components/multiplayer/games/` (GankGame, UltGame, SmiteGame), `EventIntro`, `EventReveal`, `LiveEventStage`.

## Gotchas

- **Line endings:** the files are CRLF after git touches them, so exact-string edits with LF text fail. Normalize CRLF to LF before replacing, and write back with the file's own line ending.
- **Strict TypeScript** with `noUncheckedIndexedAccess`; ESLint bans non-null assertions (`!`) and impure calls such as `Date.now()` during render (the React Compiler rules).
- Commands: `npm run lint`, `npm run test`, `npm run build`. All must pass before pushing to `main`.
- **Play-testing in a browser:** there is no Playwright in the project. Install `playwright-core` in a scratch folder (not the project) and launch the installed Chrome: `chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })` against `npx vite --port 5199`. Check the screenshots and the console errors. Also test at phone width (390 px).
- The Multiplayer page and the mini-games page are lazy-loaded; keep it that way.
- Update the docs when done: `docs/minigames.md`, `DECISIONS.md`, `README.md`, `docs/launch-setup.md` (Status section), and this file (mark it done or delete it).

## Questions to ask the owner at the end (not before)

1. Real League bush images for the gank game: the owner offered to find them. Until then, draw simple bushes.
2. "The smite hit should be more in the middle": this file assumes it means the smite moment comes mid-duel. Confirm.
3. Anything decided on their behalf: Mundo's turn limit, the walker goal of 3 steps, the gold split, the fast pace details.
