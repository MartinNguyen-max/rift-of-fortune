# Animation feature: finisher videos after a game

Written from the owner's notes (originally in Danish). Do this after `docs/feedback/round3_feedback.md`.

## The idea

After a game, show a short animation, like Mortal Kombat: something cool for the winner and a taunt for the loser. A big **WON** or **LOST** is shown above it. The video just plays until it is finished.

- The owner has all the videos and will add the ones we need later, **but first needs to know exactly which files** are needed.
- A list of all available videos and the champions they belong to is in these two YouTube videos (the descriptions say which champion and which skin each one supports):
  - https://www.youtube.com/watch?v=uOZ7hl0EqJU
  - https://www.youtube.com/watch?v=3o6WCoeQdxw
- Match the animations to champions and skins from those descriptions.

## What this means for the games

- Every mini-game should use champions that have an animation. Some games may need a different champion.
- Example: Udyr shows his spells. If there is no Udyr animation, pick another champion that has one.
- Use the animation's skin in the game too.
- Do not change a champion on your own. Ask the owner **afterwards**: "There is no animation for this champion, but there is one for X. Switch?"
- Duel (Jhin vs Caitlyn) has animations for both, so player 1 can be one and player 2 the other, and the winner's animation is shown.

## Multiplayer

- A checkbox in the lobby settings to turn animations on or off. **On by default.**

## Built

- After every mini-game (solo, and live events in Multiplayer) the **winner's champion** plays its finisher under a huge **WON** or **LOST**. It plays to the end; there is a Skip button. Then the normal result shows. A tie has no finisher.
- Multiplayer lobby: **Finisher animations** checkbox, on by default.
- In live events the host plays the game's first champion and the guest the second (Caitlyn vs Jhin), so both see the same matchup and the same finisher.
- The table of finishers is `src/game/finishers.ts`: one clip per champion. Changing a champion's clip is one line there. The game art (the face-off before each game) uses the clip's skin where League has it.
- A clip that is not added yet is skipped without a trace, so the game works before the files are in.
- **Champion swaps (approved by the owner):** Udyr → Riven, Master Yi → Ezreal, Nunu → Lillia. Some champions have no clip and that is fine: the owner moved Ornn, Dr. Mundo, Shaco vs Rengar and Darius vs Draven back to their own games. Sion, Twisted Fate and Nocturne have no clip either; when a champion without a clip wins, the finisher is simply skipped.

## Files to add (for the owner)

The checklist with every clip, its time in the videos and its file name is in **[finisher_clips.md](finisher_clips.md)**.

## Five lanes, no champ select (built)

A Multiplayer mode with no draft, chosen in the lobby next to "Draft battle":

- Each player gets a random team with real positions (every champion's main role). The champions are **5 lives**.
- Five fights in order: top, jungle, mid, ADC, support. Each is one of **5 random mini-games** (locked to 5, can be shuffled).
- Both teams side by side with VS in the middle and a lives bar each. The champion who loses their lane is dead (skull, greyed out) and their team loses a life. A tied lane is a draw: both live.
- The finisher plays after each lane (if animations are on).
- After five lanes the most lives left wins. Level lives go to a coin flip, shown on screen.

## list:

0:00 - Chibi Dragonmancer Yasuo
0:10 - Chibi Dragonmancer Lee Sin
0:19 - Chibi Dragonmancer Kaisa
0:30 - Chibi Dragonmancer Ashe
0:40 - Chibi Star Guardian Lux
0:51 - Chibi Panda Annie
1:01 - Chibi Star Guardian Ahri
1:12 - Chibi PROJECT: Zed
1:22 - Chibi Mecha Malphite
1:33 - Chibi Little Devil Teemo
1:44 - Chibi DRX Aatrox
1:55 - Chibi Soul Fighter Gwen
2:06 - Chibi Divine Sword Irelia
2:17 - Fluft of Poros
2:27 - Chibi Heartsteel Sett
2:37 - Chibi KDA ALL OUT Akali
2:47 - Chibi Headliner KDA Pop Stars Kaisa
2:57 - Chibi Porcelain Lux
3:08 - Chibi Guqin Sona
3:18 - Chibi Prestige Dragon Fist Lee Sin
3:29 - Chibi Spirit Blossom Ahri
3:39 - Chibi Majestic Empress Morgana
3:50 - Chibi Spirit Blossom Yone
4:01 - Chibi Battle Academia Ezrael
4:12 - Chibi Prestige Dragonmancer Yasuo
4:24 - Chibi Pengu Cosplay Tristana
4:34 - Chibi Prestige Cafe Cuties Gwen
4:44 - Chibi Galaxy Slayer Zed
4:53 - Chibi Battle Bunny Miss Fortune
5:03 - Chibi Space Groove Blitzcrank
5:13 - Chibi Star Guardian Lulu
5:23 - Chibi Battle Academia Katarina
5:32 - Chibi T1 Orianna
5:43 - Chibi Star Guardian Akali
5:52 - Chibi Bewitching Yuumi
6:01 - Chibi High Noon Ashe
6:12 - Chibi Arcane Vi
6:23 - Chibi Arcane Caitlyn
6:33 - Chibi Firelight Ekko
6:43 - Chibi Prestige Arcane Superfan Annie
6:54 - Arcane Jinx Unbound
7:04 - Arcane Warwick Unbound
7:15 - Chibi Porcelain Irelia
7:25 - Chibi Spirit Blossom Sett
7:36 - Chibi Prestige Porcelain Ezreal
7:47 - Chibi Mythmaker Zoe
7:57 - Chibi K/DA ALL OUT Seraphine
8:08 - Dark Cosmic Jhin Unbound
8:18 - Chibi Surprise Party Amumu
8:28 - Chibi Blood Moon Aatrox
8:38 - Chibi Beemo
8:48 - Chibi Forecast Janna
8:58 - PROJECT: Vayne Unbound
9:09 - Chibi Dawnbringer Riven
9:19 - Chibi Prestige Dawnbringer Yone
and
0:00 - Chibi Dragon Trainer Tristana
0:10 - God-King Garen Unbound
0:20 - Chibi Shork Cosplay Briar
0:29 - Chibi Aether Wing Kayle
0:39 - Chibi Spirit Blossom Orianna
0:48 - Chibi iBlitzcrank
0:58 - High Noon Thresh Unbound
1:08 - Chibi Spirit Blossom Lillia
1:18 - Chibi Prestige Spirit Blossom Ahri