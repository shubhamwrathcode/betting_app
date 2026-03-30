/**
 * Match row time fields — aligned with web `src/utils/matchDataNormalize.js`.
 */

export function normalizeMatchDataEventTime(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof raw === 'string') {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) return raw
    const n = Number(raw)
    if (Number.isFinite(n)) {
      const ms = n < 1e12 ? n * 1000 : n
      const dd = new Date(ms)
      return isNaN(dd.getTime()) ? raw : dd.toISOString()
    }
    return raw
  }
  return null
}

/** First usable kickoff / start field on a match row (same candidates as web). */
export function pickMatchEventTime(m: Record<string, unknown> | null | undefined): string | undefined {
  if (!m || typeof m !== 'object') return undefined
  const ev = m.event && typeof m.event === 'object' ? (m.event as Record<string, unknown>) : null
  const candidates = [
    m.eventTime,
    m.event_time,
    m.eventDate,
    m.event_date,
    m.startDate,
    m.start_date,
    m.startTime,
    m.start_time,
    m.openDate,
    m.open_date,
    m.eventOpenDate,
    m.event_open_date,
    m.scheduledStart,
    m.scheduled_start,
    m.commenceTime,
    m.commence_time,
    m.matchTime,
    m.match_time,
    m.kickOff,
    m.kick_off,
    m.kickoffTime,
    m.kickoff_time,
    m.marketStartTime,
    m.market_start_time,
    ev?.openDate,
    ev?.open_date,
    ev?.startTime,
    ev?.start_time,
    ev?.eventTime,
    ev?.scheduledStart,
  ]
  for (const v of candidates) {
    if (v == null || v === '') continue
    if (typeof v === 'number' && Number.isFinite(v)) {
      const ms = v < 1e12 ? v * 1000 : v
      const d = new Date(ms)
      if (!isNaN(d.getTime())) return d.toISOString()
    }
    if (typeof v === 'string') {
      const d = new Date(v)
      if (!isNaN(d.getTime())) return v
      const n = Number(v)
      if (Number.isFinite(n)) {
        const ms = n < 1e12 ? n * 1000 : n
        const dd = new Date(ms)
        if (!isNaN(dd.getTime())) return dd.toISOString()
      }
    }
  }
  return undefined
}
