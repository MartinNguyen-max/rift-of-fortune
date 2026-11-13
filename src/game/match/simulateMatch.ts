import type { Role } from '../../data/types'
import { pickRandom, seededRandom, type RandomFn } from '../random'
import { ROLES } from '../roles'
import {
  BOUNTY,
  BUFF_EDGE,
  CLOSE_OUT,
  DRAGONS_FOR_SOUL,
  FAILED_GANK_KILL_CHANCE,
  GANK_BONUS,
  GOLD,
  GOLD_SCALE,
  KILL_SPREAD,
  LANE_TOWERS,
  LANE_WEIGHT,
  LOCK_IN,
  LUCK_SHARE,
  MATCH_TIMES,
  MAX_STREAK,
  NEXUS_TOWERS,
  OBJECTIVE_CHANCE,
  OBJECTIVE_LANE_WEIGHT,
  PENTAKILL_CHANCE,
  PUSH_KILL_MARGIN,
  STEAL_CHANCE,
  STREAK_EDGE,
  STRENGTH_SCALE,
  SURRENDER,
  TOWERS_FOR_INHIBITOR,
} from './config'
import { emptyStats, statsAfter } from './stats'
import { blueWinChance } from './winChance'
import {
  DRAGON_KINDS,
  opponent,
  type ChampionRef,
  type DragonKind,
  type EventTag,
  type Lane,
  LANES,
  type LiveMatch,
  type MatchScript,
  type ScriptedEvent,
  type Kill,
  type MapSpot,
  type MatchEvent,
  type MatchResult,
  type MatchTeams,
  type Scoreboard,
  type Side,
} from './types'

const LANE_ROLES: Record<Lane, Role[]> = { top: ['TOP'], mid: ['MIDDLE'], bot: ['BOTTOM', 'SUPPORT'] }
/** Who gets the last hit in bot lane, ADC or support. */
const BOT_LANE_KILL_SHARE = { BOTTOM: 0.7, SUPPORT: 0.3 } as const

type Objective = 'dragon' | 'grubs' | 'herald' | 'baron' | 'elder'
/** Pushes after an ace, Baron or Elder can end the game; after a smaller win they only take a structure. */
type PushPower = 'small' | 'big'

interface SideState {
  /** Gold earned from kills and objectives, on top of the passive income. */
  gold: number
  kills: number
  towers: number
  inhibitors: number
  dragons: number
  barons: number
  /** Lucky wins in a row while behind; makes the next contest more likely to go their way. */
  streak: number
  baronUntil: number
  elderUntil: number
}

const newSideState = (): SideState => ({
  gold: 0,
  kills: 0,
  towers: 0,
  inhibitors: 0,
  dragons: 0,
  barons: 0,
  streak: 0,
  baronUntil: -1,
  elderUntil: -1,
})

const logistic = (value: number) => 1 / (1 + Math.exp(-value))
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length


function weightedPick<T>(options: readonly T[], weight: (option: T) => number, random: RandomFn): T {
  const weights = options.map((option) => Math.max(0.0001, weight(option)))
  let roll = random() * weights.reduce((sum, value) => sum + value, 0)
  for (const [index, option] of options.entries()) {
    roll -= weights[index] ?? 0
    if (roll < 0) return option
  }
  return pickRandom(options, random)
}

interface ContestResult {
  winner: Side
  /** The winner's chance before the roll. */
  chance: number
}

/**
 * One simulated match. Mutable inside, but `simulateMatch` only exposes the finished result,
 * so the same teams and seed always give the same match.
 */
class Simulation {
  private time = 0
  private winner: Side | null = null
  private readonly events: MatchEvent[] = []
  /** Kills since the last event, attached to the next one. */
  private pendingKills: Kill[] = []
  /** K/D/A so far, so fed champions keep getting kills and feeders keep dying. */
  private readonly tally = emptyStats()
  private readonly sides: Record<Side, SideState> = { blue: newSideState(), red: newSideState() }
  private readonly spawns: Record<Objective, number> = {
    dragon: MATCH_TIMES.dragonSpawn,
    grubs: MATCH_TIMES.grubsSpawn,
    herald: MATCH_TIMES.heraldSpawn,
    baron: MATCH_TIMES.baronSpawn,
    elder: Infinity,
  }
  private readonly power: Record<Side, number>
  private readonly lanes: Record<Side, Record<Role, number>>
  private readonly random: RandomFn
  private readonly teams: MatchTeams
  /** Multiplayer live events. Empty against bots. */
  private readonly script: MatchScript
  private scriptIndex = 0
  private readonly scripted: number[] = []
  private pendingEvent: number | null = null

