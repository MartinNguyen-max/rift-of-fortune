/**
 * All match simulation numbers in one place. Times are in game seconds.
 * Tuned with the balancing tests in simulateMatch.test.ts.
 */

const MINUTE = 60

export const MATCH_TIMES = {
  firstEvent: { min: 2 * MINUTE + 30, max: 3 * MINUTE + 30 },
  /** Gap between two events during laning and later in the game. */
  laningGap: { min: 40, max: 95 },
  lateGap: { min: 40, max: 95 },
  /** Delay before a push that follows a won fight or Baron. */
  followUp: { min: 15, max: 30 },
  laningEnd: 14 * MINUTE,
  firstTowerFrom: 9 * MINUTE,
  dragonSpawn: 5 * MINUTE,
  dragonRespawn: 5 * MINUTE,
  grubsSpawn: 6 * MINUTE,
  heraldSpawn: 14 * MINUTE,
  heraldDespawn: 19 * MINUTE + 45,
  baronSpawn: 20 * MINUTE,
  baronRespawn: 6 * MINUTE,
  elderRespawn: 6 * MINUTE,
  baronBuff: 3 * MINUTE,
  elderBuff: 2 * MINUTE + 30,
  /** Inhibitors and the Nexus can only fall after this. */
  inhibitorsFrom: 20 * MINUTE,
  surrenderFrom: 20 * MINUTE,
  /** After this every won teamfight ends the game, so matches never run forever. */
  suddenDeath: 42 * MINUTE,
} as const

/**
 * Every contest is decided by `chance = LUCK_SHARE × 50% + (1 − LUCK_SHARE) × strength chance`,
 * so the underdog always keeps at least LUCK_SHARE / 2 of a chance.
 */
export const LUCK_SHARE = 0.3

/** A strength difference of this many points (0–100 scale) gives the stronger side ~73% before luck. */
export const STRENGTH_SCALE = 21

/** A gold lead of this size counts like one STRENGTH_SCALE of strength (snowball). */
export const GOLD_SCALE = 6500

/** Each lucky win in a row adds this much edge to the losing team's next contests (comebacks). */
export const STREAK_EDGE = 0.35
export const MAX_STREAK = 3

/** Extra edge in fights while holding a buff. */
export const BUFF_EDGE = { baron: 0.8, elder: 1.6 } as const

/** How much each source of strength counts in a contest. The rest is the whole team's score. */
export const LANE_WEIGHT = 0.6
export const OBJECTIVE_LANE_WEIGHT = 0.4

/** Chance that a jungler smite-steals an objective, no matter how strong the teams are. */
export const STEAL_CHANCE = { dragon: 0.05, baron: 0.09, elder: 0.08 } as const

/** The chance of contesting an objective as soon as it is up, versus a lane or fight event. */
export const OBJECTIVE_CHANCE = 0.6

export const GOLD = {
  kill: 300,
  tower: 600,
  inhibitor: 200,
  dragon: 250,
  grubs: 250,
  herald: 300,
  baron: 1500,
  elder: 1000,
  /** Team gold at 0:00 (5 × 500), and the passive income per minute for the whole team. */
  start: 2500,
  perMinute: 1650,
} as const

/**
 * Multiplayer: extra gold for winning live events, on top of what each event itself is worth, so a
 * won mini-game always matters. The total is split evenly over the events of a match, so 3 or 5
 * events weigh the same in total. Tuned with the live match tests in liveMatch.test.ts: between
 * equal teams, 3–0 in events wins ~97% and 2–1 ~83%; a team rated 15+ points better that loses
 * every event wins about half the time.
 */
export const LIVE_EVENT_GOLD_TOTAL = 15000

/**
 * A team this sure to win stops trading and pushes to end: one structure after another with short
 * gaps, so a decided game doesn't drag on at 90%+. Judged by the game so far (the simulation's
 * own LOCK_IN formula, where the draft counts little), so a better draft alone never closes a
 * game and comebacks stay possible. The losing side may surrender instead, like a real FF vote.
 */
export const CLOSE_OUT = {
  chance: 0.93,
  /** Not before inhibitors can fall, so early leads can still be thrown. */
  from: 20 * 60,
  /** Chance per event that the team being closed out surrenders. */
  surrenderChance: 0.15,
  gap: { min: 20, max: 35 },
} as const

/** Extra gold for kills on a leading team: this share of the lead, capped (shutdown bounties). */
export const BOUNTY = { share: 0.08, max: 1000 } as const

export const DRAGONS_FOR_SOUL = 4
export const LANE_TOWERS = 9
export const NEXUS_TOWERS = 2
/** Lane towers a team must take before it can hit an inhibitor. */
export const TOWERS_FOR_INHIBITOR = 3

/** A teamfight won by at least this many kills (or an ace) is followed by a push. */
export const PUSH_KILL_MARGIN = 2

/** Losing team surrenders at most once per check with this chance when far behind. */
export const SURRENDER = { lead: 10000, chance: 0.3 } as const

/** Chance that an ace turns into a pentakill for one champion. */
export const PENTAKILL_CHANCE = 0.08

/** A gank that fails ends in a kill for the defender this often, otherwise everyone survives. */
export const FAILED_GANK_KILL_CHANCE = 0.5
/** Bonus strength for the ganking side (two against one). */
export const GANK_BONUS = 12

/**
 * Who gets the kills in a teamfight. A 15-point better champion is e^1 ≈ 2.7× as likely to get a
 * kill, and each kill or death so far adds 60% to the odds, so carries snowball (17/2) and
 * feeders keep feeding (1/11), like in real low-elo games. This only decides who gets a kill,
 * never which team wins.
 */
export const KILL_SPREAD = { score: 12, fed: 0.6, feeding: 1.2 } as const

/**
 * Decided games stay decided: luck, comeback streaks and bounties are at full strength while the
 * favourite's win chance is below `open`, and fade to nothing as it reaches `decided`.
 * Close games stay swingy; a team shown at 85%+ almost always wins.
 */
export const LOCK_IN = {
  open: 0.65,
  decided: 0.95,
  /**
   * How the simulation judges who is winning, kept separate from the win-chance bar's fitted
   * weights so refitting the bar never changes how matches play out.
   */
  weights: { rating: 0.035, goldShare: 0.58, tower: 0.2, inhibitor: 0.58, baron: 0.15 },
} as const
