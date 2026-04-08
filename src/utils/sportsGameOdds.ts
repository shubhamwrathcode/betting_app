/**
 * 1×2 back/lay strip — ported from web `src/utils/sportsGameOdds.js`.
 */

function toOddDatasArray(oddDatas: unknown): any[] {
  if (!oddDatas) return []
  if (Array.isArray(oddDatas)) return oddDatas
  if (typeof oddDatas === 'object') return Object.values(oddDatas as object).filter(Boolean)
  return []
}

function runnerLabel(x: any): string {
  if (!x || typeof x !== 'object') return ''
  return String(x.rname ?? x.selectionName ?? x.name ?? x.runnerName ?? x.selectionId ?? '').trim()
}

function normName(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
}

function parseTeamsFromTitle(eventName: string): { left: string; right: string } | null {
  if (!eventName || typeof eventName !== 'string') return null
  const m = eventName.match(/^(.+?)\s+(?:vs|v)\s+(.+)$/i)
  if (!m) return null
  const left = m[1].trim()
  const right = m[2].trim()
  if (!left || !right) return null
  return { left, right }
}

function teamMatchesRname(rname: string, teamFromTitle: string): boolean {
  const a = normName(rname)
  const b = normName(teamFromTitle)
  if (a === b) return true
  if (a.length >= 2 && b.length >= 2) return a.includes(b) || b.includes(a)
  return false
}

function isDrawName(name: string): boolean {
  const n = String(name || '').toLowerCase()
  if (!n) return false
  if (n === 'draw' || n === 'tie' || n === 'the draw' || n === 'x') return true
  return n.includes('draw') && !n.includes('withdraw') && !n.includes('w/d')
}

function orderRunnersByEventTitle(runners: any[], eventName: string): [any, any, any] | null {
  const vs = parseTeamsFromTitle(eventName)
  if (!vs || !Array.isArray(runners) || runners.length === 0) return null
  const { left, right } = vs
  const draws: any[] = []
  const others: any[] = []
  for (const r of runners) {
    const rn = runnerLabel(r)
    if (isDrawName(rn)) draws.push(r)
    else others.push(r)
  }
  const draw = draws[0] ?? null
  let home: any = null
  let away: any = null
  for (const r of others) {
    const rn = runnerLabel(r)
    if (!home && teamMatchesRname(rn, left)) home = r
    else if (!away && teamMatchesRname(rn, right)) away = r
  }
  const used = new Set([home, away, draw].filter(Boolean))
  for (const r of others) {
    if (used.has(r)) continue
    if (!home) home = r
    else if (!away) away = r
  }
  return [home, draw, away]
}

function label1x2(x: any): string {
  return runnerLabel(x)
}

function orderFor1x2(list: any[], getLabel: (x: any) => string): [any, any, any] {
  const items = Array.isArray(list) ? list.filter(Boolean) : []
  if (items.length === 0) return [null, null, null]
  if (items.length === 1) return [items[0], null, null]
  const drawIdx = items.findIndex(x => isDrawName(getLabel(x)))
  if (items.length === 2) {
    if (drawIdx === 0) return [null, items[0], items[1]]
    if (drawIdx === 1) return [items[0], items[1], null]
    return [items[0], null, items[1]]
  }
  if (drawIdx >= 0) {
    const rest = items.filter((_, i) => i !== drawIdx)
    return [rest[0] ?? null, items[drawIdx], rest[1] ?? null]
  }
  return [items[0], items[1] ?? null, items[2] ?? null]
}

function emptyCell() {
  return { price: null as string | number | null, sizeFormatted: '—' }
}

function emptyPair() {
  return { back: emptyCell(), lay: emptyCell() }
}