  constructor(teams: MatchTeams, random: RandomFn, script: MatchScript = { events: [], winners: [] }) {
    this.random = random
    this.teams = teams
    this.script = script
    // The live Baron is the first Baron of the game.
    if (this.liveEventAhead('baron')) this.spawns.baron = Infinity
    this.power = { blue: teams.blue.rating.score, red: teams.red.rating.score }
    const laneScores = (side: Side) =>
      Object.fromEntries(
        ROLES.map((role) => [
          role,
          teams[side].rating.champions.find((champion) => champion.role === role)?.score ?? this.power[side],
        ]),
      ) as Record<Role, number>
    this.lanes = { blue: laneScores('blue'), red: laneScores('red') }
  }

  run(seed: number): LiveMatch {
    this.time = this.between(MATCH_TIMES.firstEvent)
    while (this.winner === null) {
      if (!this.playLiveEvents()) break
      const closer = this.closer()
      if (closer) this.push(closer, 'big')
      else this.step()
      if (this.winner === null) this.maybeSurrender(closer)
      const gap = closer ? CLOSE_OUT.gap : this.time < MATCH_TIMES.laningEnd ? MATCH_TIMES.laningGap : MATCH_TIMES.lateGap
      this.time += this.between(gap)
    }
    const last = this.events[this.events.length - 1]
    return {
      seed,
      winner: this.winner,
      duration: last?.time ?? this.time,
      events: this.events,
      stats: statsAfter(this.events),
      scripted: this.scripted,
      pendingEvent: this.pendingEvent,
    }
  }

  // ── Live events (multiplayer) ───────────────────────────────

  /**
   * Plays every live event that is due. Returns false when the next one has no winner yet: the
   * match pauses there. Nothing random happens before the pause, so replaying the match with the
   * winner added gives exactly the same events up to this point.
   */
  private playLiveEvents(): boolean {
    for (;;) {
      const event = this.script.events[this.scriptIndex]
      if (!event || this.time < event.time) return true
      const winner = this.script.winners[this.scriptIndex]
      if (!winner) {
        this.pendingEvent = this.scriptIndex
        return false
      }
      this.playLiveEvent(event, winner)
      this.scriptIndex += 1
    }
  }

  private playLiveEvent(event: ScriptedEvent, winner: Side) {
    this.sides[winner].gold += event.gold
    this.scripted.push(this.events.length)
    switch (event.kind) {
      case 'gank':
        return this.gank({ ganker: event.ganker, lane: event.lane, winner })
      case 'teamfight':
        this.teamfight('mid', true, winner)
        return
      case 'baron':
      case 'elder':
        return this.contestObjective(event.kind, winner)
    }
  }

  /**
   * The game can end once no live event is left, or once the events left can't change who won
   * the most of them (2–0 with one to go).
   */
  private canEnd(): boolean {
    const left = this.script.events.length - this.scriptIndex
    if (left === 0) return true
    const played = this.script.winners.slice(0, this.scriptIndex)
    const blue = played.filter((side) => side === 'blue').length
    return Math.abs(blue - (played.length - blue)) > left
  }

  /**
   * The side that is sure enough to win that it pushes to end the game now, if any. Judged by the
   * game so far, where the draft counts little, so a better draft alone never closes a game.
   */
  private closer(): Side | null {
    if (this.time < CLOSE_OUT.from || !this.canEnd()) return null
    const chance = blueWinChance(this.teams, this.scoreboard(), LOCK_IN.weights)
    if (chance >= CLOSE_OUT.chance) return 'blue'
    if (1 - chance >= CLOSE_OUT.chance) return 'red'
    return null
  }

  private liveEventAhead(kind: ScriptedEvent['kind']): boolean {
    return this.script.events.slice(this.scriptIndex).some((event) => event.kind === kind)
  }

  // ── Turn order ──────────────────────────────────────────────

