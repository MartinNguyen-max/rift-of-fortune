# Finisher clips to add

The winner's finisher animation plays after every mini-game, solo and in Multiplayer. Add the clips below and they show up by themselves; a clip that isn't there yet is just skipped.

## How

- Folder: **`public/finishers/`** (create it).
- Format: **MP4** (H.264), cut to just the animation (about 10 s). 720p is plenty; around 1–2 MB each.
- The file name must match exactly.
- The time is where the clip starts in your YouTube videos (video 1 unless it says video 2).

## All clips needed (25)

| Mini-game | Champion | Clip | Time | File name |
|---|---|---|---|---|
| Headshot at High Noon | Caitlyn | Chibi Arcane Caitlyn | 6:23 | `arcane-caitlyn.mp4` |
| Headshot at High Noon | Jhin | Dark Cosmic Jhin Unbound | 8:08 | `dark-cosmic-jhin.mp4` |
| Rocket Grab Gold Rush | Blitzcrank | Chibi Space Groove Blitzcrank | 5:03 | `space-groove-blitzcrank.mp4` |
| Rocket Grab Gold Rush | Thresh | High Noon Thresh Unbound | video 2, 0:58 | `high-noon-thresh.mp4` |
| Combo Like a Riven Main | Riven | Chibi Dawnbringer Riven | 9:09 | `dawnbringer-riven.mp4` |
| Shroom Hopscotch | Teemo | Chibi Little Devil Teemo | 1:33 | `little-devil-teemo.mp4` |
| Shroom Hopscotch | Ezreal | Chibi Battle Academia Ezreal | 4:01 | `battle-academia-ezreal.mp4` |
| Gwen's Rush Order | Gwen | Chibi Prestige Cafe Cuties Gwen | 4:34 | `cafe-cuties-gwen.mp4` |
| Katarina's Dagger Dance | Katarina | Chibi Battle Academia Katarina | 5:23 | `battle-academia-katarina.mp4` |
| I Was Hiding · Shadow Shuffle | Akali | Chibi KDA ALL OUT Akali | 2:37 | `kda-all-out-akali.mp4` |
| I Was Hiding | Warwick | Arcane Warwick Unbound | 7:04 | `arcane-warwick.mp4` |
| Unstoppable Force | Malphite | Chibi Mecha Malphite | 1:22 | `mecha-malphite.mp4` |
| Unstoppable Force | Amumu | Chibi Surprise Party Amumu | 8:18 | `surprise-party-amumu.mp4` |
| Demacian Justice | Garen | God-King Garen Unbound | video 2, 0:10 | `god-king-garen.mp4` |
| Demacian Justice | Vayne | PROJECT: Vayne Unbound | 8:58 | `project-vayne.mp4` |
| Shadow Shuffle | Zed | Chibi PROJECT: Zed | 1:12 | `project-zed.mp4` |
| Unstoppable Onslaught | Vi | Chibi Arcane Vi | 6:12 | `arcane-vi.mp4` |
| Wind Wall | Yasuo | Chibi Dragonmancer Yasuo | 0:00 | `dragonmancer-yasuo.mp4` |
| Wind Wall | Yone | Chibi Spirit Blossom Yone | 3:50 | `spirit-blossom-yone.mp4` |
| Devour | Yuumi | Chibi Bewitching Yuumi | 5:52 | `bewitching-yuumi.mp4` |
| Destiny | Ahri | Chibi Spirit Blossom Ahri | 3:29 | `spirit-blossom-ahri.mp4` |
| Paranoia | Lux | Chibi Star Guardian Lux | 0:40 | `star-guardian-lux.mp4` |
| Paranoia | Ekko | Chibi Firelight Ekko | 6:33 | `firelight-ekko.mp4` |
| Baron Steal | Lee Sin | Chibi Prestige Dragon Fist Lee Sin | 3:18 | `dragon-fist-lee-sin.mp4` |
| Baron Steal | Lillia | Chibi Spirit Blossom Lillia | video 2, 1:08 | `spirit-blossom-lillia.mp4` |

No clip exists for **Sion** (Unstoppable Onslaught), **Tahm Kench** (Devour) and **Twisted Fate** (Destiny); when they win, the game simply skips the finisher.

Every other clip in your list also has a file name ready in `src/game/finishers.ts`, so a later swap is one line of code.
