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
- **Result:** Victory/Defeat/Draw with League's crest and sound, both scores, and for some games a picture of how it ended (Shaco popping out of his bush, Baron flying to the winner).
- **Personal records** (`records.ts`, stored in localStorage under `rift-of-fortune:minigame-bests`): wins, games played, the best win streak and, where it makes sense, the best score (fastest reaction, most gold, longest spam, fastest forge, best ult and smite totals). Shown on the cards; "New best!" on the result.
- Shared pieces: `BigCall` (a huge animated word: WON, LOST, THROW, ACE!), `ChoiceTimer` (a big countdown), `Waiting`, `GetReady` (3-2-1).

## The games

| Game | Champion vs bot | Solo | Multiplayer (`live`) |
|---|---|---|---|
| **Headshot at High Noon** (`duel`) | Caitlyn vs Jhin | Wait for DRAW, shoot first. Shooting early loses the round. Best of 3. Each round ends with a huge WON or LOST. | Same. |
| **Rocket Grab Gold Rush** (`hook`) | Blitzcrank vs Thresh | Gold Miner with a swinging hook, 25 s. Popups show only the gold. The cooldown is a ring around Blitzcrank. Grabbing every champion ends it with a big ACE! | 15 s. |
| **Udyr Has No Combo** (`combo`) | Udyr vs Bot Udyr | Simon with Q W E R: one key longer each round, longest spam wins. A 3-2-1 and "Watch Udyr!" first, and the first key shows longer. | Three fresh spams of 3, 4 and 5 keys. A wrong key doesn't end it; most right keys (max 12) wins. |
| **Shroom Hopscotch** (`shrooms`) | Teemo vs Master Yi | A two-lane path from A to B (left to right, with arrows). Plant 3 shrooms in Yi's way, one per column (the other spot greys out). Walk by tapping one of the two highlighted spots. Furthest walk wins; a tie plays again (max 3). | One plants, one walks: the walker wins with 3 safe steps. With both roles: each walks once, furthest wins. |
| **Ornn's Rush Order** (`forge`) | Ornn vs Bot Ornn | Build 3 items: 2, 2, then 3 parts, from 6/6/7 parts on offer. A right part flies to the anvil; a finished item says FORGED! (the clock pauses). Wrong part +2 s. | 4/4/6 parts on offer, 40 s limit. |
| **Mundo Goes Where He Pleases** (`cleaver`) | Dr. Mundo vs El Macho Mundo | Three round spots per side. Each turn a big THROW or DODGE banner: the thrower targets a spot, the dodger moves at most one spot (from top: top or mid). Spinning cleaver, hit shake, damage number. 3 hits wins; max 12 turns. | Max 6 turns (3 throws each); most hits wins. |
| **I Was Hiding** (`gank`) | Shaco vs Rengar | Hide in one of three bushes, or guess the bush. A right guess scores for the guesser, otherwise for the hider. 6 rounds, alternating. The hider pops out ("I was hiding!") next to the guessed bush. | One hides, one guesses (or both, with both roles). |
| **Unstoppable Force** (`ult`) | Malphite vs Amumu | A marker sweeps a bar, faster each second. Press ULT in the gold zone; dead center is 100. 3 bars, total score. | 1 bar. |
| **Baron Steal** (`smite`) | Lee Sin vs Nunu & Willump | The health drains smoothly with slow and fast stretches, and enters smite range around the middle of the duel. Smiting in range scores 50–100 (lower = more), too early or too late 0. Baron, then Elder. | One target: Baron, or Elder late in the match. |

The bots: Jhin reacts in 260–420 ms (8% false starts); Thresh lands 60% of his hooks; Bot Udyr remembers 4–11 keys; Master Yi plants and walks at random; Bot Ornn takes 1.3–2.1 s per part; El Macho Mundo and Rengar read your habits half the time; Amumu presses within about 0.3 s of the zone (~79 per bar); Nunu smites 30–82% into smite range and dozes off 10% of the time.

## Choices made (owner's feedback round 2, 2026-11-13)

- **Smite:** "the smite hit should be more in the middle" was read as: smite range comes around the middle of the duel, with a long, unpredictable window after it. To confirm with the owner.
- **Mundo:** max 6 turns in Multiplayer (3 throws each), 12 solo; at the limit most hits wins, a tie is a draw.
- **Teemo, one role each in Multiplayer:** the walker needs 3 of 5 safe steps.
- **Bushes** are drawn for now; the owner offered to find real League bush art.
- **Old live events** (gank, teamfight ult, Baron, Elder) became the solo games `gank`, `ult` and `smite`.

## Ideas for later

- A gauntlet: all nine in a row against the bot, with a total score.
- Harder bots (level 1–3, like Match vs Bots).
- Hook: moving champions (dashing Ezreal), Braum shields that block the hook.
- Forge: two-level recipes (build the B. F. Sword first) for experts.