  private step() {
    const objectives = this.availableObjectives()
    const objective = objectives.includes('elder') ? 'elder' : objectives.includes('baron') ? 'baron' : objectives[0]
    if (objective && this.random() < OBJECTIVE_CHANCE) return this.contestObjective(objective)
    if (this.time >= MATCH_TIMES.suddenDeath) return this.teamfight('mid')
    if (this.time < MATCH_TIMES.laningEnd) return this.laningEvent()
    return this.midGameEvent()
  }

  private availableObjectives(): Objective[] {
    const up = (objective: Objective) => this.time >= this.spawns[objective]
    const list: Objective[] = []
    if (up('elder')) list.push('elder')
    if (up('baron')) list.push('baron')
    if (up('dragon')) list.push('dragon')
    if (up('herald') && this.time < MATCH_TIMES.heraldDespawn) list.push('herald')
    if (up('grubs') && this.time < MATCH_TIMES.heraldSpawn) list.push('grubs')
    return list
  }

  private laningEvent() {
    const towersAllowed = this.time >= MATCH_TIMES.firstTowerFrom
    const roll = this.random() * (towersAllowed ? 10 : 8)
    if (roll < 3.5) return this.soloKill()
    if (roll < 8) return this.gank()
    return this.laneTower()
  }

  private midGameEvent() {
    const roll = this.random() * 10
    if (roll < 4.5) return this.teamfight(pickRandom(['mid', 'top', 'bot', 'blueJungle', 'redJungle'], this.random))
    if (roll < 7.5) return this.laneTower()
    return this.soloKill()
  }

  // ── Contests ────────────────────────────────────────────────

  private goldLead(side: Side): number {
    return this.sides[side].gold - this.sides[opponent(side)].gold
  }

  private buffEdge(side: Side): number {
    const state = this.sides[side]
    return (this.time < state.baronUntil ? BUFF_EDGE.baron : 0) + (this.time < state.elderUntil ? BUFF_EDGE.elder : 0)
  }

  /**
   * 1 while the game is open, falling to 0 as one team becomes a clear favourite (the same win
   * chance the bar shows, from LOCK_IN.open to LOCK_IN.decided). Luck, comeback streaks and
   * bounties shrink with it, so a decided game stays decided.
   */
  private closeness(): number {
    const chance = blueWinChance(this.teams, this.scoreboard(), LOCK_IN.weights)
    const favourite = Math.max(chance, 1 - chance)
    return Math.min(1, Math.max(0, (LOCK_IN.decided - favourite) / (LOCK_IN.decided - LOCK_IN.open)))
  }

  /** Blue's chance to win a contest between two strength values (0–100 scale). */
  private blueChance(blue: number, red: number, withBuffs: boolean): number {
    const { blue: blueState, red: redState } = this.sides
    const closeness = this.closeness()
    const edge =
      (blue - red) / STRENGTH_SCALE +
      this.goldLead('blue') / GOLD_SCALE +
      (blueState.streak - redState.streak) * STREAK_EDGE * closeness +
      (withBuffs ? this.buffEdge('blue') - this.buffEdge('red') : 0)
    const luck = LUCK_SHARE * closeness
    return luck * 0.5 + (1 - luck) * logistic(edge)
  }

  /** Rolls who wins, unless a live event already decided it (`forcedWinner`). */
  private contest(strength: (side: Side) => number, withBuffs = false, forcedWinner?: Side): ContestResult {
    const blueChance = this.blueChance(strength('blue'), strength('red'), withBuffs)
    const winner: Side = forcedWinner ?? (this.random() < blueChance ? 'blue' : 'red')
    const chance = winner === 'blue' ? blueChance : 1 - blueChance
    this.updateStreaks(winner, chance)
    return { winner, chance }
  }

  /** A lucky win while behind starts or grows a streak; losing a contest ends it. */
  private updateStreaks(winner: Side, chance: number) {
    this.sides[opponent(winner)].streak = 0
    const state = this.sides[winner]
    if (chance < 0.5 && this.goldLead(winner) < 0) state.streak = Math.min(MAX_STREAK, state.streak + 1)
  }

  private laneStrength(side: Side, lane: Lane): number {
    const laneScore = average(LANE_ROLES[lane].map((role) => this.lanes[side][role]))
    return LANE_WEIGHT * laneScore + (1 - LANE_WEIGHT) * this.power[side]
  }

