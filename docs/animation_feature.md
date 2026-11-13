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

## Next step

1. Read the two YouTube descriptions and make a list: champion, skin, animation.
2. Tell the owner which exact video files to add, and where to put them.
3. Match each mini-game to a champion that has an animation, and list the mismatches as questions.

## Built (round 3)

- After every mini-game (solo, and live events in Multiplayer) the **winner's champion** plays its finisher under a huge **WON** or **LOST**. It plays to the end; there is a Skip button. Then the normal result shows.
- Multiplayer lobby: **Finisher animations** checkbox, on by default.
- In live events the host plays the game's first champion and the guest the second (Caitlyn vs Jhin), so both see the same matchup and the same finisher.
- The table of finishers is `src/game/finishers.ts`: one clip per champion. Changing a champion's clip is one line there.
- A clip that is not added yet is skipped without a trace, so the game works before the files are in.

## Files to add (for the owner)

The short checklist is in [finisher_clips.md](finisher_clips.md).

Put the clips in **`public/finishers/`** with exactly these names. MP4 (H.264), cut to just the animation (about 10 s), 720p is plenty; around 1–2 MB each keeps the site fast.

**Needed now** (the champions the mini-games use today):

| Mini-game | Champion | Clip from the list | File name |
|---|---|---|---|
| Headshot at High Noon | Caitlyn | Chibi Arcane Caitlyn (6:23) | `arcane-caitlyn.mp4` |
| Headshot at High Noon | Jhin | Dark Cosmic Jhin Unbound (8:08) | `dark-cosmic-jhin.mp4` |
| Rocket Grab Gold Rush | Blitzcrank | Chibi Space Groove Blitzcrank (5:03) | `space-groove-blitzcrank.mp4` |
| Rocket Grab Gold Rush | Thresh | High Noon Thresh Unbound (2nd video, 0:58) | `high-noon-thresh.mp4` |
| Shroom Hopscotch | Teemo | Chibi Little Devil Teemo (1:33) | `little-devil-teemo.mp4` |
| Unstoppable Force | Malphite | Chibi Mecha Malphite (1:22) | `mecha-malphite.mp4` |
| Unstoppable Force | Amumu | Chibi Surprise Party Amumu (8:18) | `surprise-party-amumu.mp4` |
| Baron Steal | Lee Sin | Chibi Prestige Dragon Fist Lee Sin (3:18) | `dragon-fist-lee-sin.mp4` |
| Shadow Shuffle | Zed | Chibi PROJECT: Zed (1:12) | `project-zed.mp4` |
| Shadow Shuffle | Akali | Chibi KDA ALL OUT Akali (2:37) | `kda-all-out-akali.mp4` |

**Only if you say yes to a swap below:** `dawnbringer-riven.mp4`, `battle-academia-ezreal.mp4`, `cafe-cuties-gwen.mp4`, `battle-academia-katarina.mp4`, `arcane-warwick.mp4`, `spirit-blossom-lillia.mp4`, `god-king-garen.mp4`, `project-vayne.mp4`. The file names of every other clip in the list are in `src/game/finishers.ts`.

## Questions for the owner: champions without an animation

These champions have no clip in the list. Switch? (Nothing has been switched yet.)

| Mini-game | Today | No clip for | Suggestion | Why |
|---|---|---|---|---|
| Udyr Has No Combo | Udyr vs Udyr | Udyr | **Riven** (Dawnbringer) | Riven is *the* combo champion. The name would change too ("Riven Has No Combo"?). |
| Shroom Hopscotch | Teemo vs Master Yi | Master Yi | **Ezreal** (Battle Academia) | An explorer walking into traps. |
| Ornn's Rush Order | Ornn vs Ornn | Ornn | **Gwen** (Cafe Cuties) | She sews: building items stitch by stitch. |
| Mundo Goes Where He Pleases | Mundo vs Mundo | Dr. Mundo | **Katarina** (Battle Academia) | Throwing and dodging daggers instead of cleavers. |
| I Was Hiding | Shaco vs Rengar | both | **Akali** (K/DA ALL OUT) hides, **Warwick** (Arcane) hunts | Akali vanishes in her shroud; Warwick hunts by scent. |
| Baron Steal | Lee Sin vs Nunu | Nunu | **Lillia** (Spirit Blossom) | Another jungler. |
| Noxian Guillotine | Darius vs Draven | both | **Garen** (God-King) vs **Vayne** (PROJECT) | Garen's ult also executes ("Demacian Justice"); Vayne is a hunter with an Unbound clip. |

Skins: the game art uses the clip's skin where League has the same skin (Mecha Malphite, PROJECT: Zed...). **Headshot at High Noon** keeps Sheriff Caitlyn and High Noon Jhin for now, because the game is themed "High Noon" and the clips are Arcane Caitlyn and Dark Cosmic Jhin. Switch the art to the clip skins anyway?

## Later: fast mode, five lanes ("no champ select")

A Multiplayer mode with no draft:

- Each player gets a random team with real positions. The champions only stand for **5 lives**.
- Five fights in order: top, jungle, mid, ADC, support. Each fight is a mini-game against the friend. Games can be random, or better: matched to the animations, so the random top laner is a champion with an animation.
- After each fight the animation plays. This time the screen shows both teams side by side with VS in the middle. The champion that lost looks dead on their map, and the health bar at the top goes down.
- An easy way to play five mini-games against a friend.


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