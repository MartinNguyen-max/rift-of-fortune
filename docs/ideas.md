# Ideas Backlog

Ideas collected while building, so they're not lost. Nothing here is approved unless marked.

## Game modes

| Mode | What it is | Size | Status |
|---|---|---|---|
| **Match vs Bots** | Your team plays a simulated match against a level 1–3 bot, with a live play-by-play. See [match-simulation.md](match-simulation.md). | Medium | **Approved**, "Coming soon" card |
| **Mini-games** | Eleven quick games vs a bot, also the live events of Multiplayer. See [minigames.md](minigames.md). | Medium | **Built** |
| **Multiplayer** | Two players draft, then their teams play each other; the host picks which mini-games are the live events. | Large | **Built** (real time, see DECISIONS.md) |
| **Challenge a Friend** | Share a link and your friend gets the exact same rolls; compare results. No server needed (seeded rolls already exist). | Small | Idea |
| **ARAM** | Howling Abyss: 5 random champions, no roles, rated on team comp and items only. | Small–medium | Idea |
| **Blind Pick** | Choose the slot *before* the roll, so you never know who's coming. | Small | Idea |
| **Counterpick** | See an enemy team first, then build a team that beats it. | Medium | Idea |
| **Timed Draft** | 30 seconds to place everything. Panic picks guaranteed. | Small | Idea |
| **Balanced Items** | Item pools with a guaranteed mix (AD, AP, tank, support). From SPEC.md. | Small | Idea |
| **Async PvP** | Your saved team fights other players' saved teams. From SPEC.md. | Large | Idea |
| **Ultimate Team campaign** | Starter team, win matches to earn currency, open packs, upgrade with duplicates, climb a ladder of bot teams to a final boss. From SPEC.md. | Large | Idea |

## Mini-game ideas (saved in round 3, not now)

From the owner's notes. Nothing here is approved.

| Idea | What it is | Priority |
|---|---|---|
| **Tahm Kench: Devour** | Eat an ally just before a Jinx ult (or a similar big ult) lands, to save them. Too early and the ult is not coming yet, too late and they are dead. The owner thinks it is not so strong. | Low |
| **Twisted Fate: Destiny** | Guess which lane TF teleports to: top, mid or bot. Like the bushes in "I Was Hiding", but with a lane layout, and TF can bluff. | Medium |
| **Nocturne: Paranoia** | The same lane guess, but the screen goes dark. Use the finisher animations where they exist. | Medium |
| **Yasuo: Wind Wall** | Yasuo stands in the middle; champions fire from the left, right, top and bottom. Put the wall up on the right side before the shot lands. Rules still open. | Medium |
| **Shaco: Hallucinate** | The shell game ("Zed shadows") with Shaco and his clone instead. Decide after the animation feature. | Low |
| **Race: hold to speed up** | See [race_proposal.md](race_proposal.md). Waiting for the owner's decision. | Owner decides |

## Features for every mode

- **Chemistry:** bonuses and jokes for real synergies and lore pairs (Xayah + Rakan, Lucian + Senna). From SPEC.md. It fits nicely into Coach's notes.
- **Rank reveal with suspense:** the score counts up, the emblem drops in, confetti for Diamond and above.
- **Sound effects** made with the Web Audio API (spin tick, landing "ding", rank fanfare), so there are no audio files to license.
- **Personal best and history:** best rank and the last 10 runs, stored in the browser.
- **Show why an item fits:** hover in the results to see e.g. "AP item on an AP mage ✓".
- **Draft hints (optional):** when a champion lands, empty slots glow green, gold or red by role fit.
- **MVP splash art** behind the results.

## Launch polish

- **Open Graph and Twitter meta tags,** so shared links show a preview image and title (important for the Share button).
- **Test touch dragging** on a real phone.
- **Upgrade to TypeScript 7** once `typescript-eslint` supports it.

## Known data quirks

- Meraki's role play-rate data is from an older patch, so a few champions are missing a real second role (e.g. Pantheon, Seraphine and Swain are Support only).
- New champions missing from Meraki (currently Locke and Zaahen) get guessed positions.

## Sound ideas (saved for later)

League client sounds are available on CommunityDragon and can be added to `SOUND_FILES` in `src/data/types.ts`:

- **Champion ban voice line** ("You dare ban me?") for the worst player in the end-screen roast.
- **LP gain and loss ticks** while the win-chance bar swings.
- **Timer tick** (normal and urgent) during the last seconds of the match.
- **"Rare drop" celebration** for a Challenger result, and the per-tier **rank banner intro** sounds.
- **Champion select music layers**: four intensity layers that build up during the draft, a ban-phase track and a final 60-second track.
- Others: ban sounds, "your pick" alert, first pick, role assigned, splash forward/back, "find match" click, banner intro flare, promotion win/loss, honor received, "play again" alert, reward reveal, gold sparkle, summoner spell choose sounds, each champion's own sound effect.