  private objectiveStrength(side: Side, roles: Role[]): number {
    const laneScore = average(roles.map((role) => this.lanes[side][role]))
    return OBJECTIVE_LANE_WEIGHT * laneScore + (1 - OBJECTIVE_LANE_WEIGHT) * this.power[side]
  }

  // ── Kills ───────────────────────────────────────────────────

  private totalKills(): number {
    return this.sides.blue.kills + this.sides.red.kills
  }

  private kill(killer: ChampionRef, victim: ChampionRef, assists: Role[] = []) {
    const killerSide = this.sides[killer.side]
    const bounty = Math.min(BOUNTY.max, Math.max(0, this.goldLead(victim.side)) * BOUNTY.share) * this.closeness()
    killerSide.kills += 1
    killerSide.gold += GOLD.kill + bounty
    this.tally[killer.side][killer.role].kills += 1
    this.tally[victim.side][victim.role].deaths += 1
    this.pendingKills.push({ killer, victim, assists })
  }

  /** Good picks get more kills, and a fed champion keeps getting fed (hyper carries). */
  private pickKiller(side: Side, roles: readonly Role[] = ROLES): Role {
    return weightedPick(
      roles,
      (role) =>
        Math.exp((this.lanes[side][role] - 50) / KILL_SPREAD.score) *
        (1 + this.tally[side][role].kills * KILL_SPREAD.fed),
      this.random,
    )
  }

  /** Weak picks die more often, and whoever keeps dying keeps dying (feeders). */
  private pickVictim(side: Side, roles: readonly Role[] = ROLES): Role {
    return weightedPick(
      roles,
      (role) =>
        Math.exp((50 - this.lanes[side][role]) / KILL_SPREAD.score) *
        (1 + this.tally[side][role].deaths * KILL_SPREAD.feeding),
      this.random,
    )
  }

  private laner(lane: Lane): Role {
    if (lane !== 'bot') return LANE_ROLES[lane][0] ?? 'MIDDLE'
    return this.random() < BOT_LANE_KILL_SHARE.BOTTOM ? 'BOTTOM' : 'SUPPORT'
  }

  // ── Lane events ─────────────────────────────────────────────

  private soloKill() {
    const lane = pickRandom(LANES, this.random)
    const firstBlood = this.totalKills() === 0
    const { winner, chance } = this.contest((side) => this.laneStrength(side, lane))
    const loser = opponent(winner)
    const killer: ChampionRef = { side: winner, role: this.laner(lane) }
    const victim: ChampionRef = { side: loser, role: this.laner(lane) }
    this.kill(killer, victim)
    this.addEvent({
      kind: 'soloKill',
      side: winner,
      actor: killer,
      target: victim,
      tags: this.tags({ firstBlood, upset: chance < 0.4 }),
      big: firstBlood,
      spot: lane,
    })
  }

  /** A random gank, or the live one (`live`), where the players already decided who wins. */
  private gank(live?: { ganker: Side; lane: Lane; winner: Side }) {
    const ganker: Side =
      live?.ganker ??
      (this.random() < this.blueChance(this.lanes.blue.JUNGLE, this.lanes.red.JUNGLE, false) ? 'blue' : 'red')
    const defender = opponent(ganker)
    const lane = live?.lane ?? pickRandom(LANES, this.random)
    const laner = this.laner(lane)
    const firstBlood = this.totalKills() === 0
    const { winner, chance } = this.contest(
      (side) =>
        side === ganker
          ? (this.lanes[side].JUNGLE + this.laneStrength(side, lane)) / 2 + GANK_BONUS
          : this.laneStrength(side, lane),
      false,
      live?.winner,
    )
    const upset = chance < 0.4
    const big = firstBlood || live !== undefined

    if (winner === ganker) {
      const killerRole = this.random() < 0.5 ? 'JUNGLE' : laner
      const assist = killerRole === 'JUNGLE' ? laner : 'JUNGLE'
      const killer: ChampionRef = { side: ganker, role: killerRole }
      const victim: ChampionRef = { side: defender, role: this.laner(lane) }
      this.kill(killer, victim, [assist])
      return this.addEvent({
        kind: 'gank',
        side: ganker,
        actor: killer,
        target: victim,
        tags: this.tags({ firstBlood, upset }),
        big,
        spot: lane,
      })
    }

    const defenderRef: ChampionRef = { side: defender, role: laner }
    const jungler: ChampionRef = { side: ganker, role: 'JUNGLE' }
    // A won live gank always ends in a kill: the guess was right, the jungler walked into a trap.
    if (live || this.random() < FAILED_GANK_KILL_CHANCE) {
      this.kill(defenderRef, jungler)
      return this.addEvent({
        kind: 'gank',
        side: defender,
        actor: defenderRef,
        target: jungler,
        tags: this.tags({ firstBlood, upset, counterGank: true }),
        big,
        spot: lane,
      })
    }
    this.addEvent({
      kind: 'gank',
      side: defender,
      actor: defenderRef,
      target: jungler,
      tags: ['escape'],
      big: false,
      spot: lane,
    })
  }

