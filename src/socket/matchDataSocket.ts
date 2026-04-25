/**
 * `/matchdata` namespace — same contract as web `src/socket/matchDataSocket.js`.
 * Landing uses `matchData:subscribeAll` → `matchData:update` (per-sport or `sportName: 'all'` fan-out).
 */

import { io, Socket } from 'socket.io-client'
import { API_BASE_URL } from '../api/client'

const NAMESPACE_SUFFIX = '/matchdata'
const DISCONNECT_MATCH_DATA_WHEN_IDLE = false

export const LANDING_MATCH_DATA_SPORTS = ['cricket', 'tennis', 'soccer', 'football'] as const

function getMatchDataSocketOrigin(): string {
  const raw = String(API_BASE_URL || '').trim()
  if (!raw) return 'https://gamingbackend.wrathcode.com'
  try {
    const parsed = new URL(raw)
    return parsed.origin
  } catch {
    return raw.replace(/\/api\/v\d+.*$/i, '').replace(/\/$/, '') || 'https://gamingbackend.wrathcode.com'
  }
}

type MatchDataListener = (kind: 'update' | 'error', payload: unknown) => void

const listeners = new Set<MatchDataListener>()
let socket: Socket | null = null
/** Debug: how many times the client entered the `connect` handler (each successful session). */
let matchDataConnectCount = 0
/** Debug: how many `disconnect` events from the server/engine. */
let matchDataDisconnectCount = 0
let matchDataLifecycleHooksInstalled = false
const sportRefCounts = new Map<string, number>()
const matchDetailSubRefCounts = new Map<string, number>()
const matchDetailListeners = new Set<(payload: unknown) => void>()

let landingAllActive = false

function emitMatchDetailResubscribe() {
  const s = socket
  if (!s?.connected) return
  matchDetailSubRefCounts.forEach((count, key) => {
    if (count <= 0) return
    const colon = key.indexOf(':')
    if (colon <= 0) return
    const sportName = key.slice(0, colon)
    const gameId = key.slice(colon + 1)
    if (sportName && gameId) {
      s.emit('matchData:subscribeMatch', { sportName, gameId })
    }
  })
}

function onMatchDetailSocketPayload(payload: unknown) {
  matchDetailListeners.forEach(fn => {
    try {
      fn(payload)
    } catch (e) {
      console.error('matchData:matchUpdate listener', e)
    }
  })
}

function onUpdate(payload: unknown) {
  const p = payload as Record<string, unknown> | null
  const isAllSnapshot = p?.sportName === 'all' && p?.sports && typeof p.sports === 'object'
  if (isAllSnapshot) {
    const ts = typeof p!.timestamp === 'number' ? (p!.timestamp as number) : null
    for (const [sportName, sportObj] of Object.entries(p!.sports as Record<string, any>)) {
      const matches = Array.isArray(sportObj?.matches) ? sportObj.matches : []
      listeners.forEach(fn => {
        try {
          fn('update', { sportName, timestamp: ts, matches })
        } catch (e) {
          console.error('matchData:update listener', e)
        }
      })
    }
    return
  }

  listeners.forEach(fn => {
    try {
      fn('update', payload)
    } catch (e) {
      console.error('matchData:update listener', e)
    }
  })
}

function onError(payload: unknown) {
  listeners.forEach(fn => {
    try {
      fn('error', payload)
    } catch (e) {
      console.error('matchData:error listener', e)
    }
  })
}

function onConnect() {
  if (!socket) return
  matchDataConnectCount += 1
  const eng = (socket as any).io?.engine
  const transport = typeof eng?.transport?.name === 'string' ? eng.transport.name : undefined
  console.log(`[matchDataSocket] CONNECT #${matchDataConnectCount}`, {
    socketId: socket.id,
    transport,
    ns: NAMESPACE_SUFFIX,
  })
  if (landingAllActive) {
    socket.emit('matchData:subscribeAll')
    emitMatchDetailResubscribe()
    return
  }
  for (const [sportName, count] of sportRefCounts.entries()) {
    if (count > 0) socket.emit('matchData:subscribe', { sportName })
  }
  emitMatchDetailResubscribe()
}

function installMatchDataSocketDebugHooks(s: Socket) {
  if (matchDataLifecycleHooksInstalled) return
  matchDataLifecycleHooksInstalled = true
  s.on('disconnect', (reason: string) => {
    matchDataDisconnectCount += 1
    console.log(`[matchDataSocket] DISCONNECT #${matchDataDisconnectCount}`, {
      reason,
      connectsSoFar: matchDataConnectCount,
      socketId: s.id,
      ns: NAMESPACE_SUFFIX,
    })
  })
  s.on('connect_error', (err: Error) => {
    const message = err && typeof (err as any).message === 'string' ? (err as any).message : String(err)
    console.log('[matchDataSocket] connect_error', { message, ns: NAMESPACE_SUFFIX })
  })
  const mgr = s.io
  if (mgr) {
    mgr.on('reconnect_attempt', (n: number) => {
      console.log('[matchDataSocket] reconnect_attempt', { n, ns: NAMESPACE_SUFFIX })
    })
    mgr.on('reconnect', (n: number) => {
      console.log('[matchDataSocket] after reconnect (manager)', { n, ns: NAMESPACE_SUFFIX })
    })
    mgr.on('reconnect_error', (err: Error) => {
      const message = err && typeof (err as any).message === 'string' ? (err as any).message : String(err)
      console.log('[matchDataSocket] reconnect_error', { message, ns: NAMESPACE_SUFFIX })
    })
  }
}

