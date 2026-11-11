# Match Simulation: Design Doc

Status: **idea, approved for later**. Shown as "Coming soon" on the homepage (Match vs Bots, Multiplayer).

## The idea

After drafting a team (Classic rules), the player sends it into a **simulated match** against another team. The match plays out like a Football Manager match: a **live play-by-play feed** with a **live scoreboard** and a **really funny commentator**. It takes **1–2 minutes** to watch.

> "FIRST BLOOD! Janna, our jungler, has been found in her own raptor camp by an enemy Garen. Nobody is surprised."

- **Match vs Bots** comes first: play against a level 1, 2 or 3 bot team.
- **Multiplayer** comes later: two players draft, then their teams play each other.

## Core rules

1. **The better team should usually win.** A strong team beats a weak bot most of the time.
2. **Luck matters, about 30%.** As a starting point, about **70% of the result comes from team strength and 30% from luck**. This needs tuning by simulation (see Balancing).
3. **Luck can snowball.** A weak jungler can still steal Baron. Several lucky events in a row can flip a game, or even end it.
4. **Lanes matter, not only the total.** A strong mid laner with a strong jungler can gank and swing the game, even when the team as a whole is weaker.
5. **It stays short:** 1–2 minutes of watching, with a skip button.

## What the player sees

- **Live scoreboard:** kills, towers, dragons, gold difference and the game clock (game time runs fast, e.g. 30 game minutes in about 90 seconds).
- **Play-by-play feed:** one event every few seconds, newest on top. Big moments (Baron steal, ace, Elder) get a bigger card, a small screen shake or flash, and a sound later.
- **Gold graph or momentum bar** that swings with the events.
- **Map** (reuse `RiftMap`): small markers where an event happens, e.g. a skull on the dragon pit.
- **End screen:** Victory or Defeat, the MVP, the "Moment of the match", and the funniest commentator line. Share button, like the Daily.

## Events (first version)

| Event | Phase | Mostly decided by | Luck example |
|---|---|---|---|
| First blood | Laning | Lane matchup + jungle | Off-role support gets a solo kill |
| Gank (jungle → lane) | Laning | Jungler + target laner vs enemy laner | Flash-dodge, counter-gank |
| Solo kill | Laning | Lane matchup | Outplay |
| First turret | Laning | Lane leads | Split-push no one noticed |
| Dragon (×4, soul) | All | Jungle + bot side | **Dragon steal** |
| Void Grubs / Rift Herald | Early | Jungle + top side | Herald goes rogue |
| Teamfight | Mid/late | Team score + comp (frontline, carries) | 1v5 pentakill |
| Baron | Late | Team strength + gold lead | **Baron steal** (smite fight, weak jungler can win) |
| Elder Dragon | Late | Gold lead | Steal = instant comeback |
| Inhibitor / Nexus | End | Leads after fights | Backdoor (very rare) |

**Steals:** the chance depends on the jungler's luck roll, not only on strength. A level 1 jungler can steal Baron, which makes for great commentary.

## How the simulation could work

- **Pure engine** in `src/game/match/`, with no React (like the rest of `src/game/`). It takes two rated teams plus a seed and returns the full **timeline** of events up front. The UI only plays it back.
- **Seeded randomness** (`seededRandom` already exists):
  - Games can be replayed and tests stay deterministic.
  - In multiplayer, both players see the same match.
- **Strength inputs come from the existing rating:**
  - each champion's score (role fit + item fit),
  - lane matchups (top vs top, and so on),
  - jungle strength,
  - the team balance checks (frontline, carry, damage mix).
- **State during the match:** gold lead, kills, towers, dragons and Baron buff. Every event changes the gold lead.
- **Event odds:** `chance = strength part (≈70%) + luck part (≈30%)`, adjusted by the current gold lead (snowball).
- **Comebacks:** a "luck streak" counter. Every lucky event for the losing team makes the next one a bit more likely and more powerful, so 2–3 lucky events in a row can turn the game around.
- **Game end:** when one team takes the Nexus. A big enough lead ends the game early (the "FF at 20" ending, which deserves its own commentary).

## Commentator

- **Two casters:**
  - a **hype caster**, who screams at everything,
  - a **dry analyst**, who is tired of this team.
- **Line templates per event,** with several variants. Picked with the match seed, like `pickLine` in `feedback.ts`.
- **Callbacks to the draft:** the casters remember bad picks and items.
  - "Lee Sin ADC still has 4 CS at 15 minutes."
  - "That Rabadon's on Garen is finally doing... nothing."
- **Example lines:**
  - Baron steal: "THE SMITE! A level 1 bot jungler just stole Baron! I need to sit down."
  - Ace: "That's an ace, and judging by the items, it was deserved."
  - Gank: "The jungler shows up mid. The mid laner did not ward. Nobody is surprised."
  - Early surrender: "And they surrender at 20. A wise decision, honestly."

## Bots (levels 1–3)

The strategies in `src/game/scoring/simulate.ts` can be reused:

- **Level 1:** a random team (the `random` strategy). Usually Iron/Bronze.
- **Level 2:** the `sensible` strategy. Usually Gold/Platinum.
- **Level 3:** the sensible strategy, best of several drafts. Usually Diamond and above, with a "final boss" feel.

Ideas: show the bot's rank emblem before the match, and give bots names ("xX_JungleDiff_Xx").

## Multiplayer (phase 2)

- **Async first (no live server):** player A drafts, a link carries the seed plus team A, player B drafts, and both watch the same seeded match. This works with today's setup.
- **Real-time later:** both players draft at the same time and watch together. Supabase Realtime could work here, since Supabase is already set up for the Daily.
- **Anti-cheat:** for ranked play, the server should run the simulation. For friendly matches, the shared seed is enough.

## Balancing

Tune by simulating thousands of matches, the same way the ranks were calibrated. Starting targets:

- Two equal teams: about 50% win rate.
- A 10-point team score difference: about 65–70% for the better team.
- A 30-point difference: the better team still loses about 5–10% of the time (upsets must exist).
- Average match: 25–35 game minutes, 15–35 kills total, and at least one "big moment".
- A test guards these numbers, like `simulate.test.ts` does for the ranks.

## Open questions

- Should the player make decisions during the match (e.g. "Contest Baron? Yes or no"), or only watch? Watching is simpler; decisions add depth.
- Exactly 1–2 minutes, or a speed setting (1×, 2×, skip)?
- Do bot matches count toward a win streak or a personal record?
- Does the Daily get a "Daily match" too (everyone fights the same bot)?