  private laneTower() {
    const lane = pickRandom(LANES, this.random)
    const { winner, chance } = this.contest((side) => this.laneStrength(side, lane))
    if (this.sides[winner].towers >= LANE_TOWERS) return this.push(winner, 'small')
    this.takeTower(winner, lane, chance < 0.4)
  }

  private takeTower(side: Side, lane: Lane, upset: boolean) {
    const firstTower = this.sides.blue.towers + this.sides.red.towers === 0
    this.sides[side].towers += 1
    this.sides[side].gold += GOLD.tower
    this.addEvent({
      kind: 'tower',
      side,
      actor: { side, role: this.laner(lane) },
      tags: this.tags({ firstTower, upset }),
      big: false,
      spot: lane,
    })
  }

  // ── Objectives ──────────────────────────────────────────────

  /** A contested objective. Live (multiplayer) Barons and Elders go to `liveWinner`, the better smite. */
  private contestObjective(objective: Objective, liveWinner?: Side) {
    if (liveWinner) {
      const { chance } = this.contest((side) => this.power[side], true, liveWinner)
      return this.takeObjective(objective, liveWinner, chance, true)
    }
    const fightFirst = this.time >= MATCH_TIMES.laningEnd && this.random() < 0.45
    const spot: MapSpot = objective === 'dragon' || objective === 'elder' ? 'dragon' : 'baron'
    if (fightFirst) {
      const fightWinner = this.teamfight(spot, false)
      return this.takeObjective(objective, fightWinner, 0.5)
    }
    const roles: Role[] =
      objective === 'dragon' || objective === 'elder'
        ? ['JUNGLE', 'BOTTOM', 'SUPPORT']
        : objective === 'grubs'
          ? ['JUNGLE', 'TOP']
          : ['JUNGLE', 'MIDDLE', 'TOP']
    const late = objective === 'baron' || objective === 'elder'
    const { winner, chance } = this.contest(
      (side) => (late ? this.power[side] : this.objectiveStrength(side, roles)),
      late,
    )
    this.takeObjective(objective, winner, chance)
  }

