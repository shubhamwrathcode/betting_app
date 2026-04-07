/**
 * Sports match display in India (IST).
 * Many feeds send ISO like `2026-04-01T19:30:00.000Z` where the clock is **IST** but `Z` wrongly marks UTC.
 * That parses as next calendar day ~01:00 IST — fix by reading those as `+05:30` wall time.
 * True Unix epoch numbers are left unchanged.
 */

export const MATCH_DISPLAY_TIMEZONE = 'Asia/Kolkata'

const TZ: Intl.DateTimeFormatOptions = { timeZone: MATCH_DISPLAY_TIMEZONE }

function toDisplayDate(input: unknown): Date | null {
  if (input == null || input === '') return null
  if (typeof input === 'number' && Number.isFinite(input)) {
    const d = new Date(input)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof input === 'string') {
    const d = new Date(input)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * If string is `...T..:..:..(.sss)?Z` or `...+00:00`, treat T-hms as **IST** and return epoch ms.
 * Otherwise null (caller uses normal parse).
 */
function parseUtcMarkedAsIstWallClockMs(s: string): number | null {
  const str = String(s).trim()
  const m = str.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?(Z|[+-]00:?00)$/i,
  )
  if (!m) return null
  const [, y, mo, d, h, mi, sec, frac] = m
  const secPart = sec != null ? sec : '00'
  const fracPart = frac != null ? `.${frac}` : ''
  const withIst = `${y}-${mo}-${d}T${h}:${mi}:${secPart}${fracPart}+05:30`
  const out = new Date(withIst)
  return isNaN(out.getTime()) ? null : out.getTime()
}

/**
 * @param raw — socket/API eventTime (string | number | …)
 * @returns epoch ms for display/sort, or null
 */
export function resolveEventTimeForIndiaDisplay(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw < 1e12 ? raw * 1000 : raw
  }
  if (typeof raw === 'string') {
    const fixed = parseUtcMarkedAsIstWallClockMs(raw)
    if (fixed != null) return fixed
  }
  const d = toDisplayDate(raw)
  if (d == null) return null
  return isNaN(d.getTime()) ? null : d.getTime()
}

/** YYYY-MM-DD calendar date in IST (for grouping / sort). */
export function ymdKeyIST(dateOrMs: unknown): string {
  const d = toDisplayDate(dateOrMs)
  if (!d) return ''
  return d.toLocaleDateString('en-CA', TZ)
}

function addOneCalendarDayYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  const mdays = [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  mdays[1] = isLeap ? 29 : 28
  let dd = d + 1
  let mm = m
  let yy = y
  if (dd > mdays[mm - 1]) {
    dd = 1
    mm += 1
    if (mm > 12) {
      mm = 1
      yy += 1
    }
  }
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/** e.g. 7:30 pm (IST) */
export function formatTimeOnlyIST(isoStrOrMs: unknown): string {
  const d = toDisplayDate(isoStrOrMs)
  if (!d) return ''
  return d.toLocaleTimeString('en-IN', { ...TZ, hour: '2-digit', minute: '2-digit', hour12: true })
}

/** e.g. "Today 7:30 pm" / "1 Apr 7:30 pm" in IST */
export function formatMatchDateTimeLabelIST(isoStrOrMs: unknown): string {
  const d = toDisplayDate(isoStrOrMs)
  if (!d) return typeof isoStrOrMs === 'string' ? isoStrOrMs : ''
  const dKey = ymdKeyIST(d)
  const todayKey = ymdKeyIST(Date.now())
  const tomorrowKey = addOneCalendarDayYmd(todayKey)
  const dateStr =
    dKey === todayKey
      ? 'Today'
      : dKey === tomorrowKey
        ? 'Tomorrow'
        : d.toLocaleDateString('en-IN', { ...TZ, day: 'numeric', month: 'short' })
  const timeStr = formatTimeOnlyIST(d)
  return `${dateStr} ${timeStr}`.trim()
}

/** Section label: Today | Tomorrow | 1 Apr (IST) */
export function getDayGroupIST(isoStrOrMs: unknown): string {
  const d = toDisplayDate(isoStrOrMs)
  if (!d) return ''
  const dKey = ymdKeyIST(d)
  const todayKey = ymdKeyIST(Date.now())
  const tomorrowKey = addOneCalendarDayYmd(todayKey)
  if (dKey === todayKey) return 'Today'
  if (dKey === tomorrowKey) return 'Tomorrow'
  return d.toLocaleDateString('en-IN', { ...TZ, day: 'numeric', month: 'short' })
}
