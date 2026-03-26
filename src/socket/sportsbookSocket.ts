/**
 * Sportsbook Socket — singleton manager for React Native (Socket.IO).
 * Ported from web: src/socket/sportsbookSocket.js
 *
 * - Single connection per app; auth change forces reconnect.
 * - Reference-counted subscriptions for matches.
 * - Re-subscribes on connect/reconnect.
 * - Adapted for React Native (no window/document references).
 */

import { Socket, Manager } from 'socket.io-client'
import { API_BASE_URL } from '../api/client'

const getSportsbookBaseUrl = () => {
  const fallback = 'https://gamingbackend.wrathcode.com'
  const raw = (API_BASE_URL || fallback).trim()
  if (!raw) return fallback
  try {
    const parsed = new URL(raw)
    return parsed.origin
  } catch {
    return raw.replace(/\/api\/v\d+.*$/i, '').replace(/\/$/, '') || fallback
  }
}

const SOCKET_OPTIONS = {
  path: '/socket.io',
  transports: ['polling', 'websocket'] as string[], // Handshake usually needs polling
  upgrade: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  timeout: 20000,
  randomizationFactor: 0.5,
  autoConnect: true,
}

let socket: Socket | null = null
let manager: Manager | null = null
let activeNamespacePath: '/sportsbook' | '/' = '/sportsbook'
let triedRootNamespaceFallback = false
let lastAuthToken: string | null = null
let namespaceConnectTimer: ReturnType<typeof setTimeout> | null = null

/** sport -> refcount */
const matchRefCounts = new Map<string, number>()

const matchesListeners = new Set<(payload: any) => void>()
const errorListeners = new Set<(err: any) => void>()

/** Sports we already sent subscribe:matches for on this TCP connection. */
const matchSubSentToServer = new Set<string>()

// --- Payload signature for dedup ---
const lastMatchesSig = new Map<string, string>()

function payloadSignature(payload: any, dataKey = 'data'): string {
  const ts = payload?.timestamp
  if (ts != null && ts !== '') return `t:${ts}`
  const d = payload?.[dataKey] ?? payload
  try {
    return `j:${JSON.stringify(d)}`
  } catch {
    return `s:${String(d)}`
  }
}

/** Backend may send one object, { items: [...] }, or a top-level array */
function asMatchesPayloadArray(payload: any): any[] {
  if (payload == null) return []
  if (Array.isArray(payload)) return payload.filter(Boolean)
  if (typeof payload === 'object' && Array.isArray(payload.items)) return payload.items.filter(Boolean)
  return [payload]
}

/** subscribe:matches — array of { sport } */
function emitSubscribeMatchesToServer(sports: string[]) {
  if (!socket?.connected || !sports?.length) return
  const pending = sports.filter((s) => !matchSubSentToServer.has(s))
  if (pending.length === 0) return
  console.log('[Socket] Emitting subscribe:matches for', pending)
  const batchPayload = pending.map((s) => ({ sport: s }))
  socket.emit('subscribe:matches', batchPayload)
  // Root namespace on some backends still expects legacy one-by-one object payload.
  if (activeNamespacePath === '/') {
    pending.forEach((sport) => {
      socket?.emit('subscribe:matches', { sport })
    })
  }
  pending.forEach((s) => matchSubSentToServer.add(s))
}

function emitUnsubscribeMatchesToServer(sports: string[]) {
  if (!socket?.connected || !sports?.length) return
  const batchPayload = sports.map((s) => ({ sport: s }))
  socket.emit('unsubscribe:matches', batchPayload)
  if (activeNamespacePath === '/') {
    sports.forEach((sport) => {
      socket?.emit('unsubscribe:matches', { sport })
    })
  }
}

export function reemitSubscriptions() {
  if (!socket?.connected) return
  const activeMatchSports: string[] = []
  matchRefCounts.forEach((count, sport) => {
    if (count > 0) activeMatchSports.push(sport)
  })
  emitSubscribeMatchesToServer(activeMatchSports)
}

function clearNamespaceConnectTimer() {
  if (namespaceConnectTimer) {
    clearTimeout(namespaceConnectTimer)
    namespaceConnectTimer = null
  }
}

function tryRootNamespaceFallback(reason: string) {
  if (activeNamespacePath !== '/sportsbook' || triedRootNamespaceFallback) return
  triedRootNamespaceFallback = true
  activeNamespacePath = '/'
  clearNamespaceConnectTimer()
  try {
    socket?.disconnect()
    socket?.removeAllListeners()
  } catch {}
  socket = null
  console.log(`[Socket] /sportsbook failed (${reason}); falling back to root namespace "/"`)
  connectSportsbookSocket(lastAuthToken)
}

