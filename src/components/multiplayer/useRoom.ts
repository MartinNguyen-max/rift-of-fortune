import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gameData } from '../../data'
import {
  lobbyPlayers,
  type Emote,
  type LobbyPlayer,
  type PlayerId,
  type PlayerStatus,
  type PresenceInfo,
  type RoomMessage,
} from '../../game/multiplayer/protocol'
import { hostMessages, mergeRounds, roundReducer, shiftRound, type RoundState } from '../../game/multiplayer/session'
import { defaultSettings, DRAFT_SECONDS, type LobbySettings } from '../../game/multiplayer/settings'
import { laneTeam } from '../../game/multiplayer/lanes'
import { randomEncodedTeam } from '../../game/multiplayer/teamCode'
import { randomTeamName } from '../../game/multiplayer/teamNames'
import { joinRoom, type ConnectionStatus, type RoomConnection } from '../../services/realtime'
import { roomIdentity, saveRoomIdentity } from '../../services/roomIdentity'

export interface FlyingEmote {
  key: number
  emote: Emote
  mine: boolean
  /** Where it flies up, 0–1 across the screen. */
  x: number
}

/** How often the host checks whether to move the game along. */
const HOST_TICK_MS = 400
const EMOTE_COOLDOWN_MS = 180
const EMOTE_LIFETIME_MS = 2200
/** Quick changes (clicking through the settings) go out as one status message. */
const STATUS_DELAY_MS = 120

/** Remembers which host messages were sent, so a slow echo never makes the host send one twice. */
function messageKey(message: RoomMessage): string {
  const round = 'round' in message ? message.round : ''
  const event = 'event' in message ? message.event : ''
  const move = message.type === 'move' ? `:${message.player}:${message.step}` : ''
  return `${message.type}:${round}:${event}${move}`
}

const statusOf = ({ name, ready, playing, settings }: LobbyPlayer): PlayerStatus => ({ name, ready, playing, settings })

/**
 * One multiplayer lobby: the connection, who is in it, the current game (built from the messages)
 * and the series score. When this player is the host (the first to join), it also sends the
 * messages that move the game along. If the host leaves, the other player takes over.
 *
 * A player who reloads or loses the connection keeps their id and gets the round sent again by
 * the other player, so the game goes on.
 */
