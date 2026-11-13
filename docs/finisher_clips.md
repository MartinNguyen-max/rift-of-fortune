# Finisher clips to add

The winner's finisher animation plays after every mini-game. Add the clips below and they show up by themselves; a clip that isn't there yet is just skipped.

## How

- Folder: **`public/finishers/`** (create it).
- Format: **MP4** (H.264), cut to just the animation (about 10 s). 720p is plenty; around 1–2 MB each.
- The file name must match exactly.
- The time is where the clip starts in your YouTube videos (video 1 unless it says video 2).

## Needed now (10)

| Champion | Mini-game | Clip | Time | File name |
|---|---|---|---|---|
| Caitlyn | Headshot at High Noon | Chibi Arcane Caitlyn | 6:23 | `arcane-caitlyn.mp4` |
| Jhin | Headshot at High Noon | Dark Cosmic Jhin Unbound | 8:08 | `dark-cosmic-jhin.mp4` |
| Blitzcrank | Rocket Grab Gold Rush | Chibi Space Groove Blitzcrank | 5:03 | `space-groove-blitzcrank.mp4` |
| Thresh | Rocket Grab Gold Rush | High Noon Thresh Unbound | video 2, 0:58 | `high-noon-thresh.mp4` |
| Teemo | Shroom Hopscotch | Chibi Little Devil Teemo | 1:33 | `little-devil-teemo.mp4` |
| Malphite | Unstoppable Force | Chibi Mecha Malphite | 1:22 | `mecha-malphite.mp4` |
| Amumu | Unstoppable Force | Chibi Surprise Party Amumu | 8:18 | `surprise-party-amumu.mp4` |
| Lee Sin | Baron Steal | Chibi Prestige Dragon Fist Lee Sin | 3:18 | `dragon-fist-lee-sin.mp4` |
| Zed | Shadow Shuffle | Chibi PROJECT: Zed | 1:12 | `project-zed.mp4` |
| Akali | Shadow Shuffle | Chibi KDA ALL OUT Akali | 2:37 | `kda-all-out-akali.mp4` |

## Only if you say yes to a champion swap

These champions have no clip: Udyr, Master Yi, Ornn, Dr. Mundo, Shaco, Rengar, Nunu, Darius and Draven. The suggested swaps are in [animation_feature.md](animation_feature.md). If you say yes, these clips are needed too:

| Swap | Clip | Time | File name |
|---|---|---|---|
| Udyr → Riven | Chibi Dawnbringer Riven | 9:09 | `dawnbringer-riven.mp4` |
| Master Yi → Ezreal | Chibi Battle Academia Ezreal | 4:01 | `battle-academia-ezreal.mp4` |
| Ornn → Gwen | Chibi Prestige Cafe Cuties Gwen | 4:34 | `cafe-cuties-gwen.mp4` |
| Dr. Mundo → Katarina | Chibi Battle Academia Katarina | 5:23 | `battle-academia-katarina.mp4` |
| Shaco → Akali | (already in the list above) | | `kda-all-out-akali.mp4` |
| Rengar → Warwick | Arcane Warwick Unbound | 7:04 | `arcane-warwick.mp4` |
| Nunu → Lillia | Chibi Spirit Blossom Lillia | video 2, 1:08 | `spirit-blossom-lillia.mp4` |
| Darius → Garen | God-King Garen Unbound | video 2, 0:10 | `god-king-garen.mp4` |
| Draven → Vayne | PROJECT: Vayne Unbound | 8:58 | `project-vayne.mp4` |

Every other clip in your list also has a file name ready in `src/game/finishers.ts`, so any later swap is one line of code.
