CLAUDE.md
Instructions for Claude Code when working in this repo. Read SPEC.md for the full game design.
Project
Rift of Fortune: a browser game where the player rolls random League of Legends champions, places them in roles on Summoner's Rift, assigns random items, and gets a team rating. We are building the MVP only. Do not build anything listed under Future Ideas in SPEC.md unless asked.
Tech Stack
• TypeScript (strict mode), React, Vite
• Tailwind CSS for styling
• Framer Motion for animations (champion roll)
• dnd-kit for drag and drop
• Vitest for tests
• Frontend only, no backend, no login, no sessions
• Data: Riot Data Dragon (champions, items, images) and Meraki Analytics (champion positions), fetched by a script and saved as trimmed JSON in the repo
Commands
• npm run dev – start dev server
• npm run build – production build
• npm run test – run tests
• npm run lint – lint
• npm run data – fetch and trim latest champion/item data
Project Structure
• src/data/ – generated JSON and data types
• src/game/ – pure game logic: draft rules, item pool, scoring (no React here)
• src/components/ – UI components
• scripts/ – data fetching script
• Tests live next to the code they test (*.test.ts)
Conventions
• Clean, modern, idiomatic code following current best practices for React and TypeScript.
• Small, focused components and functions. Clear names over comments.
• Keep game logic pure and separate from the UI so it is easy to test and tweak.
• Every scoring rule gets a unit test.
• No any. Type the Data Dragon and Meraki data properly.
• Prefer well-maintained, widely used libraries. Ask before adding a new dependency.
How to Work With Me
• Plan before coding. For any non-trivial task, propose a plan and wait for approval.
• Never silently assume. If something is unclear or there are several good options, explain them and the trade-offs, and let me decide.
• Tell me if there is a more modern or better alternative to what I ask for.
• Work in small steps, one feature at a time, and make sure the build and tests pass before calling it done.
• Keep explanations short and simple.
Legal
Free fan project under Riot's Legal Jibber Jabber policy. Never add monetization. Keep Riot's "not endorsed by Riot Games" disclaimer in the footer and README.