export function useRoom(code: string) {
  const [identity] = useState(() =>
    roomIdentity(code, () => ({ id: crypto.randomUUID(), joinedAt: Date.now(), name: randomTeamName(), settings: null, wins: {} })),
  )
  const [me, setMe] = useState<LobbyPlayer>(() => ({
    id: identity.id,
    joinedAt: identity.joinedAt,
    name: identity.name,
    ready: false,
    playing: false,
    settings: identity.settings ?? defaultSettings(),
  }))
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [present, setPresent] = useState<PresenceInfo[]>([])
  const [statuses, setStatuses] = useState<Partial<Record<PlayerId, PlayerStatus>>>({})
  const [round, setRound] = useState<RoundState | null>(null)
  const [emotes, setEmotes] = useState<FlyingEmote[]>([])
  const [wins, setWins] = useState<Partial<Record<PlayerId, number>>>(identity.wins)

  const connection = useRef<RoomConnection | null>(null)
  const meRef = useRef(me)
  const roundRef = useRef(round)
  const playersRef = useRef<LobbyPlayer[]>([])
  const sent = useRef(new Set<string>())
  const starting = useRef(false)
  const finishedRounds = useRef(new Set<string>())
  /** When each player of the current round was first missed (host only). */
  const goneSince = useRef(new Map<PlayerId, number>())
  const statusTimer = useRef<number | undefined>(undefined)
  const lastEmote = useRef(0)
  const emoteKey = useRef(0)

  const players = useMemo(() => lobbyPlayers(present, { ...statuses, [me.id]: statusOf(me) }), [present, statuses, me])

  useEffect(() => {
    roundRef.current = round
    playersRef.current = players
  }, [round, players])

  useEffect(() => {
    saveRoomIdentity(code, { id: me.id, joinedAt: me.joinedAt, name: me.name, settings: me.settings ?? null, wins })
  }, [code, me.id, me.joinedAt, me.name, me.settings, wins])

  const send = useCallback((message: RoomMessage) => connection.current?.send(message), [])

  const sendStatus = useCallback(
    (hello: boolean) => send({ type: 'status', player: meRef.current.id, status: statusOf(meRef.current), hello }),
    [send],
  )

  const updateMe = useCallback(
    (patch: Partial<PlayerStatus>) => {
      const next = { ...meRef.current, ...patch }
      meRef.current = next
      setMe(next)
      if (statusTimer.current !== undefined) return
      statusTimer.current = window.setTimeout(() => {
        statusTimer.current = undefined
        sendStatus(false)
      }, STATUS_DELAY_MS)
    },
    [sendStatus],
  )

  useEffect(() => {
    const isUnfinishedPlayer = (state: RoundState | null, player: PlayerId): state is RoundState =>
      state !== null && !finishedRounds.current.has(state.id) && state.players.some(({ id }) => id === player)

    const onStatus = (message: Extract<RoomMessage, { type: 'status' }>) => {
      if (message.player === meRef.current.id) return
      setStatuses((current) => ({ ...current, [message.player]: message.status }))
      if (!message.hello) return
      // They just (re)connected: tell them who we are, and hand them the game if they are in it.
      sendStatus(false)
      const current = roundRef.current
      if (isUnfinishedPlayer(current, message.player)) {
        send({ type: 'sync', to: message.player, sentAt: Date.now(), state: current })
      }
    }

    const onSync = (message: Extract<RoomMessage, { type: 'sync' }>) => {
      if (message.to !== meRef.current.id) return
      const theirs = shiftRound(message.state, Date.now() - message.sentAt)
      if (!isUnfinishedPlayer(theirs, meRef.current.id)) return
      const joining = roundRef.current?.id !== theirs.id
      setRound((current) => {
        if (current?.id === theirs.id) return mergeRounds(current, theirs)
        return current && !finishedRounds.current.has(current.id) ? current : theirs
      })
      if (joining) updateMe({ ready: false, playing: true })
    }

    const onMessage = (message: RoomMessage) => {
      if (message.type === 'status') return onStatus(message)
      if (message.type === 'sync') return onSync(message)
      if (message.type === 'emote') {
        const key = (emoteKey.current += 1)
        const mine = message.player === meRef.current.id
        setEmotes((current) => [...current, { key, emote: message.emote, mine, x: 0.08 + Math.random() * 0.84 }])
        window.setTimeout(() => setEmotes((current) => current.filter((emote) => emote.key !== key)), EMOTE_LIFETIME_MS)
        return
      }
      setRound((current) => roundReducer(current, message, Date.now()))
      if (message.type === 'startDraft' && message.players.some(({ id }) => id === meRef.current.id)) {
        updateMe({ ready: false, playing: true })
      }
    }

    const onConnection = (next: ConnectionStatus) => {
      setStatus(next)
      if (next === 'connected') sendStatus(true)
    }

    const room = joinRoom(code, { id: meRef.current.id, joinedAt: meRef.current.joinedAt }, { onMessage, onPresence: setPresent, onStatus: onConnection })
    connection.current = room
    return () => {
      room?.leave()
      connection.current = null
      window.clearTimeout(statusTimer.current)
      statusTimer.current = undefined
    }
  }, [code, send, sendStatus, updateMe])

  const opponent = players.find(({ id }) => id !== me.id) ?? null
  const isPlayer = players.some(({ id }) => id === me.id)
  const isHost = players[0]?.id === me.id
  /** The host's settings are the lobby's settings. The host uses their own, so clicks show at once. */
  const settings: LobbySettings = (isHost ? me.settings : players[0]?.settings) ?? me.settings ?? defaultSettings()

  // Two players never share a team name: the one who joined later picks another.
  useEffect(() => {
    if (opponent && opponent.name === me.name && opponent.joinedAt <= me.joinedAt) {
      updateMe({ name: randomTeamName(Math.random, opponent.name) })
    }
  }, [opponent, me.name, me.joinedAt, updateMe])

  // The host's referee loop.
  useEffect(() => {
    if (!isHost) return
    const tick = () => {
      const lobby = playersRef.current
      const current = roundRef.current
      const [host, guest] = lobby
      if (host && guest && lobby.every(({ ready, playing }) => ready && !playing)) {
        // Both stay "ready" until the start message reaches them, so start only once.
        if (!starting.current) {
          starting.current = true
          const lobbySettings = meRef.current.settings ?? defaultSettings()
          send({
            type: 'startDraft',
            round: crypto.randomUUID().slice(0, 8),
            seconds: lobbySettings.mode === 'lanes' ? 0 : DRAFT_SECONDS,
            players: [host, guest].map(({ id, name }) => ({ id, name })),
            settings: lobbySettings,
          })
        }
        return
      }
      starting.current = false
      // A finished game needs no referee (a player leaving afterwards is no surrender).
      if (!current || finishedRounds.current.has(current.id)) return
      const now = Date.now()
      const online = lobby.map(({ id }) => id)
      for (const { id } of current.players) {
        if (online.includes(id)) goneSince.current.delete(id)
        else if (!goneSince.current.has(id)) goneSince.current.set(id, now)
      }
      const messages = hostMessages(current, {
        now,
        online,
        goneSince: Object.fromEntries(goneSince.current),
        random: Math.random,
        randomTeam: () =>
          current.settings.mode === 'lanes' ? laneTeam(gameData.champions, Math.random) : randomEncodedTeam(gameData, Math.random),
      })
      for (const message of messages) {
        const key = messageKey(message)
        if (sent.current.has(key)) continue
        sent.current.add(key)
        send(message)
      }
    }
    const id = window.setInterval(tick, HOST_TICK_MS)
    return () => window.clearInterval(id)
  }, [isHost, send])

  const setReady = useCallback((ready: boolean) => updateMe({ ready }), [updateMe])

  /** The host changes the lobby settings; both players see them. */
  const changeSettings = useCallback((next: LobbySettings) => updateMe({ settings: next }), [updateMe])

  const sendEmote = useCallback(
    (emote: Emote) => {
      const now = Date.now()
      if (now - lastEmote.current < EMOTE_COOLDOWN_MS) return
      lastEmote.current = now
      send({ type: 'emote', player: meRef.current.id, emote })
    },
    [send],
  )

  /** The game is over for this player: counts the win once and frees them for a rematch. */
  const finishRound = useCallback(
    (roundId: string, winner: PlayerId) => {
      if (finishedRounds.current.has(roundId)) return
      finishedRounds.current.add(roundId)
      setWins((current) => ({ ...current, [winner]: (current[winner] ?? 0) + 1 }))
      updateMe({ playing: false, ready: false })
    },
    [updateMe],
  )

  /** Back to the lobby screen, e.g. after the opponent left. */
  const leaveRound = useCallback(() => {
    const current = roundRef.current
    if (current) finishedRounds.current.add(current.id)
    setRound(null)
    updateMe({ playing: false, ready: false })
  }, [updateMe])

  return {
    status,
    me,
    players,
    opponent,
    isPlayer,
    isHost,
    settings,
    round,
    emotes,
    wins,
    send,
    setReady,
    changeSettings,
    sendEmote,
    finishRound,
    leaveRound,
  }
}

export type Room = ReturnType<typeof useRoom>