  /**
   * A live objective can't be stolen (the smite duel already decided it), and only pushes a little,
   * so one mini-game never ends the match on its own.
   */
  private takeObjective(objective: Objective, contestWinner: Side, chance: number, live = false) {
    const stealChance = objective === 'dragon' || objective === 'baron' || objective === 'elder' ? STEAL_CHANCE[objective] : 0
    const stolen = !live && this.random() < stealChance
    const followUp: PushPower = live ? 'small' : 'big'
    const side = stolen ? opponent(contestWinner) : contestWinner
    const tags = this.tags({ steal: stolen, upset: stolen || chance < 0.4 })
    const actor: ChampionRef = { side, role: 'JUNGLE' }
    const state = this.sides[side]

    switch (objective) {
      case 'dragon': {
        state.dragons += 1
        state.gold += GOLD.dragon
        const soul = state.dragons === DRAGONS_FOR_SOUL
        if (soul) tags.push('soul')
        this.spawns.dragon = soul ? Infinity : this.time + MATCH_TIMES.dragonRespawn
        // With a live Elder still to come, that one is the first Elder of the game.
        if (soul && !this.liveEventAhead('elder')) this.spawns.elder = this.time + MATCH_TIMES.elderRespawn
        return this.addEvent({ kind: 'dragon', side, actor, tags, big: stolen || soul, spot: 'dragon', dragon: this.dragonKind() })
      }
      case 'grubs':
        state.gold += GOLD.grubs
        this.spawns.grubs = Infinity
        return this.addEvent({ kind: 'grubs', side, actor, tags, big: false, spot: 'baron' })
      case 'herald':
        state.gold += GOLD.herald
        this.spawns.herald = Infinity
        this.addEvent({ kind: 'herald', side, actor, tags, big: false, spot: 'baron' })
        return this.push(side, 'small')
      case 'baron':
        state.barons += 1
        state.gold += GOLD.baron
        state.baronUntil = this.time + MATCH_TIMES.baronBuff
        this.spawns.baron = this.time + MATCH_TIMES.baronRespawn
        this.addEvent({ kind: 'baron', side, actor, tags, big: true, spot: 'baron' })
        return this.push(side, followUp)
      case 'elder':
        state.gold += GOLD.elder
        state.elderUntil = this.time + MATCH_TIMES.elderBuff
        this.spawns.elder = this.time + MATCH_TIMES.elderRespawn
        this.addEvent({ kind: 'elder', side, actor, tags, big: true, spot: 'dragon' })
        return this.push(side, followUp)
    }
  }

  /** Dragon types are random, like the Rift's elemental dragons. */
  private dragonKind(): DragonKind {
    return pickRandom(DRAGON_KINDS, this.random)
  }

  // ── Teamfights and pushes ───────────────────────────────────

  /**
   * Plays a teamfight and returns the winner. Big wins are followed by a push unless `canPush` is
   * false. A live teamfight goes to `liveWinner`, the better ult.
   */
  private teamfight(spot: MapSpot, canPush = true, liveWinner?: Side): Side {
    const firstBlood = this.totalKills() === 0
    const { winner, chance } = this.contest((side) => this.power[side], true, liveWinner)
    const loser = opponent(winner)
    const winnerKills = Math.min(5, 1 + Math.floor(this.random() * 4) + (chance > 0.65 ? 1 : 0))
    const loserKills = Math.floor(this.random() * Math.min(3, winnerKills))
    const ace = winnerKills === 5
    const pentakill = ace && this.random() < PENTAKILL_CHANCE

    const fightKills = this.fightKills(winner, winnerKills, pentakill)
    this.fightKills(loser, loserKills, false)

    this.addEvent({
      kind: 'teamfight',
      side: winner,
      actor: { side: winner, role: fightKills.topKiller },
      fightKills: { [winner]: winnerKills, [loser]: loserKills } as Record<Side, number>,
      tags: this.tags({ firstBlood, upset: chance < 0.4, ace, pentakill }),
      big: liveWinner !== undefined || ace || winnerKills - loserKills >= 3,
      spot,
    })

    const decisive = ace || winnerKills - loserKills >= PUSH_KILL_MARGIN
    const suddenDeath = this.time >= MATCH_TIMES.suddenDeath
    if (canPush && (decisive || suddenDeath)) this.push(winner, ace || suddenDeath ? 'big' : 'small')
    return winner
  }

  /** Hands out `count` kills from `side` on distinct enemies, and returns who got the most. */
  private fightKills(side: Side, count: number, pentakill: boolean): { topKiller: Role } {
    const enemy = opponent(side)
    let victims = [...ROLES]
    const killsBy = new Map<Role, number>()
    const penta = this.pickKiller(side)
    for (let index = 0; index < count; index++) {
      const victim = this.pickVictim(enemy, victims)
      victims = victims.filter((role) => role !== victim)
      const killer = pentakill ? penta : this.pickKiller(side)
      const assists = ROLES.filter((role) => role !== killer && this.random() < 0.5)
      this.kill({ side, role: killer }, { side: enemy, role: victim }, assists)
      killsBy.set(killer, (killsBy.get(killer) ?? 0) + 1)
    }
    const [topKiller] = [...killsBy.entries()].sort((a, b) => b[1] - a[1])[0] ?? [penta]
    return { topKiller }
  }

