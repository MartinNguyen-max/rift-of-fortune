# Launch Setup Checklist

What the project owner needs to set up (accounts can't be created from code). Each step can be done separately; the game works after step 3 even without Supabase.

## 1. Pick the name and domain (optional, can wait)

- "riftroulette" is taken, so decide whether to keep "LoL Rift Roulette" or rename before buying a domain.
- The site can launch on a free `*.vercel.app` address first, and a domain can be added later.
- Avoid "League of Legends" or Riot logos in the domain (Riot's fan-project rules).
- **If you rename:** the name appears in the page title, the header, the share text, the README and the footer. That's a quick change. Don't change the `rift-roulette:` localStorage prefix, or players lose their saved Daily.

## 2. Push the code to GitHub (1 min)

The repo already has `origin` set to GitHub. All work so far is committed locally but not pushed:

```sh
git push origin main
```

## 3. Vercel: hosting (5 min, free)

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project** and import `lol-rift-roulette`.
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
