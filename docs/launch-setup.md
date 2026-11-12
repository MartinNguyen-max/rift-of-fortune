# Launch Setup Checklist

What the project owner needs to set up (accounts can't be created from code). Each step can be done separately; the game works after step 3 even without Supabase.

## Status (handoff for the next session)

- **2026-11-12:** Vercel is live at `rift-of-fortune.vercel.app`, and Supabase is set up locally (`.env.local`). The domain riftoffortune.dk is not connected yet. **Match vs Bots is built** (`#/match`). See "Match vs Bots" in [DECISIONS.md](../DECISIONS.md).
- **2026-11-12 (later):** **Multiplayer is built** (`#/play`), on Supabase Realtime. It needs the same two Supabase env variables on Vercel as the Daily. See "Multiplayer" in [DECISIONS.md](../DECISIONS.md).
- **2026-11-12 (night):** **Mini-games are built** (`#/minigames`): six games against a bot. Next: the owner plays them and picks the favorites for Multiplayer. See [minigames.md](minigames.md).
- **Built earlier:** Classic mode, Daily Rift, homepage, ranked scoring with a lane-swap table, and optional Supabase stats. Lint, build and all tests pass.
- **Name decided: Rift of Fortune.** "Wild Rift of Fortune" was rejected: Wild Rift is Riot's mobile game.
- **Domain:** riftoffortune.dk at Simply (the owner is buying it).
- **Owner's to-do, in order:**
  1. Rename the GitHub repo to `rift-of-fortune`.
  2. Update the local remote, then push (step 1 below).
  3. Set up Vercel (step 3).
  4. Set up Supabase (step 4).
  5. Connect the domain (step 5).
- **Next for Claude,** once it's live:
  1. Add Open Graph link previews, which need the final URL.
  2. Verify the Daily stats end to end.
  3. ~~Build Match vs Bots~~ (done, reworked after the first playtest).
  4. ~~Build Multiplayer~~ (done 2026-11-12: 1v1 lobbies with link or code, 90 s draft, versus screen, four live mini-games, emotes, rematch). Next: the owner playtests it with a friend on two devices.
- **Other ideas** are in [ideas.md](ideas.md). Decisions and their reasons are in [DECISIONS.md](../DECISIONS.md).
- **Never change** the localStorage prefix or the Daily seed (`rift-of-fortune:`) after launch.

## 1. Name, domain and repo

- **Name: Rift of Fortune** (decided). "LoL Rift Roulette" was dropped because many things on Google already use it.
- **Domain:** riftoffortune.dk (cheap at Simply; .gg was about 1,000 kr). A .com or .gg can be added later and pointed at the same site.
- **Rename the GitHub repo** to `rift-of-fortune` in the repo's **Settings → General → Repository name**. GitHub redirects the old URL. Afterwards, update the local remote:

  ```sh
  git remote set-url origin https://github.com/<your-user>/rift-of-fortune.git
  ```

- Renaming the local folder (`lol-rift-roulette`) is optional. Do it while no editor or dev server is using it.
- Avoid "League of Legends" or Riot logos in the domain (Riot's fan-project rules).

## 2. Push the code to GitHub (1 min)

The repo already has `origin` set to GitHub. All work so far is committed locally but not pushed:

```sh
git push origin main
```

## 3. Vercel: hosting (5 min, free)

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project** and import `rift-of-fortune`.
3. Vercel detects Vite automatically: build command `npm run build`, output folder `dist`. Leave both as they are.
4. Click **Deploy**. The game is live at `https://<project>.vercel.app`.
5. From now on, every push to `main` redeploys automatically, and pull requests get preview links.

No routing config is needed: the game uses hash links (`/#/daily`), which work on any static host.

The free Hobby plan is for non-commercial projects. That fits, since this fan project must never be monetized.

## 4. Supabase: Daily global stats (5 min, free)

1. Sign in at [supabase.com](https://supabase.com) and create a project. Pick a region close to your players (e.g. EU Central), and keep the database password somewhere safe.
2. Open the **SQL Editor**, paste [`supabase/daily-scores.sql`](../supabase/daily-scores.sql) and click **Run**.
3. Go to **Project Settings → API Keys** and copy:
   - the **Project URL** (`https://xxxx.supabase.co`)
   - the **publishable key** (`sb_publishable_...`), or the legacy **anon** key
4. **In Vercel:** go to Project → Settings → Environment Variables and add:
   - `VITE_SUPABASE_URL` = the project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the publishable key

   Then redeploy (Deployments → ⋯ → Redeploy). Vite bakes these values in at build time.
5. **Locally (optional):** copy `.env.example` to `.env.local`, fill in the same two values, and restart `npm run dev`.

The publishable key is safe in the browser: row level security only allows inserting today's scores and reading totals.

**Note:** free Supabase projects **pause after about 1 week without activity.** While paused, the Daily shows "Couldn't load today's stats", and everything else works. Daily players keep it awake; otherwise, un-pause it from the dashboard.

Never put the database password or the **secret** key (`sb_secret_...`) in the code or in Vercel env vars starting with `VITE_`.

**Multiplayer** uses the same project and the same two env variables, through Supabase Realtime. Nothing to set up: it worked out of the box in testing. If lobbies ever stay on "Connecting…", check **Project Settings → Realtime** and make sure public channels are allowed (the game doesn't use private channels). Free plan limits: 200 players connected at once (about 100 games) and 2 million messages a month. One game sends roughly 100 messages, plus emotes. A paused project also stops multiplayer until it is restored.

## 5. Custom domain (optional, 10 min + DNS wait)

1. Buy the domain (Namecheap, Cloudflare, Porkbun, ...).
2. In Vercel, go to Project → Settings → Domains, add the domain, and set the DNS records Vercel shows.
3. HTTPS is set up automatically.

## 6. Tell Claude when done

No secrets are needed. Just share:

- the live URL (used for link previews and share text),
- whether Supabase is connected (play one Daily and check that "You beat X% of players" or "You're the first to play today!" appears).

## What Claude can do next

1. **Link previews:** Open Graph tags plus a preview image, so shared links look good in Discord, WhatsApp and X. This needs the final URL.
2. **Check the live Daily stats** end to end.
3. **Start Match vs Bots** ([match-simulation.md](match-simulation.md)).
