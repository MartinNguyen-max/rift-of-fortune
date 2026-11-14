# Mini-games

Nine short games at `#/minigames` (one game at `#/minigames/<id>`), played against a bot. The same games are the **live events in Multiplayer**, in shorter versions.

## One model for solo and Multiplayer

Every game is two lists of whole-number moves, one per player (`src/game/minigames/versus.ts`). A move is a shot time in ms, a bush, a spot, a packed shroom plan… Each game's rules (`MiniGameRules`, pure and tested, in `src/game/minigames/`) say:

- `settle(moves, setup)`: the winner (or a draw) and both scores, once the moves decide it.
- `owed(moves, setup)`: which moves are still missing, and `fallback()`: a poor move for a player who is gone or out of time.
- `botMove()`: the bot. The solo shell works out the bot's moves straight from yours.
- `chances`: 1 = both do the same thing (a duel), 2 = a role game (hide/guess, plant/walk).
- `liveSeconds`, `formatScore`, and `best` (the personal best, for games that keep one).

`GameSetup` holds the seed, the variant (`solo` or the shorter `live`), `bothRoles` (Multiplayer option) and `late` (the smite game fights Elder). All rules are listed in `registry.ts`.

The screens (`src/components/minigames/`) get `{ setup, me, moves, sendMove, onShown, players }`, so the same screen runs against the bot and against a friend: in Multiplayer the opponent's moves arrive over the network and `me` can be player 1. A test (`registry.test.ts`) checks that every game always settles when missing moves are filled in, in every variant.

## Around every game

