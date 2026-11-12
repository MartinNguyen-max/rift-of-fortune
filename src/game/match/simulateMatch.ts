import type { Role } from '../../data/types'
import { pickRandom, seededRandom, type RandomFn } from '../random'
import { ROLES } from '../roles'
import {
  BOUNTY,
  BUFF_EDGE,
  DRAGONS_FOR_SOUL,
  FAILED_GANK_KILL_CHANCE,
  GANK_BONUS,
  GOLD,
  GOLD_SCALE,
  LANE_TOWERS,
  LANE_WEIGHT,
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
import {
  DRAGON_KINDS,
  opponent,
  type ChampionRef,
  type ChampionStats,
  type DragonKind,
  type EventTag,
  type MapSpot,
  type MatchEvent,
  type MatchResult,
  type MatchTeams,
  type Scoreboard,
  type Side,
} from './types'

type Lane = 'top' | 'mid' | 'bot'
const LANES = ['top', 'mid', 'bot'] as const satisfies readonly Lane[]
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

function emptyStats(): ChampionStats {
  const forSide = () =>
    Object.fromEntries(ROLES.map((role) => [role, { kills: 0, deaths: 0, assists: 0 }])) as ChampionStats[Side]
  return { blue: forSide(), red: forSide() }
}

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
  private readonly stats = emptyStats()
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

  constructor(teams: MatchTeams, random: RandomFn) {
    this.random = random
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

  run(seed: number): MatchResult {
    this.time = this.between(MATCH_TIMES.firstEvent)
    while (this.winner === null) {
      this.step()
      if (this.winner === null) this.maybeSurrender()
      this.time += this.between(this.time < MATCH_TIMES.laningEnd ? MATCH_TIMES.laningGap : MATCH_TIMES.lateGap)
    }
    const last = this.events[this.events.length - 1]
    return { seed, winner: this.winner, duration: last?.time ?? this.time, events: this.events, stats: this.stats }
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

  /** Blue's chance to win a contest between two strength values (0–100 scale). */
  private blueChance(blue: number, red: number, withBuffs: boolean): number {
    const { blue: blueState, red: redState } = this.sides
    const edge =
      (blue - red) / STRENGTH_SCALE +
      this.goldLead('blue') / GOLD_SCALE +
      (blueState.streak - redState.streak) * STREAK_EDGE +
      (withBuffs ? this.buffEdge('blue') - this.buffEdge('red') : 0)
    return LUCK_SHARE * 0.5 + (1 - LUCK_SHARE) * logistic(edge)
  }

  private contest(strength: (side: Side) => number, withBuffs = false): ContestResult {
    const blueChance = this.blueChance(strength('blue'), strength('red'), withBuffs)
    const winner: Side = this.random() < blueChance ? 'blue' : 'red'
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
    const bounty = Math.min(BOUNTY.max, Math.max(0, this.goldLead(victim.side)) * BOUNTY.share)
    killerSide.kills += 1
    killerSide.gold += GOLD.kill + bounty
    this.stats[killer.side][killer.role].kills += 1
    this.stats[victim.side][victim.role].deaths += 1
    for (const role of assists) this.stats[killer.side][role].assists += 1
  }

  /** Carries with good scores get more kills. */
  private pickKiller(side: Side, roles: readonly Role[] = ROLES): Role {
    return weightedPick(roles, (role) => this.lanes[side][role] + 10, this.random)
  }

  /** Weak picks die more often. */
  private pickVictim(side: Side, roles: readonly Role[] = ROLES): Role {
    return weightedPick(roles, (role) => 115 - this.lanes[side][role], this.random)
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

  private gank() {
    const blueGanks =
      this.random() < this.blueChance(this.lanes.blue.JUNGLE, this.lanes.red.JUNGLE, false)
    const ganker: Side = blueGanks ? 'blue' : 'red'
    const defender = opponent(ganker)
    const lane = pickRandom(LANES, this.random)
    const laner = this.laner(lane)
    const firstBlood = this.totalKills() === 0
    const { winner, chance } = this.contest((side) =>
      side === ganker
        ? (this.lanes[side].JUNGLE + this.laneStrength(side, lane)) / 2 + GANK_BONUS
        : this.laneStrength(side, lane),
    )
    const upset = chance < 0.4

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
        big: firstBlood,
        spot: lane,
      })
    }

    const defenderRef: ChampionRef = { side: defender, role: laner }
    const jungler: ChampionRef = { side: ganker, role: 'JUNGLE' }
    if (this.random() < FAILED_GANK_KILL_CHANCE) {
      this.kill(defenderRef, jungler)
      return this.addEvent({
        kind: 'gank',
        side: defender,
        actor: defenderRef,
        target: jungler,
        tags: this.tags({ firstBlood, upset, counterGank: true }),
        big: firstBlood,
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

  private contestObjective(objective: Objective) {
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

  private takeObjective(objective: Objective, contestWinner: Side, chance: number) {
    const stealChance = objective === 'dragon' || objective === 'baron' || objective === 'elder' ? STEAL_CHANCE[objective] : 0
    const stolen = this.random() < stealChance
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
        if (soul) this.spawns.elder = this.time + MATCH_TIMES.elderRespawn
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
        return this.push(side, 'big')
      case 'elder':
        state.gold += GOLD.elder
        state.elderUntil = this.time + MATCH_TIMES.elderBuff
        this.spawns.elder = this.time + MATCH_TIMES.elderRespawn
        this.addEvent({ kind: 'elder', side, actor, tags, big: true, spot: 'dragon' })
        return this.push(side, 'big')
    }
  }

  /** Dragon types are random, like the Rift's elemental dragons. */
  private dragonKind(): DragonKind {
    return pickRandom(DRAGON_KINDS, this.random)
  }

  // ── Teamfights and pushes ───────────────────────────────────

  /** Plays a teamfight and returns the winner. Big wins are followed by a push unless `canPush` is false. */
  private teamfight(spot: MapSpot, canPush = true): Side {
    const firstBlood = this.totalKills() === 0
    const { winner, chance } = this.contest((side) => this.power[side], true)
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
      big: ace || winnerKills - loserKills >= 3,
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

    if (power === 'big' && state.inhibitors > 0) {
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

  private maybeSurrender() {
    if (this.time < MATCH_TIMES.surrenderFrom) return
    const leader: Side = this.goldLead('blue') >= 0 ? 'blue' : 'red'
    if (this.goldLead(leader) < SURRENDER.lead || this.random() >= SURRENDER.chance) return
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
      const { kills, towers, dragons, barons, gold } = this.sides[side]
      return { kills, towers, dragons, barons, gold: Math.round((passive + gold) / 100) * 100 }
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
      time: this.time,
      score: this.scoreboard(),
    })
  }
}

/** Plays a whole match up front. The UI only plays the events back. */
export function simulateMatch(teams: MatchTeams, seed: number): MatchResult {
  return new Simulation(teams, seededRandom(seed)).run(seed)
}

/** Gold difference (blue minus red) after an event. */
export const goldDifference = ({ score }: Pick<MatchEvent, 'score'>): number => score.blue.gold - score.red.gold
