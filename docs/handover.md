# Handover: feedback round 2 (done)

Written 2026-11-13. **Feedback round 2 is done and on `main`**: everything in `docs/feedback/` is built. What changed and why is in "Feedback round 2" in [DECISIONS.md](../DECISIONS.md) and in [minigames.md](minigames.md). The working rules below still apply to the next session.

## Who the owner is and how they like to work

- Plays and tests on phone and desktop, often via remote control. Works in short sessions.
- For feedback round 2 the owner said: "Don't ask me anything now. Just do as you like. Leave the questions and requests for later."
- **Commit and push to `main` without asking** once the work builds and tests pass. Vercel deploys `main` (rift-of-fortune.vercel.app), so **never push a broken build to `main`**. Use a branch for half-done work.
- **Never add a `Co-Authored-By` trailer or any Claude/AI attribution** to commits or PRs. Plain messages, e.g. `git commit -m "feat(minigames): ..."`.
- Keep explanations short and simple. The owner is Danish; English is fine.
- Never change the localStorage prefix `rift-of-fortune:` or the Daily seed.
- No new dependencies without asking (none are needed for this work).

## IMPORTANT: git identity (work PC)

The owner may run this session on a work PC that is logged into a different (work) account. **The work account must never appear in this project**: not as a commit author and not as the account that pushes.

- Before any commit, set this repo's identity (local only, never `--global`):
  `git config user.name "martin"` and `git config user.email "martintn09@gmail.com"`.
- Check every commit before pushing: `git log --format="%an <%ae>" origin/main..HEAD` must show only `martin <martintn09@gmail.com>`. If anything else shows, fix it (e.g. `git commit --amend --reset-author --no-edit`, or rebase with `--exec`) before pushing.
- Push only as the owner's personal GitHub account (`MartinNguyen-max`). The remote should be `https://MartinNguyen-max@github.com/MartinNguyen-max/rift-of-fortune.git`, so Git asks for that login. If the push is refused or would use another account, stop and tell the owner. Don't try other credentials.
- If the owner asks for it, don't push at all: hand over the branch as a bundle, `git bundle create rift-of-fortune.bundle wip/minigames-v2`, and tell the owner where the file is.
- Never add Co-Authored-By or any Claude attribution.

## Open questions for the owner (asked at the end of round 2)

1. Real League bush images for the gank game (I Was Hiding): the owner offered to find them. The bushes are drawn for now.
2. "The smite hit should be more in the middle" was read as: smite range comes around the middle of the duel. Confirm.
3. Decided on the owner's behalf: Mundo's turn limit (6 in Multiplayer, 12 solo), Teemo's walker goal (3 safe steps with one role each), the event gold split (15,000 split evenly), and the fast pace details (60 s draft, 5 champions offered at once).

## Play-testing without Supabase

There is no Playwright in the project. For local tests, install `playwright-core` in a scratch folder and launch the installed Chrome (`/usr/bin/google-chrome` on Linux, `C:/Program Files/Google/Chrome/Application/chrome.exe` on Windows) against the dev server. Multiplayer can be played in two tabs of one browser by aliasing `src/services/realtime.ts` to a small BroadcastChannel stand-in in a scratch Vite config (not part of the repo).