function formatSize(size: unknown): string {
  if (size == null || size === '') return '0.00'
  const n = Number(size)
  if (!Number.isFinite(n)) return String(size)
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 2)}K`
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

const BACK_KEYS = ['b1', 'b2', 'b3'] as const
const BACK_SIZE_KEYS = ['bs1', 'bs2', 'bs3'] as const
const LAY_KEYS = ['l1', 'l2', 'l3'] as const
const LAY_SIZE_KEYS = ['ls1', 'ls2', 'ls3'] as const

function numPrice(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = parseFloat(String(v).trim())
  return Number.isFinite(n) ? n : null
}

function pairFromRunnerRow(runner: any, isOddsValid: (v: unknown) => boolean) {
  if (!runner || typeof runner !== 'object') return emptyPair()

  let bestBackRaw: string | number | null = null
  let bestBackNum: number | null = null
  let bestBackSize: unknown = null
  for (let i = 0; i < 3; i++) {
    const raw = runner[BACK_KEYS[i]]
    if (raw == null || !isOddsValid(raw)) continue
    const n = numPrice(raw)
    if (n == null) continue
    if (bestBackNum == null || n > bestBackNum) {
      bestBackNum = n
      bestBackRaw = raw
      bestBackSize = runner[BACK_SIZE_KEYS[i]]
    }
  }
  let bestLayRaw: string | number | null = null
  let bestLayNum: number | null = null
  let bestLaySize: unknown = null
  for (let i = 0; i < 3; i++) {
    const raw = runner[LAY_KEYS[i]]
    if (raw == null || !isOddsValid(raw)) continue
    const n = numPrice(raw)
    if (n == null) continue
    if (bestLayNum == null || n < bestLayNum) {
      bestLayNum = n
      bestLayRaw = raw
      bestLaySize = runner[LAY_SIZE_KEYS[i]]
    }
  }
  if (bestBackRaw == null && runner.back != null && isOddsValid(runner.back)) {
    bestBackRaw = runner.back
    bestBackSize = runner.bs1 ?? runner.size
  }
  if (bestLayRaw == null && runner.lay != null && isOddsValid(runner.lay)) {
    bestLayRaw = runner.lay
    bestLaySize = runner.ls1 ?? runner.size
  }

  return {
    back: {
      price: bestBackRaw,
      sizeFormatted: bestBackRaw != null ? formatSize(bestBackSize) : '—',
    },
    lay: {
      price: bestLayRaw,
      sizeFormatted: bestLayRaw != null ? formatSize(bestLaySize) : '—',
    },
  }
}

function pairFromSelection(sel: any, isOddsValid: (v: unknown) => boolean) {
  if (!sel || typeof sel !== 'object') return emptyPair()
  const br = Array.isArray(sel.back) ? sel.back[0] : null
  const lr = Array.isArray(sel.lay) ? sel.lay[0] : null
  if (br || lr) {
    const bp = br && br.open !== false && br.price != null && isOddsValid(br.price) ? br.price : null
    const lp = lr && lr.open !== false && lr.price != null && isOddsValid(lr.price) ? lr.price : null
    return {
      back: { price: bp, sizeFormatted: bp != null ? formatSize(br?.stack) : '—' },
      lay: { price: lp, sizeFormatted: lp != null ? formatSize(lr?.stack) : '—' },
    }
  }
  return pairFromRunnerRow(sel, isOddsValid)
}

export function computeTop1x2Cells(
  match: any,
  odds: { matchOdds?: any[]; match_odds?: any[] } | null,
  isOddsValid: (v: unknown) => boolean,
) {
  const eventTitle = match?.eventName ?? match?.teams ?? match?.name ?? ''
  const mo =
    (odds && Array.isArray(odds.matchOdds) && odds.matchOdds) ||
    (odds && Array.isArray(odds.match_odds) && odds.match_odds) ||
    (match && Array.isArray(match.matchOdds) && match.matchOdds) ||
    null
  if (mo?.length) {
    const market = mo[0]
    const runners =
      Array.isArray(market.runners) && market.runners.length ? market.runners : toOddDatasArray(market.oddDatas)
    if (runners.length) {
      const byTitle = orderRunnersByEventTitle(runners, eventTitle)
      const ordered = byTitle ?? orderFor1x2(runners, label1x2)
      return ordered.map(node => (node ? pairFromRunnerRow(node, isOddsValid) : emptyPair()))
    }
  }
  const selections = Array.isArray(match?.selections) ? match.selections : []
  if (selections.length) {
    const ordered = orderFor1x2(selections, label1x2)
    return ordered.map(node => (node ? pairFromSelection(node, isOddsValid) : emptyPair()))
  }
  return [emptyPair(), emptyPair(), emptyPair()]
}

/** Display formatting for ladder sizes — same as web `formatOddsSize`. */
export function formatOddsSizeDisplay(size: unknown): string {
  if (size == null || size === '') return '0.00'
  const n = Number(size)
  if (!Number.isFinite(n)) return String(size)
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 2)}K`
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

function isInvalidLandingOdds(val: unknown): boolean {
  if (val == null || val === '') return true
  const n = parseFloat(String(val).trim())
  return Number.isNaN(n) || n <= 0
}

/** Exported for landing / sports grids (valid price > 0). */
export function landingOddsValid(val: unknown): boolean {
  return !isInvalidLandingOdds(val)
}

/** One column: back + lay strings and sizes (web `getLandingCardOddsTriples` shape). */
export type LandingOddsPairColumn = {
  back: string
  lay: string
  backSize: string
  laySize: string
} | null