function ensureHandlers() {
  if (!socket) return

  socket.off('matches')
  socket.off('connect')
  socket.off('disconnect')
  socket.off('connect_error')
  socket.off('reconnect')
  socket.off('error')
  socket.offAny()

  socket.onAny((eventName: string, ...args: any[]) => {
    if (eventName === 'ping' || eventName === 'pong') return
    console.log(`[Socket] onAny event: ${eventName}`, args?.[0])
  })

  socket.on('error', (err: any) => {
    console.warn('Sportsbook socket error:', err)
    errorListeners.forEach((fn) => {
      try { fn(err) } catch (e) { console.error('sportsbookSocket error listener error:', e) }
    })
  })

  socket.on('matches', (rawPayload: any) => {
    console.log('[Socket] matches raw payload:', rawPayload)
    const list = asMatchesPayloadArray(rawPayload)
    console.log('[Socket] matches normalized items count:', list.length)
    for (const p of list) {
      const sport = p?.sport
      if (!sport) continue
      console.log(`[Socket] matches item for sport=${sport}:`, p)
      const sig = payloadSignature(p, 'data')
      if (lastMatchesSig.get(sport) === sig) continue
      lastMatchesSig.set(sport, sig)
      matchesListeners.forEach((fn) => {
        try { fn(p) } catch (e) { console.error('sportsbookSocket matches listener error:', e) }
      })
    }
  })

  socket.on('connect', () => {
    clearNamespaceConnectTimer()
    console.log('Sportsbook socket connected')
    reemitSubscriptions()
  })

  socket.on('disconnect', (reason: string) => {
    clearNamespaceConnectTimer()
    console.log('Sportsbook socket disconnected:', reason)
    matchSubSentToServer.clear()
  })

  socket.on('connect_error', (err: any) => {
    console.warn('Sportsbook socket connect_error:', err?.message)
    const msg = String(err?.message || '').toLowerCase()
    if (
      msg.includes('invalid namespace') &&
      activeNamespacePath === '/sportsbook' &&
      !triedRootNamespaceFallback
    ) {
      tryRootNamespaceFallback('invalid namespace')
      return
    }
    errorListeners.forEach((fn) => {
      try { fn(err) } catch (e) { console.error('sportsbookSocket error listener error:', e) }
    })
  })

  socket.on('reconnect' as any, () => {
    console.log('Sportsbook socket reconnected')
    reemitSubscriptions()
  })
}

export function connectSportsbookSocket(token?: string | null) {
  const baseUrl = getSportsbookBaseUrl().replace(/\/$/, '')
  lastAuthToken = token ?? null
  const authPayload: Record<string, string> = token
    ? { token: token.startsWith('Bearer ') ? token : `Bearer ${token}` }
    : {}

  if (!manager) {
    manager = new Manager(baseUrl, SOCKET_OPTIONS)
  }

  if (socket?.connected) {
    const hadToken = !!(socket as any).auth?.token
    const hasToken = !!authPayload.token
    if (hadToken === hasToken) {
      if (hasToken) (socket as any).auth = authPayload
      return socket
    }
    socket.disconnect()
    socket.removeAllListeners()
    socket = null
  }

  if (!socket) {
    console.log('[Socket] base URL:', baseUrl)
    console.log('[Socket] namespace path:', activeNamespacePath)
    console.log('[Socket] full namespace URL:', `${baseUrl}${activeNamespacePath}`)
    console.log(`Sportsbook socket: connecting to ${activeNamespacePath} namespace`)
    socket = manager.socket(activeNamespacePath, {
      auth: authPayload,
    })
    ensureHandlers()
    if (activeNamespacePath === '/sportsbook') {
      clearNamespaceConnectTimer()
      namespaceConnectTimer = setTimeout(() => {
        if (!socket?.connected && activeNamespacePath === '/sportsbook') {
          tryRootNamespaceFallback('connect timeout')
        }
      }, 4000)
    }
  } else {
    (socket as any).auth = authPayload
    socket.connect()
  }

  return socket
}

export function disconnectSportsbookSocket() {
  if (socket) {
    socket.disconnect()
    socket.removeAllListeners()
    socket = null
  }
  clearNamespaceConnectTimer()
  manager = null
  activeNamespacePath = '/sportsbook'
  triedRootNamespaceFallback = false
  matchRefCounts.clear()
  lastMatchesSig.clear()
  matchSubSentToServer.clear()
  matchesListeners.clear()
  errorListeners.clear()
}

export function getSportsbookSocket() {
  return socket
}

/** Subscribe to several sports */
export function subscribeMatchesMany(sports: string[]) {
  if (!Array.isArray(sports) || !sports.length) return
  const uniq = [...new Set(sports.map(String).filter(Boolean))]
  const firstActivated: string[] = []
  for (const s of uniq) {
    const prev = matchRefCounts.get(s) || 0
    matchRefCounts.set(s, prev + 1)
    if (prev === 0) firstActivated.push(s)
  }
  emitSubscribeMatchesToServer(firstActivated)
}

export function subscribeMatches(sport: string) {
  if (!sport) return
  subscribeMatchesMany([sport])
}

export function unsubscribeMatchesMany(sports: string[]) {
  if (!Array.isArray(sports) || !sports.length) return
  const uniq = [...new Set(sports.map(String).filter(Boolean))]
  const removedFromServer: string[] = []
  for (const s of uniq) {
    const prev = matchRefCounts.get(s) || 0
    if (prev <= 0) continue
    const next = prev - 1
    if (next <= 0) {
      matchRefCounts.delete(s)
      lastMatchesSig.delete(s)
      if (socket?.connected && matchSubSentToServer.has(s)) {
        removedFromServer.push(s)
        matchSubSentToServer.delete(s)
      }
    } else {
      matchRefCounts.set(s, next)
    }
  }
  emitUnsubscribeMatchesToServer(removedFromServer)
}

export function unsubscribeMatches(sport: string) {
  if (!sport) return
  unsubscribeMatchesMany([sport])
}

export function addMatchesListener(fn: (payload: any) => void) {
  if (typeof fn === 'function') matchesListeners.add(fn)
}

export function removeMatchesListener(fn: (payload: any) => void) {
  matchesListeners.delete(fn)
}

export function addErrorListener(fn: (err: any) => void) {
  if (typeof fn === 'function') errorListeners.add(fn)
}

export function removeErrorListener(fn: (err: any) => void) {
  errorListeners.delete(fn)
}
