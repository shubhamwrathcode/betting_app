/**
 * Normalizes sportsbook match payloads from REST API and Socket events.
 * Ported from web: src/utils/sportsbookMatchesPayload.js
 */

/** Extract match rows from GET /sportsbook/:sport/matches */
export function normalizeRestMatchesList(apiRes: any): any[] {
  if (!apiRes || typeof apiRes !== 'object') return []
  const d = apiRes.data
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object') {
    if (Array.isArray(d.data)) return d.data
    if (d.data && typeof d.data === 'object') {
      if (Array.isArray(d.data.data)) return d.data.data
      if (Array.isArray(d.data.matches)) return d.data.matches
      if (Array.isArray(d.data.rows)) return d.data.rows
      if (Array.isArray(d.data.items)) return d.data.items
    }
    if (Array.isArray(d.matches)) return d.matches
    if (Array.isArray(d.rows)) return d.rows
    if (Array.isArray(d.games)) return d.games
    if (Array.isArray(d.items)) return d.items
  }
  if (Array.isArray(apiRes.matches)) return apiRes.matches
  if (Array.isArray((apiRes as any).rows)) return (apiRes as any).rows
  if (Array.isArray((apiRes as any).items)) return (apiRes as any).items
  return []
}

/** Expand socket batch payload to array */
export function expandSocketBatchPayload(payload: any): any[] {
  if (payload == null) return []
  if (Array.isArray(payload)) {
    return payload.filter((x: any) => x != null && typeof x === 'object')
  }
  if (typeof payload === 'object' && Array.isArray(payload.items)) {
    return payload.items.filter((x: any) => x != null && typeof x === 'object')
  }
  if (typeof payload === 'object') return [payload]
  return []
}

/** Map one listSummary row to a legacy-shaped match object */
export function listSummaryRowToLegacyMatch(row: any): any | null {
  if (!row || typeof row !== 'object') return null
  const gameId = row.gameId != null ? String(row.gameId) : null
  if (!gameId) return null
  const name = row.name != null ? String(row.name) : ''
  const eventId = row.eventId != null ? String(row.eventId) : gameId
  return {
    gameId,
    game_id: gameId,
    eventId,
    event_id: eventId,
    eventName: name,
    event_name: name,
    name,
    inPlay: !!row.inPlay,
    in_play: !!row.inPlay,
    sport: row.sport,
    marketClosed: !!row.marketClosed,
    seriesName: row.seriesName ?? row.series_name ?? '',
    series_name: row.seriesName ?? row.series_name ?? '',
    startTime: row.startTime ?? row.start_time ?? null,
    start_time: row.startTime ?? row.start_time ?? null,
    eventTime: row.eventTime ?? row.event_time ?? row.startTime ?? row.start_time ?? null,
    event_time: row.eventTime ?? row.event_time ?? row.startTime ?? row.start_time ?? null,
    selections: row.selections,
    markets: row.markets,
    __listSummary: true,
  }
}

/** Extract rows from socket matches payload */
export function getMatchRowsFromSocketPayload(payload: any) {
  const sport = payload?.sport != null ? String(payload.sport) : null

  if (payload?.error) {
    return {
      sport,
      rows: [] as any[],
      schema: payload?.schema ?? null,
      error: true,
      message: payload?.message,
    }
  }

  if (!sport) {
    return { sport: null, rows: [] as any[], schema: null, error: false }
  }

  const listSummaryData = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.data)
      ? payload.data.data
      : Array.isArray(payload?.data?.items)
        ? payload.data.items
        : []

  if (payload?.schema === 'listSummary' && listSummaryData.length > 0) {
    return {
      sport,
      schema: 'listSummary',
      rows: listSummaryData.map(listSummaryRowToLegacyMatch).filter(Boolean),
      error: false,
    }
  }

  const raw = payload?.data ?? payload?.matches ?? payload?.rows ?? payload?.items
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.rows)
        ? raw.rows
        : Array.isArray(raw?.matches)
          ? raw.matches
          : Array.isArray(raw?.items)
            ? raw.items
            : []
  return {
    sport,
    schema: payload?.schema ?? 'legacy',
    rows: list,
    error: false,
  }
}
