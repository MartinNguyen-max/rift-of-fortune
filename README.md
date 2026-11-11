# LoL Rift Roulette

A browser game where you roll random League of Legends champions, place them in roles on Summoner's Rift, give them random items, and see how good (or bad) your team is.

## How to Play

1. **Roll** a random champion and drag it onto an empty role on the map (or click a glowing slot). Placed champions are locked. Repeat until all five roles are filled. Off-role picks are part of the fun.
2. **Draw 10 random full items** and give each champion exactly 2. Drag items onto champions, or click an item and then a champion.
3. **Rate your team.** You get a grade, a score per champion and some honest feedback.

## Scoring

Scoring is simple and lives in [`src/game/scoring`](src/game/scoring). All numbers are in [`config.ts`](src/game/scoring/config.ts).

- **Role fit:** does the champion usually play this role?
- **Item fit:** do the item's stats suit the champion's class and damage type?
- **Team balance:** a mix of AD and AP, a frontline, at least one carry and enough damage items.

## Status

MVP. See [SPEC.md](SPEC.md) for the design and [DECISIONS.md](DECISIONS.md) for decisions made while building it.

## Tech Stack

TypeScript · React · Vite · Tailwind CSS · Framer Motion · dnd-kit · Vitest · ESLint

## Getting Started

Requires Node.js 22.18 or newer.

```sh
npm install
npm run dev
```

| Command         | What it does                                  |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Start the dev server                          |
| `npm run build` | Type-check and build for production           |
| `npm run test`  | Run the unit tests                            |
| `npm run lint`  | Lint the code                                 |
| `npm run data`  | Fetch the latest champion and item data       |

## Data

Champion and item data comes from Riot's [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon). Champion positions come from [Meraki Analytics](https://github.com/meraki-analytics/lolstaticdata). `npm run data` fetches the latest patch and saves trimmed JSON to `src/data/game-data.json`, so the game needs no live API calls for data. Images are loaded from Riot's Data Dragon CDN.

## Disclaimer

LoL Rift Roulette isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