- **Tutorial:** three numbered pictures with a few words each (captions in `catalog.ts`, pictures in each screen's `TutorialArt`). The same intro is used in Multiplayer.
- **Result:** Victory/Defeat/Draw with League's crest and sound, both scores, and for some games a picture of how it ended (Akali popping out of her bush, Baron flying to the winner).
- **Personal records** (`records.ts`, stored in localStorage under `rift-of-fortune:minigame-bests`): wins, games played, the best win streak and, where it makes sense, the best score (fastest reaction, most gold, most combo keys, fastest stitching, best ult total, fastest smite). Shown on the cards; "New best!" on the result.
- **Opening:** before every game, both champions' loading art slides in with a big VS and the game's name (`GameOpening`, 2.5 s, tap to skip). Same in Multiplayer, where the host's time limit includes it.
- **Finisher:** the winner's finisher animation under WON/LOST, if the clip is added (see `docs/animation_feature.md`).
- Shared pieces: `BigCall` (a huge animated word: WON, LOST, THROW, ACE!), `ChoiceTimer` (a big countdown), `Waiting`, `GetReady` (3-2-1).

## The games

| Game | You vs bot | Solo | Multiplayer (`live`) |
|---|---|---|---|
| **Headshot at High Noon** (`duel`) | Caitlyn vs Jhin | "Ready... Steady...", then a Baron pops up somewhere in the arena: tap it first. Tapping before it shows loses the round; a tap beside it only costs time. Best of 3. | Same spot and timing for both. |
| **Rocket Grab Gold Rush** (`hook`) | Blitzcrank vs Thresh | Gold Miner with a swinging hook, 25 s, and a big GRAB button. Carries pay most. Grabbing every champion is an ACE! | 15 s. |
| **Combo Like a Riven Main** (`combo`) | Riven vs Riven Main | Three fresh combos of 4, 6 and 7 keys (Q W E R as Riven's spells), shown 0.575 / 0.525 / 0.5 s per key. A wrong key doesn't end it; most right keys (max 17) wins. | Same. |
| **Shroom Hopscotch** (`shrooms`) | Teemo vs Ezreal | Plant 3 shrooms, one per column, then walk the whole path: a shroom is a BOOM, but you keep walking. +1 to the planter per boom, +1 to the walker per dodge. | The planter watches the walk live. One role each: 2+ booms wins for the planter. |
| **Gwen's Rush Order** (`forge`) | Gwen vs Bot Gwen | Stitch 3 items from their parts (2, 2, then 3). A wrong part costs 2 s. Fastest needle wins. | Fewer parts on offer, 40 s limit. |
| **Katarina's Dagger Dance** (`cleaver`) | Battle Academia vs Blood Moon Katarina | Three spots per side. THROW: aim at a spot; DODGE: move one spot. 3 hits wins; max 12 turns. | Max 6 turns; most hits wins. |
| **I Was Hiding** (`gank`) | Akali vs Warwick | Hide in one of three bushes, or guess the bush. 6 rounds, alternating. | One hides, one guesses (or both, with both roles). |
| **Unstoppable Force** (`ult`) | Malphite vs Amumu | A marker sweeps a bar at one steady speed (0.9–1.2 bar lengths a second). Press ULT in the gold zone: 100 at the centre, 60 at the edge. 3 bars, total score. | 1 bar. |
| **Demacian Justice** (`execute`) | Garen vs Vayne | 8 low-health enemies pop up on a 3×3 grid for 700 → 370 ms. Tap to execute. Kills in a row score more, capped at 5 (KILL! … PENTAKILL!). | Same wave for both, at the same time. |
| **Shadow Shuffle** (`shadows`) | Zed vs Akali | The real Zed is shown, turns into a shadow, then the three swap: 9 / 11 / 13 swaps at 300 / 240 / 200 ms, with feints. Each round goes to the fastest right pick. | Same shuffle for both. |
| **Unstoppable Onslaught** (`race`) | Sion vs Vi | Hold to charge (faster and faster), let go to slide. Stop on the enemy team: the middle is 100, the tower behind them is a CRASH for 0. 3 tracks. | Same tracks; the other's stop shows as a ghost. |
| **Wind Wall** (`windwall`) | Yasuo vs Yone | 12 skillshots from the four sides, faster each time, sometimes two at once. Tap that side (or arrow keys) to wall it. Most blocked wins, then speed. | Same volley for both. |
| **Devour** (`devour`) | Tahm Kench vs Yuumi | Jinx's rocket speeds up toward your carry: Devour so they're inside when it lands (0.8 s). Closer to impact = more points; early = spat out. 3 rockets. | Same rockets for both. |
| **Destiny** (`destiny`) | Twisted Fate vs Ahri | TF shows a card on a lane, then Gates to one: to the card's lane +2, a bluff +1. The guard sees the card and guards a lane: +1 if right. 6 rounds, alternating. | One round each role (or one). |
| **Paranoia** (`paranoia`) | Lux vs Ekko | The lights go out; Nocturne flies at a lane, seen only in flickers, sometimes turning. Call his lane. Most right, then speed. 3 rounds. | Same flight for both. |
| **Baron Steal** (`smite`) | Lee Sin vs Lillia | Baron (then Elder) loses health in small hits. Smite deals 1,600: the first smite at 1,600 or less steals it; above that is too early. | One fight: Baron, or Elder late in the match. |

The bots are tuned so a good player wins about 55–70%: Jhin taps in 0.38–0.6 s; Thresh lands 60% of his hooks; the Riven Main gets about 13 of 17 keys; Amumu presses within about 0.11 s; Vayne gets about 4 kills; Akali finds Zed about 1.1 times a game; Vi averages 78 a run and sometimes crashes; Yone blocks about 8 of 12; Yuumi averages about 63 a rocket; Ahri reads your bluffs; Ekko calls 1.6 lanes a game; Lillia smites 190–750 ms after it hits 1,600 depending on her mood.

## Choices made

- **Multiplayer limits:** Katarina's Dagger Dance is max 6 turns (3 throws each), 12 solo; at the limit most hits wins.
- **Headshot:** an early tap loses the round; a tap beside the Baron only costs time; Space doesn't shoot (aiming is the game).
- **Teemo:** booms and dodges are both points; one role each, 2 booms wins it for the planter.
- **Demacian Justice:** kills in a row score more (penta = 15, all eight 30); no decoys; ties go to kills, then speed.
- **Live events:** the host plays the game's first champion, the guest the second, so both see the same matchup and finisher.
- **Ties:** in five lanes a tied lane is a draw; in the match a tied live event goes to a coin flip, shown on screen.
- **Personal bests** are cleared when a game's scoring changes (`SCORING_VERSION` in `records.ts`); wins and streaks stay.
- **Bushes** are drawn for now; the owner offered to find real League bush art.

## Ideas for later

- A gauntlet: all of them in a row against the bot, with a total score.
- Harder bots (level 1–3, like Match vs Bots).
- Hook: moving champions (dashing Ezreal), Braum shields that block the hook.
- Forge: two-level recipes (build the B. F. Sword first) for experts.
