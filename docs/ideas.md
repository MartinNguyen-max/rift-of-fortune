# Ideas Backlog

Ideas collected while building, so they're not lost. Nothing here is approved unless marked.

## Game modes

| Mode | What it is | Size | Status |
|---|---|---|---|
| **Match vs Bots** | Your team plays a simulated match against a level 1–3 bot, with a live play-by-play. See [match-simulation.md](match-simulation.md). | Medium | **Approved**, "Coming soon" card |
| **Multiplayer** | Two players draft, then their teams play each other. Async first, real-time later. See [match-simulation.md](match-simulation.md). | Large | **Approved**, "Coming soon" card |
| **Challenge a Friend** | Share a link and your friend gets the exact same rolls; compare results. No server needed (seeded rolls already exist). | Small | Idea |
| **ARAM** | Howling Abyss: 5 random champions, no roles, rated on team comp and items only. | Small–medium | Idea |
| **Blind Pick** | Choose the slot *before* the roll, so you never know who's coming. | Small | Idea |
| **Counterpick** | See an enemy team first, then build a team that beats it. | Medium | Idea |
| **Timed Draft** | 30 seconds to place everything. Panic picks guaranteed. | Small | Idea |
| **Balanced Items** | Item pools with a guaranteed mix (AD, AP, tank, support). From SPEC.md. | Small | Idea |
| **Async PvP** | Your saved team fights other players' saved teams. From SPEC.md. | Large | Idea |
| **Ultimate Team campaign** | Starter team, win matches to earn currency, open packs, upgrade with duplicates, climb a ladder of bot teams to a final boss. From SPEC.md. | Large | Idea |

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
