# Round 3: mini-game changes and new mini-games

Written from the owner's notes (originally in Danish). Do this first, before `docs/animation_feature.md`.

## Remove the teamfight game

- The ult-timing game (`ult`, "Unstoppable Force", Malphite) is removed as its own game.
- Its mechanic (a marker sweeping a bar, stop it in the zone) is used instead for **how you hit the smite in the Baron and Elder fight**. So the smite game gets the timing-bar feel.
- Check everything that refers to `ult`: the catalog, registry, live events (teamfights now come from other games), lobby list, tests and docs.

## New game: Darius, five ults

- You play Darius and must ult 5 enemies.
- The enemies appear one after another, each on screen for a very short time, so you must tap fast.
- Kills are counted as streaks: kill, double kill, triple kill... penta kill if you get all five. Show the streak name big.

## New game: race

- A race with a fast champion: Sion ult, Nunu's snowball, Quinn, or another fast champion.
- You hold a button down. While it is held, the champion gets faster and faster toward a goal. The skill is **letting go (or braking) at the right moment**.
- The owner has no clear rules yet. Propose a design and define it: what is the goal, what goes wrong if you hold too long (crash, overshoot), how the winner is decided, what the bot does, and a short Multiplayer version. Explain it and let the owner decide.

## New game: Zed shadows (shell game)

- Like the cup game where you guess which cup hides the ball.
- Zed has three shadows. All three are shown, and one is pointed out.
- Then they are shuffled around each other, fast enough to be hard to follow but still possible to follow.
- Afterwards the player picks the correct one.
- It can also be done with Shaco (clones). That depends on the animation feature, so decide later.

## Ideas to save (not now)

Save these in `docs/ideas.md` and remember them:

- **Tahm Kench:** eats another champion to save them before a Jinx ult or similar. The owner thinks this is not so good. Save it, low priority.
- **Twisted Fate teleport guess:** guess which lane he teleports to (top, mid, bot), like the bushes but with a different layout.
- **Nocturne:** the same lane guess, but dark. Use animations where they exist.
- **Yasuo windwall:** a windwall must be up before you are shot. Maybe Yasuo stands in the middle and you block attacks from right, left, up and down, fired by different champions. Not sure how it should work.



## newest thoughts and decision and feedback.
Yes we can remove the teamfight, but the idea we used for it is already moved to malphite. that is alright. keep that. make it a bit faster and harder please.

the way elder and baron fights are now, with lee sin is fine. maybe it harder, and it is too easy to get the same answer all the time with enemy. but overall pretty okay.

many of the new things i just wrote is not aligned with the last commit, so they were made before that. so some are outdated.

make sure to update all mini games with a intro so they align with the rest of the game! 

## direct feedback on last commit.
when pressing multiplayer, and creating a game, if i keep switching between live events amount, essentially the app will crash and be stuck. i dont know why. but multiplayer must have perfect perfomance.

as said before, we added a new pace. called FAST but we already have fast. the please give them both a fitting name. like equal teams, lets settle tthis in fights!

also update the landingpage describing all minigames.

the head shot game. it it still very hard to for me to know how the game works. i like the idea, but it is too confusing. maybe use a doll, or like something from leage, an icon of baron, something, whenever that appears, press it as fast as you can you shoot that instead. i like intro.

the whole multiplayer has waaay to many errors. sometimes it says other user wasnt joined, even though both are in. leaving and rejoining works weird, too often we cant press ready. when trying to select many gamemodes in the "custom" i wanted to try all, it all crashed. couldnt select or deselect. it was not playable at all!

in blitzcrank it was hard to know how to grab. there could have been a grab button

in udyr, why is the combination before the same as the prev but just with something added? i told you to make it all different each.. make it 3, 5, and then 7 combos. you decide the timing user can see abilities. it is ok for now i think.

in teemo game. you die when you touch 1 schroom. shouldnt be like that. we should just count how many shrooms enemy walked into. it could be all three. because the game as it is, i guess when in multiplayer, user both place shrooms, then both walk, and then score are compared? right? it could be nice if you could place shrooms, and also get to see the other one play your. kind of live gaming if that is possible. please do if possible.

other games are fine.

