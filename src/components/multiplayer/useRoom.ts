import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gameData } from '../../data'
import { lobbyPlayers, type Emote, type PlayerId, type PresenceInfo, type RoomMessage } from '../../game/multiplayer/protocol'
import { hostMessages, roundReducer, TIMINGS, type RoundState } from '../../game/multiplayer/session'
import { randomEncodedTeam } from '../../game/multiplayer/teamCode'
import { randomTeamName } from '../../game/multiplayer/teamNames'
import { joinRoom, type ConnectionStatus, type RoomConnection } from '../../services/realtime'

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

/** Remembers which host messages were sent, so a slow echo never makes the host send one twice. */
const messageKey = (message: RoomMessage) =>
  `${message.type}:${'round' in message ? message.round : ''}:${'event' in message ? message.event : ''}`

/**
 * One multiplayer lobby: the connection, who is in it, the current game (built from the messages)
 * and the series score. When this player is the host (the first to join), it also sends the
 * messages that move the game along. If the host leaves, the other player takes over.
 */
export function useRoom(code: string) {
  const [me, setMe] = useState<PresenceInfo>(() => ({
    id: crypto.randomUUID(),
    name: randomTeamName(),
    joinedAt: Date.now(),
    ready: false,
    playing: false,
  }))
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [present, setPresent] = useState<PresenceInfo[]>([])
  const [round, setRound] = useState<RoundState | null>(null)
  const [emotes, setEmotes] = useState<FlyingEmote[]>([])
  const [wins, setWins] = useState<Partial<Record<PlayerId, number>>>({})

  const connection = useRef<RoomConnection | null>(null)
  const meRef = useRef(me)
  const roundRef = useRef(round)
  const presentRef = useRef(present)
  const sent = useRef(new Set<string>())
  const starting = useRef(false)
  const finishedRounds = useRef(new Set<string>())
  const lastEmote = useRef(0)
  const emoteKey = useRef(0)

  useEffect(() => {
    roundRef.current = round
    presentRef.current = present
  }, [round, present])

  const updateMe = useCallback((patch: Partial<PresenceInfo>) => {
    const next = { ...meRef.current, ...patch }
    meRef.current = next
    setMe(next)
    connection.current?.updatePresence(next)
  }, [])

  const send = useCallback((message: RoomMessage) => connection.current?.send(message), [])

  useEffect(() => {
    const onMessage = (message: RoomMessage) => {
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
    const room = joinRoom(code, meRef.current, { onMessage, onPresence: setPresent, onStatus: setStatus })
    connection.current = room
    return () => {
      room?.leave()
      connection.current = null
    }
  }, [code, updateMe])

  const players = useMemo(() => lobbyPlayers(present), [present])
  const opponent = players.find(({ id }) => id !== me.id) ?? null
  const isPlayer = players.some(({ id }) => id === me.id)
  const isHost = players[0]?.id === me.id

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
      const lobby = lobbyPlayers(presentRef.current)
      const current = roundRef.current
      const [host, guest] = lobby
      if (host && guest && lobby.every(({ ready, playing }) => ready && !playing)) {
        // Both stay "ready" until the start message reaches them, so start only once.
        if (!starting.current) {
          starting.current = true
          send({
            type: 'startDraft',
            round: crypto.randomUUID().slice(0, 8),
            seconds: TIMINGS.draft,
            players: [host, guest].map(({ id, name }) => ({ id, name })),
          })
        }
        return
      }
      starting.current = false
      if (!current) return
      const messages = hostMessages(current, {
        now: Date.now(),
        online: lobby.map(({ id }) => id),
        random: Math.random,
        randomTeam: () => randomEncodedTeam(gameData, Math.random),
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
    setRound(null)
    updateMe({ playing: false, ready: false })
  }, [updateMe])

  return { status, me, players, opponent, isPlayer, isHost, round, emotes, wins, send, setReady, sendEmote, finishRound, leaveRound }
}

export type Room = ReturnType<typeof useRoom>
