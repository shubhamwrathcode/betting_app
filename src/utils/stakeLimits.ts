/**
 * Numeric min/max stake from socket/API odds or event config — mirrors web `marketMinMax.getNumericStakeLimitsFromPayload`.
 */

const MIN_KEYS = [
  'minbet',
  'minBet',
  'min_bet',
  'minimumBet',
  'minimum_bet',
  'minStake',
  'min_stake',
  'minStack',
  'min_stack',
  'stackMin',
  'stack_min',
  'stakeMin',
  'stake_min',
  'minAmount',
  'min_amount',
  'betMin',
  'bet_min',
  'min',
  'minLimit',
  'min_limit',
] as const

const MAX_KEYS = [
  'maxbet',
  'maxBet',
  'max_bet',
  'maximumBet',
  'maximum_bet',
  'maxStake',
  'max_stake',
  'maxStack',
  'max_stack',
  'stackMax',
  'stack_max',
  'stakeMax',
  'stake_max',
  'maxAmount',
  'max_amount',
  'betMax',
  'bet_max',
  'max',
  'maxLimit',
  'max_limit',
] as const

function pickLimitField(obj: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const k of keys) {
    if (!(k in obj)) continue
    const v = obj[k]
    if (v === undefined || v === null || v === '') continue
    return v
  }
  return undefined
}

function isMeaninglessMarketLimits(minRaw: unknown, maxRaw: unknown): boolean {
  const mn = minRaw === undefined || minRaw === null || minRaw === '' ? null : Number(minRaw)
  const mx = maxRaw === undefined || maxRaw === null || maxRaw === '' ? null : Number(maxRaw)
  if (mn === null && mx === null) return true
  if (mn === 0 && mx === 0) return true
  return false
}

function aggregateNumericLimitsFromOddDatas(arr: unknown): { min: number | null; max: number | null } {
  if (!Array.isArray(arr) || arr.length === 0) return { min: null, max: null }
  let minStake: number | null = null
  let maxStake: number | null = null
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const minR = pickLimitField(o, MIN_KEYS)
    const maxR = pickLimitField(o, MAX_KEYS)
    if (minR !== undefined && minR !== null && minR !== '') {
      const n = Number(minR)
      if (Number.isFinite(n) && n > 0) {
        minStake = minStake == null ? n : Math.min(minStake, n)
      }
    }
    if (maxR !== undefined && maxR !== null && maxR !== '') {
      const n = Number(maxR)
      if (Number.isFinite(n) && n > 0) {
        maxStake = maxStake == null ? n : Math.max(maxStake, n)
      }
    }
  }
  return { min: minStake, max: maxStake }
}

function getNumericStakeLimitsFromObjectOnly(obj: Record<string, unknown>): { min: number | null; max: number | null } {
  const minRaw = pickLimitField(obj, MIN_KEYS)
  const maxRaw = pickLimitField(obj, MAX_KEYS)
  let min: number | null = null
  let max: number | null = null
  if (minRaw !== undefined) {
    const n = Number(minRaw)
    if (Number.isFinite(n) && n >= 0) min = n
  }
  if (maxRaw !== undefined) {
    const n = Number(maxRaw)
    if (Number.isFinite(n) && n >= 0) max = n
  }
  const runners = obj.oddDatas ?? obj.runners ?? obj.odd_odds
  if (isMeaninglessMarketLimits(minRaw, maxRaw) && Array.isArray(runners) && runners.length) {
    const agg = aggregateNumericLimitsFromOddDatas(runners)
    if (agg.min != null) min = agg.min
    if (agg.max != null) max = agg.max
  }
  if (min === 0 && max === 0) {
    return { min: null, max: null }
  }
  return { min, max }
}

function aggregateNumericFromBookMakerOdds(arr: unknown): { min: number | null; max: number | null } {
  if (!Array.isArray(arr) || arr.length === 0) return { min: null, max: null }
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const bmKeys = Object.keys(item).filter(k => /^bm\d+$/i.test(k))
    if (bmKeys.length > 0) {
      bmKeys.sort((a, b) => {
        const na = parseInt(a.replace(/\D/g, ''), 10) || 0
        const nb = parseInt(b.replace(/\D/g, ''), 10) || 0
        return na - nb
      })
      for (const k of bmKeys) {
        const sub = (item as Record<string, unknown>)[k]
        if (sub && typeof sub === 'object') {
          const t = getNumericStakeLimitsFromObjectOnly(sub as Record<string, unknown>)
          if (t.min != null || t.max != null) return t
        }
      }
    } else {
      const t = getNumericStakeLimitsFromObjectOnly(item as Record<string, unknown>)
      if (t.min != null || t.max != null) return t
    }
  }
  return { min: null, max: null }
}

export function getNumericStakeLimitsFromPayload(obj: unknown): { min: number | null; max: number | null } {
  if (!obj || typeof obj !== 'object') {
    return { min: null, max: null }
  }
  const o = obj as Record<string, unknown>
  let { min, max } = getNumericStakeLimitsFromObjectOnly(o)
  if (min != null || max != null) {
    if (min === 0 && max === 0) {
      min = null
      max = null
    }
    if (min != null || max != null) return { min, max }
  }
  const mo = o.matchOdds ?? o.match_odds
  if (Array.isArray(mo)) {
    for (const m of mo) {
      if (!m || typeof m !== 'object') continue
      const t = getNumericStakeLimitsFromObjectOnly(m as Record<string, unknown>)
      if (t.min != null || t.max != null) {
        if (t.min === 0 && t.max === 0) continue
        return t
      }
    }
  }
  const bm = o.bookMakerOdds ?? o.book_maker_odds
  const fromBm = aggregateNumericFromBookMakerOdds(bm)
  if (fromBm.min != null || fromBm.max != null) return fromBm
  const fo = o.fancyOdds ?? o.fancy_odds
  if (Array.isArray(fo)) {
    for (const m of fo) {
      if (!m || typeof m !== 'object') continue
      const t = getNumericStakeLimitsFromObjectOnly(m as Record<string, unknown>)
      if (t.min != null || t.max != null) {
        if (t.min === 0 && t.max === 0) continue
        return t
      }
    }
  }
  return { min: null, max: null }
}