  private push(side: Side, power: PushPower) {
    this.time += this.between(MATCH_TIMES.followUp)
    const state = this.sides[side]
    const inhibitorsOpen = this.time >= MATCH_TIMES.inhibitorsFrom && state.towers >= TOWERS_FOR_INHIBITOR
    const baseSpot: MapSpot = side === 'blue' ? 'redBase' : 'blueBase'

    if (power === 'big' && state.inhibitors > 0 && this.canEnd()) {
      state.towers += NEXUS_TOWERS
      this.winner = side
      return this.addEvent({ kind: 'nexus', side, actor: null, tags: [], big: true, spot: baseSpot })
    }
    if (inhibitorsOpen && (power === 'big' || state.inhibitors === 0 || state.towers >= LANE_TOWERS) && state.inhibitors < 3) {
      state.inhibitors += 1
      state.gold += GOLD.inhibitor
      return this.addEvent({ kind: 'inhibitor', side, actor: null, tags: [], big: false, spot: baseSpot })
    }
    if (state.towers < LANE_TOWERS) this.takeTower(side, pickRandom(LANES, this.random), false)
  }

  /** A team far behind in gold may give up, and so may a team being closed out. */
  private maybeSurrender(closer: Side | null) {
    if (!this.canEnd()) return
    const goldLeader: Side = this.goldLead('blue') >= 0 ? 'blue' : 'red'
    const fedUp = this.time >= MATCH_TIMES.surrenderFrom && this.goldLead(goldLeader) >= SURRENDER.lead
    const leader = closer ?? (fedUp ? goldLeader : null)
    if (!leader || this.time < MATCH_TIMES.surrenderFrom) return
    if (this.random() >= (closer ? CLOSE_OUT.surrenderChance : SURRENDER.chance)) return
    this.time += this.between(MATCH_TIMES.followUp)
    this.winner = leader
    this.addEvent({ kind: 'surrender', side: leader, actor: null, tags: [], big: true, spot: leader === 'blue' ? 'redBase' : 'blueBase' })
  }

  // ── Helpers ─────────────────────────────────────────────────

  private between({ min, max }: { min: number; max: number }): number {
    return Math.round(min + this.random() * (max - min))
  }

  private tags(flags: Partial<Record<EventTag, boolean>>): EventTag[] {
    return (Object.keys(flags) as EventTag[]).filter((tag) => flags[tag])
  }

  private scoreboard(): Scoreboard {
    const passive = GOLD.start + (GOLD.perMinute * this.time) / 60
    const sideScore = (side: Side) => {
      const { kills, towers, dragons, barons, inhibitors, gold } = this.sides[side]
      return { kills, towers, dragons, barons, inhibitors, gold: Math.round((passive + gold) / 100) * 100 }
    }
    return { blue: sideScore('blue'), red: sideScore('red') }
  }

  private addEvent(
    event: Pick<MatchEvent, 'kind' | 'side' | 'tags' | 'big' | 'spot'> & Partial<Pick<MatchEvent, 'actor' | 'target' | 'fightKills' | 'dragon'>>,
  ) {
    this.events.push({
      actor: null,
      target: null,
      fightKills: null,
      dragon: null,
      ...event,
      kills: this.pendingKills,
      time: this.time,
      score: this.scoreboard(),
    })
    this.pendingKills = []
  }
}

/** Plays a whole match up front. The UI only plays the events back. */
export function simulateMatch(teams: MatchTeams, seed: number): MatchResult {
  const { winner, duration, events, stats } = new Simulation(teams, seededRandom(seed)).run(seed)
  if (!winner) throw new Error('A match without live events always ends')
  return { seed, winner, duration, events, stats }
}

/**
 * Multiplayer: plays the match up to the first live event without a winner and pauses there.
 * Both players run this with the same teams, seed and winners, so they always see the same match.
 */
export function simulateLiveMatch(teams: MatchTeams, seed: number, script: MatchScript): LiveMatch {
  return new Simulation(teams, seededRandom(seed), script).run(seed)
}

/** The finished live match as a normal match result, or null while it is still going. */
export function finishedMatch({ seed, winner, duration, events, stats }: LiveMatch): MatchResult | null {
  return winner ? { seed, winner, duration, events, stats } : null
}

/** Gold difference (blue minus red) after an event. */
export const goldDifference = ({ score }: Pick<MatchEvent, 'score'>): number => score.blue.gold - score.red.gold