function attachHandlers() {
  if (!socket) return
  socket.off('connect', onConnect)
  socket.off('matchData:update', onUpdate)
  socket.off('matchData:matchUpdate', onMatchDetailSocketPayload)
  socket.off('matchData:error', onError)
  socket.on('connect', onConnect)
  socket.on('matchData:update', onUpdate)
  socket.on('matchData:matchUpdate', onMatchDetailSocketPayload)
  socket.on('matchData:error', onError)
}

function ensureSocket(): Socket {
  if (socket?.connected) return socket
  if (socket) {
    socket.connect()
    return socket
  }
  const apiBase = getMatchDataSocketOrigin()
  socket = io(`${apiBase}${NAMESPACE_SUFFIX}`, {
    path: '/socket.io',
    // Prefer WebSocket first so first matchdata usually arrives faster than long-poll → upgrade.
    transports: ['websocket', 'polling'],
    upgrade: true,
    autoConnect: true,
    reconnection: true,
    timeout: 20000,
  })
  installMatchDataSocketDebugHooks(socket)
  attachHandlers()
  return socket
}

export function subscribeMatchDataLandingAll() {
  ensureSocket()
  landingAllActive = true
  sportRefCounts.clear()
  for (const sport of LANDING_MATCH_DATA_SPORTS) {
    sportRefCounts.set(String(sport).toLowerCase(), 1)
  }
  if (socket?.connected) {
    socket.emit('matchData:subscribeAll')
  }
}

export function unsubscribeMatchDataLandingAll() {
  landingAllActive = false
  sportRefCounts.clear()
  if (socket?.connected) {
    socket.emit('matchData:unsubscribeAll')
  }
}

export function addMatchDataListener(fn: MatchDataListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Subscribe to full match odds for one event (ref-counted). Same contract as web `subscribeMatchDataDetail`.
 */
export function subscribeMatchDataDetail(sportName: string, gameId: string | number) {
  const s = String(sportName || '')
    .trim()
    .toLowerCase()
  const id = gameId != null && String(gameId).trim() !== '' ? String(gameId).trim() : ''
  if (!s || !id) return
  const key = `${s}:${id}`
  const prev = matchDetailSubRefCounts.get(key) || 0
  matchDetailSubRefCounts.set(key, prev + 1)
  ensureSocket()
  if (prev === 0 && socket?.connected) {
    socket.emit('matchData:subscribeMatch', { sportName: s, gameId: id })
  }
}

export function unsubscribeMatchDataDetail(sportName: string, gameId: string | number) {
  const s = String(sportName || '')
    .trim()
    .toLowerCase()
  const id = gameId != null && String(gameId).trim() !== '' ? String(gameId).trim() : ''
  if (!s || !id) return
  const key = `${s}:${id}`
  const prev = matchDetailSubRefCounts.get(key) || 0
  const next = Math.max(0, prev - 1)
  if (next === 0) {
    matchDetailSubRefCounts.delete(key)
    if (socket?.connected) {
      socket.emit('matchData:unsubscribeMatch', { sportName: s, gameId: id })
    }
  } else {
    matchDetailSubRefCounts.set(key, next)
  }
}

export function addMatchDataDetailListener(fn: (payload: unknown) => void): () => void {
  matchDetailListeners.add(fn)
  return () => matchDetailListeners.delete(fn)
}

export function removeMatchDataDetailListener(fn: (payload: unknown) => void): void {
  matchDetailListeners.delete(fn)
}

export function normalizeMatchDataUpdatePayload(payload: unknown): {
  sportName: string | null
  timestamp: number | null
  matches: any[]
} {
  if (!payload || typeof payload !== 'object') {
    return { sportName: null, timestamp: null, matches: [] }
  }
  const p = payload as Record<string, unknown>
  if (p.sportName === 'all') {
    return { sportName: 'all', timestamp: null, matches: [] }
  }
  const sportRaw = p.sportName != null ? String(p.sportName) : null
  const sportName = sportRaw ? sportRaw.toLowerCase() : null
  const matches = Array.isArray(p.matches) ? p.matches : []
  const timestamp =
    typeof p.timestamp === 'number'
      ? p.timestamp
      : p.timestamp != null
        ? Number(p.timestamp)
        : null
  return { sportName, timestamp: Number.isFinite(timestamp) ? timestamp : null, matches }
}
