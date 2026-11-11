# LoL Rift Roulette

A browser game where you roll random League of Legends champions, place them in roles on Summoner's Rift, give them random items, and see how good (or bad) your team is.

## Game Modes

- **Classic** (main mode): random champions and random items, play as often as you like. Then try your team in a real game, if you dare.
- **Daily Rift**: the same champions and items for everyone each day, one try. Share a spoiler-free result (like Wordle) and see how many of today's players you beat.

## How to Play

1. **Roll** a random champion and drag it onto an empty role on the map (or click a glowing slot). Placed champions are locked. Repeat until all five roles are filled. Off-role picks are part of the fun.
2. **Roll items in two rounds of 5.** Hand out each round by dragging items onto champions (or click an item and then a champion), max 2 per champion. Round 1 items lock when you roll round 2. In the end every champion has exactly 2.
3. **Rate your team.** You get a ranked tier (Iron IV up to Challenger), a score per champion and some honest feedback.

## Scoring

Scoring is simple and lives in [`src/game/scoring`](src/game/scoring). All numbers are in [`config.ts`](src/game/scoring/config.ts).

- **Champion score:** half role fit (does the champion usually play this role?), half item fit (do the item's stats suit the champion's class and damage type?).
- **Team score:** the average champion score, minus team balance penalties (up to 45 points): one damage type, no or too much frontline, no real carry, no marksman in bot lane, all melee, too few damage items.
- **Rank:** the score maps to Iron IV up to Challenger. The cut-offs are calibrated by simulating thousands of games ([`simulate.ts`](src/game/scoring/simulate.ts)).
- **Coach's notes:** an MVP, a liability and jokes about the team as a whole.

## Daily Rift global stats (optional)

The "you beat X% of players" comparison needs somewhere to store scores. It uses a free [Supabase](https://supabase.com) project. The game talks to it with plain `fetch`, so there is no extra dependency. Without it, the Daily still works; it just hides the comparison.

1. Create a free Supabase project.
2. Open the SQL editor and run [`supabase/daily-scores.sql`](supabase/daily-scores.sql). It creates the `daily_scores` table, a policy that only accepts scores for today's Daily, and a `daily_stats` function that returns totals only (individual scores stay private).
3. Copy `.env.example` to `.env.local` and fill in the project URL and the **publishable** (or legacy anon) key from *Project Settings → API Keys*. These are safe to expose in the browser.
4. Restart `npm run dev`. When you deploy, set the same two variables on your host.

Only an anonymous random player id, the Daily number and the score are stored. Scores are calculated in the browser, so a determined player could submit a fake score. The database only allows one score per player per day, values from 0 to 100, and today's Daily.

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
| `npm run data`  | Fetch the latest champion, item and rank data |

## Data

Champion and item data comes from Riot's [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon). Champion positions come from [Meraki Analytics](https://github.com/meraki-analytics/lolstaticdata), filtered by Meraki's role play rates so rare picks (like Taric mid) don't count as on-role. `npm run data` fetches the latest patch and saves trimmed JSON to `src/data/game-data.json`, so the game needs no live API calls for data. Images are loaded from Riot's Data Dragon CDN. Ranked emblems are not on Data Dragon, so the script downloads them from [CommunityDragon](https://www.communitydragon.org/) into `public/ranks/`.

## Disclaimer

LoL Rift Roulette isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
