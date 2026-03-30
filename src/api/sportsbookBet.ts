import { API_BASE_URL, buildJsonRequestHeaders } from './client'
import { API_ENDPOINTS } from './endpoints'

export type SportsbookPlaceBetBody = {
  sport: string
  gameId: string
  eventName: string
  seriesName?: string
  eventTime?: string
  marketType: 'match_odds' | 'bookmaker' | 'fancy'
  marketId: string
  marketName?: string
  selectionId: string
  selectionName: string
  betType: 'back' | 'lay'
  odds: number
  stake: number
  isLive?: boolean
  requestId?: string
  priceVersion?: string | number
}

export type PlaceBetApiResponse = {
  success?: boolean
  message?: string
  data?: unknown
  balanceAfter?: number
  [k: string]: unknown
}

/** Same shape as web `AuthService.sportsbookEventConfig`. Public GET. */
export async function fetchSportsbookEventConfig(eventId: string): Promise<Record<string, unknown> | null> {
  const id = eventId != null && eventId !== '' ? String(eventId) : ''
  if (!id) return null
  const url = `${API_BASE_URL}${API_ENDPOINTS.sportsbookEventConfig}?eventId=${encodeURIComponent(id)}`
  const headers = await buildJsonRequestHeaders({ skipAuth: true })
  try {
    const res = await fetch(url, { method: 'GET', headers })
    const text = await res.text()
    let raw: unknown = {}
    try {
      raw = text ? JSON.parse(text) : {}
    } catch {
      raw = {}
    }
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const response = (obj.response ?? obj.data ?? obj) as Record<string, unknown>
    return response && typeof response === 'object' ? response : null
  } catch {
    return null
  }
}

/**
 * POST place-bet — returns parsed JSON even on non-2xx (for `unwrapPlaceBetResponse`).
 */
export async function postSportsbookPlaceBet(body: SportsbookPlaceBetBody): Promise<PlaceBetApiResponse> {
  const url = `${API_BASE_URL}${API_ENDPOINTS.sportsbookPlaceBet}`
  const headers = await buildJsonRequestHeaders()
  if (!headers.Authorization) {
    return { success: false, message: 'Login required' }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data: PlaceBetApiResponse = {}
  try {
    data = text ? (JSON.parse(text) as PlaceBetApiResponse) : {}
  } catch {
    data = { message: text || `HTTP ${res.status}` }
  }
  if (!res.ok && data.success !== false) {
    data.success = false
    if (!data.message) {
      data.message =
        (typeof data.error === 'string' ? data.error : null) ||
        (typeof (data as { msg?: string }).msg === 'string' ? (data as { msg: string }).msg : null) ||
        `Request failed (${res.status})`
    }
  }
  return data
}

/** Port of web `unwrapPlaceBetResponse`. */
export function unwrapPlaceBetResponse(res: PlaceBetApiResponse | null | undefined): {
  ok: boolean
  bet: unknown
  message: string
  balanceAfter: number | null
} {
  if (!res || typeof res !== 'object') {
    return { ok: false, bet: null, message: '', balanceAfter: null }
  }
  const msg = String(res.message || '')
  if (res.success === false) {
    return { ok: false, bet: null, message: msg || 'Request failed', balanceAfter: null }
  }
  if (msg.toLowerCase().includes('fail')) {
    return { ok: false, bet: null, message: msg, balanceAfter: null }
  }
  const wrap = res.data
  const inner = wrap && typeof wrap === 'object' ? (wrap as Record<string, unknown>) : {}
  const bet =
    inner.data ??
    inner.bet ??
    (inner._id || inner.gameId ? inner : null)
  const balanceAfterRaw =
    (bet as { balanceAfter?: unknown } | null)?.balanceAfter ??
    inner.balanceAfter ??
    res.balanceAfter
  const balanceAfter =
    balanceAfterRaw != null && balanceAfterRaw !== '' ? Number(balanceAfterRaw) : null
  return {
    ok: true,
    bet,
    message: msg || String(inner.message || ''),
    balanceAfter: Number.isFinite(balanceAfter) ? balanceAfter : null,
  }
}

export function marketNameForPlaceBet(p: {
  marketName?: string
  marketType?: string
}): string {
  if (p?.marketName != null && String(p.marketName).trim() !== '') return String(p.marketName).trim()
  const t = String(p?.marketType || '').toLowerCase()
  if (t === 'match_odds') return 'Match Odds'
  if (t === 'bookmaker') return 'Bookmaker'
  if (t === 'fancy') return 'Fancy'
  return t ? t.replace(/_/g, ' ') : 'Market'
}