/** listSummary ladder when socket `matchOdds` not present yet — from web LandingPage. */
export function getLandingThreeColumnOddsFromMatch(match: any): LandingOddsPairColumn[] | null {
  const sels = match?.selections
  if (!Array.isArray(sels) || !sels[0]) return null
  const sel = sels[0]
  const backs = Array.isArray(sel.back) ? sel.back : []
  const lays = Array.isArray(sel.lay) ? sel.lay : []
  return [0, 1, 2].map(i => {
    const br = backs[i]
    const lr = lays[i]
    const bOk = br && br.open !== false && br.price != null && Number.isFinite(Number(br.price))
    const lOk = lr && lr.open !== false && lr.price != null && Number.isFinite(Number(lr.price))
    if (!bOk && !lOk) return null
    const sizeFormatted = formatOddsSizeDisplay(bOk ? br.stack : lOk ? lr.stack : 0)
    return {
      back: bOk ? String(br.price) : '—',
      lay: lOk ? String(lr.price) : '—',
      backSize: sizeFormatted,
      laySize: sizeFormatted,
    }
  })
}

/**
 * Same as web `getLandingCardOddsTriples` — fixed 3×1×2 slots (home / draw / away).
 */
export function getLandingCardOddsTriples(
  match: any,
  oddsPayload: { matchOdds?: any[] } | null,
): LandingOddsPairColumn[] {
  const mo =
    Array.isArray(oddsPayload?.matchOdds) && oddsPayload!.matchOdds!.length > 0
      ? oddsPayload!.matchOdds
      : match?.matchOdds
  if (Array.isArray(mo) && mo.length > 0) {
    const cells = computeTop1x2Cells(match, { matchOdds: mo }, landingOddsValid)
    return cells.map(c => {
      const hb = c.back.price != null && !isInvalidLandingOdds(c.back.price)
      const hl = c.lay.price != null && !isInvalidLandingOdds(c.lay.price)
      if (!hb && !hl) return null
      return {
        back: hb ? String(c.back.price) : '—',
        lay: hl ? String(c.lay.price) : '—',
        backSize: c.back.sizeFormatted ?? '—',
        laySize: c.lay.sizeFormatted ?? '—',
      }
    })
  }
  const legacy = getLandingThreeColumnOddsFromMatch(match)
  if (!legacy) return [null, null, null]
  return legacy.map(p =>
    p
      ? {
        back: p.back,
        lay: p.lay,
        backSize: p.backSize,
        laySize: p.laySize,
      }
      : null,
  )
}

/**
 * Landing horizontal strip: **one column per runner** (count from `matchOdds` / `oddDatas`), capped.
 * Same ordering as `computeTop1x2Cells` for ≤3 runners; otherwise uses runner list order.
 */
export function getLandingOddsStripColumns(
  match: any,
  oddsPayload: { matchOdds?: any[] } | null,
  maxCols: number = 12,
): LandingOddsPairColumn[] {
  const mo =
    (Array.isArray(oddsPayload?.matchOdds) && oddsPayload!.matchOdds!.length > 0 && oddsPayload!.matchOdds) ||
    (Array.isArray(match?.matchOdds) && match.matchOdds.length > 0 && match.matchOdds) ||
    null

  if (mo?.length) {
    const market = mo[0]
    const runners =
      Array.isArray(market.runners) && market.runners.length > 0
        ? market.runners
        : toOddDatasArray(market.oddDatas)
    if (runners.length > 0) {
      const eventTitle = match?.eventName ?? match?.teams ?? match?.name ?? ''
      let ordered: any[]
      if (runners.length <= 3) {
        const byTitle = orderRunnersByEventTitle(runners, eventTitle)
        const base = byTitle ?? orderFor1x2(runners, label1x2)
        ordered = base.slice(0, maxCols)
      } else {
        ordered = runners.slice(0, maxCols)
      }
      return ordered.map(node => {
        if (!node) return null
        const c = pairFromRunnerRow(node, landingOddsValid)
        const hb = c.back.price != null && !isInvalidLandingOdds(c.back.price)
        const hl = c.lay.price != null && !isInvalidLandingOdds(c.lay.price)
        if (!hb && !hl) return null
        return {
          back: hb ? String(c.back.price) : '—',
          lay: hl ? String(c.lay.price) : '—',
          backSize: c.back.sizeFormatted ?? '—',
          laySize: c.lay.sizeFormatted ?? '—',
        }
      })
    }
  }

  return getLandingCardOddsTriples(match, oddsPayload)
}
