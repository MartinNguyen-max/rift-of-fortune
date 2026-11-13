# Proposal: the race mini-game

The owner's idea (round 3): a fast champion, you hold a button and the champion gets faster and faster; the skill is letting go at the right moment. No rules yet, so here is a proposal. **Nothing is built until the owner picks.**

## Recommended: Sion, "Unstoppable Onslaught"

Sion charges down a lane toward the enemy team. The aim is to stop **on the target**, like curling.

- **Hold** (finger down or Space): Sion speeds up, faster and faster.
- **Let go**: Sion brakes and slides to a stop. The faster he goes, the longer the slide (speed squared, like a real car), so you have to judge it.
- **The target**: a glowing zone where the enemy team stands. Stop in the middle = 100 points, less the further off you stop.
- **Too far**: past the zone is the enemy tower. Hitting it = **crash, 0 points**, with a big CRASH.
- **Too short**: you stop before the zone = only a few points.
- **3 runs**, each on a new track: the target is closer or further away, and sometimes nearer to the tower, so you can't learn one hold time. Higher total wins.
- **Bot**: aims for the middle with an error that grows on harder tracks. Sometimes greedy (crashes), sometimes too careful.
- **Multiplayer**: both get the same 3 tracks at the same time. After each run you see the other player's Sion as a ghost: where they stopped, or that they crashed. Higher total wins; a tie goes to the closest single run.
- **Under the hood**: one move per run = how long you held (ms). The slide is worked out from that, so both players and the host always agree on the result.

Why this one: it is easy to understand in one picture ("stop on the X"), it has a clear risk (the tower), and it feels like Sion's ult.

## Other options

- **B. Nunu's snowball:** hold to roll the snowball. It grows and speeds up; let go to throw it at the enemy. Bigger = more points, but past a red line it hits a wall and breaks. The same skill, but about size instead of distance.
- **C. Drag race (Hecarim or Rammus):** two champions side by side, hold to speed up, but going too fast for too long overheats you (a bar fills), and overheating = spin-out. The first to the finish wins. More head-to-head, less precise.
- **D. Quinn:** Quinn flies over the map; hold to fly faster, let go to land in a bush before the enemy ward spots you. Harder to show on a phone.

## Questions for the owner

1. Sion (A), Nunu (B), the drag race (C) or Quinn (D)?
2. Is stopping on a target the right skill, or should it be pure speed with a risk (C)?
3. Should it come before or after the finisher animations? (Sion has no finisher animation in the list; Nunu doesn't either.)
