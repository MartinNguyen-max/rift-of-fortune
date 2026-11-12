Rift of Fortune (originally "LoL Rift Roulette") – MVP Spec
A simple browser game based on League of Legends. The player builds a team from random champions and random items, and the game rates how good or bad the team is. This document covers the MVP only. Everything else is listed under Future Ideas and is out of scope for now.
Goal of the MVP
Find out whether the core loop is fun: roll champions, place them on the map, give them items, see a rating. If it's fun, keep building. If not, stop there.
Core Game Flow
1. Map: Summoner's Rift is shown on screen with five role slots: Top, Jungle, Mid, ADC (Bot) and Support.
2. Champion roll: A roll animation cycles through all champions and lands on one random champion.
3. Placement: The player places that champion in any empty role slot. Once placed, it is locked.
4. Repeat: Roll again until all five slots are filled. The player may be forced to play champions off-role (e.g. a second support has to go top). This is intended and part of the fun.
5. Items: 10 fully random full (legendary) items are shown. The player assigns exactly 2 items to each champion.
6. Rating: The game shows a score for each champion and for the whole team, plus short feedback on what's good, what's bad and what the team is missing.
Rules
• One champion rolled at a time; no rerolls in the MVP.
• No duplicate champions in a team.
• Items are fully random, with no guaranteed mix of AP, AD or tank items.
• Only full items (legendary tier) are used: no components, boots-only or consumables. Mythic items no longer exist in the game.
• Each champion gets exactly 2 items.
Scoring (first version)
The score should be simple, explainable and easy to tweak later.
• Role fit: Does the champion normally play this role? On-role scores high, off-role scores low.
• Item fit: Do the item's stats match the champion? For example, AP items on mages are good, and crit items on a support tank are bad. Based on the champion's class tags and damage type versus the item's stats.
• Team balance: Mix of AP and AD damage, at least one frontline/tank, and some way to deal damage.
• Feedback lines: Short, funny text explaining the score, e.g. "No frontline", "Full AD team, enemies will just build armor" or "Support in top lane, brave choice".
There is no opponent and no simulated match in the MVP; the output is just the rating.
Data Sources
• Riot Data Dragon (free static JSON and images on Riot's CDN, no API key):
    ◦ versions list → latest patch number
    ◦ champion.json → all champions, class tags (Mage, Tank, Fighter, etc.), base info
    ◦ item.json → all items, stats, tags, build path (use this to filter full items)
    ◦ images: champion icons, splash art, item icons, Summoner's Rift minimap
• Meraki Analytics (free community champion JSON): usual positions per champion (TOP, JUNGLE, MIDDLE, BOTTOM, SUPPORT), since Data Dragon has no roles.
• The data can be fetched at build time and cached locally, so the game doesn't depend on live requests.
Legal
A free fan project is allowed under Riot's "Legal Jibber Jabber" policy. Don't charge money for it, and include Riot's required disclaimer that the game isn't endorsed by Riot Games.
Out of Scope for the MVP
• Opponents, bots and simulated matches
• Multiplayer (now built as a 1v1 mode, see DECISIONS.md)
• Campaign, packs, money, upgrades
• Accounts, saving and leaderboards
• AI features
Future Ideas (later, not now)
• Match vs bots: Each team gets a power score, the higher score wins with some randomness, and bot difficulty is level 1–3.
• ~~Real-time multiplayer~~: built (see "Multiplayer" in DECISIONS.md). It uses Supabase Realtime, and the first player in the lobby acts as referee instead of a server.
• ~~Mini-games~~: built as a fifth mode, vs a bot for now (see docs/minigames.md).
• Async multiplayer: Fight other players' saved teams, so no real-time server is needed.
• Single-player campaign (FIFA Ultimate Team style): Starter team, win matches to earn money, open packs (random or role-specific, e.g. top-only), swap champions, upgrade champions with duplicates, and a ladder of harder bot teams with a final boss.
• Chemistry: Bonuses for real synergies and lore pairs (e.g. Xayah + Rakan).
• Item mode options: Balanced item pools instead of fully random.
Open Decisions (to discuss before building)
• Frontend framework (e.g. React + Vite + TypeScript, or something lighter)
• How the roll animation should look
• Drag-and-drop or click-to-place for champions and items
• Exact scoring weights and the feedback text style
How to Build with Claude Code
1. Create a new repo and put this file in it as SPEC.md. Add a short CLAUDE.md with conventions (TypeScript, clean code, small components, tests for scoring logic).
2. Open the folder in VS Code and start Claude Code.
3. Start in plan mode: ask it to read SPEC.md and propose an architecture and a step-by-step plan. Discuss it before any code is written.
4. Build in small steps, committing after each one: data fetching → map with role slots → champion roll and placement → item assignment → scoring and feedback.
5. Playtest. If it's fun, continue with Future Ideas.