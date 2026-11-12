# Mini-games

A fifth mode at `#/minigames` (one game at `#/minigames/<id>`). Six short games, each played against a bot for now. They are built so they can move into Multiplayer later. The owner will pick the favorites after playing them.

Every game's rules are pure functions in `src/game/minigames/` (with tests). Randomness comes from a seed, so two players with the same seed would get the same game. The UI is in `src/components/minigames/`. The page is lazy-loaded.

Each game: rules screen (you vs the bot's champion) → the game → Victory or Defeat with League's end-of-game crest and sound, plus Rematch. Starting a game plays the champion's voice line.

## The games

| Game | Champion vs bot | How it works | Win |
|---|---|---|---|
| **Headshot at High Noon** (`duel`) | Sheriff Caitlyn vs High Noon Jhin | "Ready... Steady..." then DRAW! after a random 1.8–4.8 s. Click, tap or Space. Shooting before DRAW loses the round. The bot reacts in 260–420 ms and false-starts 8% of the time. | Best of 3 |
| **Rocket Grab Gold Rush** (`hook`) | Blitzcrank vs Thresh | Gold Miner: the hook swings, you fire, it grabs the first thing in its path. 3 or 5 enemy champions plus 6 minions in front of them. Carries are small, light and worth 250–300 g. Tanks are big, heavy (slow to pull) and worth 150 g. Minions are 20 g and slow: a wasted shot. 0.9 s cooldown, 25 s total. A grab still on the hook at 0 s doesn't count. The bot plays the same field and lands 60% of its shots. | Most gold |
| **Udyr Has No Combo** (`combo`) | Udyr vs Bot Udyr | A Simon game with Q W E R (Udyr's real ability icons). Starts at 3 keys, +1 each round, flashes get faster. One wrong key or running out of time ends it. The bot remembers 4–11 keys (about 7–8 on average). The game ends as soon as you beat the bot. | Longest spam |
| **Shroom Hopscotch** (`shrooms`) | Teemo vs Master Yi | You plant 3 shrooms on a path of 5 steps (left or right, at most one per step). The bot walks it. Then the bot plants and you walk, with 4 s per step (time out = a random jump). A tie plays again, up to 3 times. | Furthest walk |
| **Ornn's Rush Order** (`forge`) | Ornn vs Bot Ornn | Build 3 items in a row from their parts. 8 parts on offer: the recipe plus decoys. A wrong part adds 2 s. Items come from a list of 45 well-known items. The bot takes 1.3–2.1 s per part and sometimes grabs a wrong one. The game ends early if the bot finishes first. | Fastest time |
| **Mundo Goes Where He Pleases** (`cleaver`) | Dr. Mundo vs El Macho Mundo | Turns: one throws a cleaver, the other dodges, then they switch. Pick top, mid or bot lane in 3 s (Mundo stays mid if you don't). Health bars with 3 chunks (3000 HP). The bot reads your habits: half the time it throws where you usually dodge, or dodges away from where you usually throw. | 3 hits |

## Choices made (the owner said "develop as it pleases you")

- **Teemo:** the path version (plant, then walk), not the memory cards. It is a mind game between two players, so it fits Multiplayer better.
- **Mundo:** three lanes instead of only up and down. With two lanes it is a coin flip; three lanes also look like the Rift. The dodger starts mid, so "move up or down" still works (↑ ↓ keys).
- **Combo champion:** Udyr instead of Riven, as suggested, because the joke is "no combo, just spam".
- **Hook rival:** Thresh, the other famous hook.
- **Shop data:** item recipes come from Data Dragon (`Item.from` and `GameData.components`), added to `npm run data`. They were added to the current 16.22.1 data without refetching the rest.
- **Skins:** Sheriff Caitlyn (skin 2), High Noon Jhin (1) and El Macho Mundo (9), from Data Dragon's loading screen art.

## Ideas for later

- Play them in Multiplayer: between draft and match, or as a "best of 5 mini-games" party mode.
- A gauntlet: all six in a row against the bot, with a total score.
- Personal bests per game (stored in the browser).
- Harder bots (bot level 1–3, like Match vs Bots).
- Hook: moving champions (dashing Ezreal), Braum shields that block the hook.
- Forge: two-level recipes (build the B. F. Sword first) for experts.
