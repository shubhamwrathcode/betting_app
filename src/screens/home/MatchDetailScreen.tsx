import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppFonts } from '../../components/AppFonts'
import { ImageAssets } from '../../components/ImageAssets'
import {
  fetchSportsbookEventConfig,
  marketNameForPlaceBet,
  postSportsbookPlaceBet,
  unwrapPlaceBetResponse,
  type SportsbookPlaceBetBody,
} from '../../api/sportsbookBet'
import { useAuth } from '../../hooks/useAuth'
import { getNumericStakeLimitsFromPayload } from '../../utils/stakeLimits'
import {
  addMatchDataDetailListener,
  removeMatchDataDetailListener,
  subscribeMatchDataDetail,
  unsubscribeMatchDataDetail,
} from '../../socket/matchDataSocket'

type MatchDetailParams = {
  sportName?: string
  gameId?: string
  eventId?: string
  eventName?: string
  seriesName?: string
}

/** Lay column / Lay bet highlight (user-requested). */
const LAY_PINK = '#f48fb1'

/** Back cell fill when selected (slip open for this Back tap). */
const BACK_BLUE = '#7ed8ff'

function normSport(s: string) {
  const x = String(s || 'cricket').toLowerCase()
  if (x === 'football') return 'soccer'
  return x
}

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

function pickSelectionId(node: any): string | null {
  if (!node || typeof node !== 'object') return null
  const v =
    node.selectionId ??
    node.sid ??
    node.id ??
    node.runnerId ??
    node.selection_id ??
    node.runner_id
  if (v == null || v === '') return null
  return String(v)
}

function pickMarketId(market: any): string | null {
  if (!market || typeof market !== 'object') return null
  const v = market.mid ?? market.mId ?? market.marketId ?? market.market_id ?? market.id
  if (v == null || v === '') return null
  return String(v)
}

function flattenBookMakerOdds(raw: unknown): any[] {
  if (!Array.isArray(raw)) return []
  const out: any[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const bmKeys = Object.keys(item).filter(k => /^bm\d+$/i.test(k))
    if (bmKeys.length > 0) {
      bmKeys.sort((a, b) => {
        const na = parseInt(a.replace(/\D/g, ''), 10) || 0
        const nb = parseInt(b.replace(/\D/g, ''), 10) || 0
        return na - nb
      })
      for (const k of bmKeys) {
        const sub = (item as any)[k]
        if (sub && typeof sub === 'object' && (sub.oddDatas != null || sub.mid != null)) out.push(sub)
      }
    } else {
      out.push(item)
    }
  }
  return out
}

function formatMinMaxLabel(obj: Record<string, unknown> | null | undefined): string {
  if (!obj || typeof obj !== 'object') return ''
  const min = obj.minBet ?? obj.min_bet ?? obj.minStake ?? obj.min ?? obj.minbet
  const max = obj.maxBet ?? obj.max_bet ?? obj.maxStake ?? obj.max ?? obj.maxbet
  const smin = min != null && min !== '' ? String(min) : ''
  const smax = max != null && max !== '' ? String(max) : ''
  if (!smin && !smax) return ''
  return `MIN: ${smin || '—'} MAX: ${smax || '—'}`
}

/** Same as web `oddDatasLenForNormalize`. */
function oddDatasLenForNormalize(m: any): number {
  if (!m || typeof m !== 'object') return 0
  const od = m.oddDatas
  if (od == null) return 0
  if (Array.isArray(od)) return od.length
  if (typeof od === 'object') return Object.values(od).filter(Boolean).length
  return 0
}

/** Port of web `partitionFancyOdds` — drives Match Odds vs sessions vs odd/even. */
function partitionFancyOdds(fancyArr: any[]) {
  if (!Array.isArray(fancyArr)) return { miniFancy: [] as any[], sessionFancy: [] as any[], oddEvenFancy: [] as any[] }
  const oddEven: any[] = []
  const sessions: any[] = []
  const mini: any[] = []
  for (const m of fancyArr) {
    const gt = String(m?.gtype ?? '').toLowerCase()
    const mn = String(m?.mname ?? '').toLowerCase()
    const mk = String(m?.market ?? '').toLowerCase()
    const isOddEven =
      gt === 'oddeven' ||
      mn.includes('oddeven') ||
      mk === 'oddeven' ||
      (mk.includes('odd') && mk.includes('even') && (mk.includes('run') || mk.includes('over')))
    if (isOddEven) {
      oddEven.push(m)
      continue
    }
    const len = oddDatasLenForNormalize(m)
    if (len > 2) mini.push(m)
    else sessions.push(m)
  }
  return { miniFancy: mini, sessionFancy: sessions, oddEvenFancy: oddEven }
}

type FancyDisplayRow = {
  label: string
  backP: string
  backSz: string
  layP: string
  laySz: string
  status?: unknown
  marketId: string | null
  marketName: string
  backSelectionId: string | null
  laySelectionId: string | null
}

type PendingPlacePayload = Pick<
  SportsbookPlaceBetBody,
  | 'sport'
  | 'gameId'
  | 'eventName'
  | 'marketType'
  | 'marketId'
  | 'selectionId'
  | 'selectionName'
  | 'betType'
  | 'odds'
> & { seriesName?: string; marketName?: string }

type MatchDetailSelectedBet = {
  elementId: string
  betName: string
  marketLabel: string
  odds: number
  betType: 'back' | 'lay'
  placePayload: PendingPlacePayload
}

const QUICK_STAKES = [100, 200, 500, 1000, 2000, 5000, 10000, 25000]

type InlineBetSlipPanelProps = {
  selectedBet: MatchDetailSelectedBet
  eventNameForBets: string
  limitsSlipLabel: string
  stake: string
  setStake: (v: string) => void
  slipOdds: number | null
  bumpSlipOdds: (delta: number) => void
  effectiveStakeBounds: { min: number; max: number }
  calculateProfitLine: string
  placeBetError: string | null
  placeBetLoading: boolean
  isDemoUser?: boolean
  stakeInputRef: React.RefObject<TextInput | null>
  onClear: () => void
  onPlaceBet: () => void
}

/** Place-bet form — rendered inline under the row the user tapped (web-style). */
function InlineBetSlipPanel({
  selectedBet,
  eventNameForBets,
  limitsSlipLabel,
  stake,
  setStake,
  slipOdds,
  bumpSlipOdds,
  effectiveStakeBounds,
  calculateProfitLine,
  placeBetError,
  placeBetLoading,
  isDemoUser,
  stakeInputRef,
  onClear,
  onPlaceBet,
}: InlineBetSlipPanelProps) {
  return (
    <View
      style={[
        styles.inlineBetSlipWrap,
        selectedBet.betType === 'lay' ? styles.inlineBetSlipWrapLay : null,
      ]}
    >
      {/* <View style={styles.slipTopBar}>
        <View style={styles.slipTopLeft}>
          <Text style={styles.slipTopIcon}>
            {selectedBet.placePayload.marketType === 'fancy'
              ? '🛠️'
              : selectedBet.placePayload.marketType === 'bookmaker'
                ? '🔧'
                : '📊'}
          </Text>
          <Text style={styles.slipTopTitle}>
            {selectedBet.placePayload.marketType === 'match_odds'
              ? 'Match'
              : selectedBet.placePayload.marketType === 'bookmaker'
                ? 'Bookmaker'
                : 'Normal'}
          </Text>
        </View>
        <Text style={styles.slipLimitsSmall}>{limitsSlipLabel}</Text>
      </View> */}

      {/* <View style={styles.tableHeadSlip}>
        <Text style={styles.colMarket}>Market</Text>
        <Text style={styles.colGroup}>Back</Text>
        <Text style={styles.colGroupLay}>Lay</Text>
      </View> */}

      {/* <View style={styles.slipSelectionRow}>
        <View style={styles.runnerNameWrap}>
          <Text style={styles.runnerName} numberOfLines={4}>
            {selectedBet.betName}
            {eventNameForBets ? ` (${eventNameForBets})` : ''}
          </Text>
        </View>
        <View
          style={[
            styles.mobileOddsCell,
            styles.slipOddsGhost,
            { opacity: selectedBet.betType === 'back' ? 1 : 0.35 },
          ]}
        >
          <Text style={styles.oddsPrice}>
            {slipOdds != null
              ? slipOdds.toFixed(2)
              : selectedBet.placePayload.betType === 'back'
                ? String(selectedBet.odds)
                : '—'}
          </Text>
        </View>
        <View
          style={[
            styles.mobileOddsCell,
            styles.slipOddsGhostLay,
            { opacity: selectedBet.betType === 'lay' ? 1 : 0.35 },
          ]}
        >
          <Text style={styles.oddsPrice}>
            {slipOdds != null
              ? slipOdds.toFixed(2)
              : selectedBet.placePayload.betType === 'lay'
                ? String(selectedBet.odds)
                : '—'}
          </Text>
        </View>
      </View> */}

      <Text style={styles.slipFieldLabel}>Odd value</Text>
      <View style={styles.oddsStepRow}>
        <Pressable style={styles.stepBtn} onPress={() => bumpSlipOdds(-0.01)} hitSlop={8}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepMid}>{(slipOdds ?? selectedBet.odds).toFixed(2)}</Text>
        <Pressable style={styles.stepBtn} onPress={() => bumpSlipOdds(0.01)} hitSlop={8}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>

      <Text style={styles.slipFieldLabel}>Amount</Text>
      <TextInput
        ref={stakeInputRef}
        style={styles.stakeInput}
        keyboardType="numeric"
        value={stake}
        onChangeText={setStake}
        placeholderTextColor="#64748b"
        placeholder="Stake"
      />

      <View style={styles.quickGrid}>
        {QUICK_STAKES.map(amt => (
          <Pressable
            key={amt}
            style={styles.quickBtn}
            onPress={() =>
              setStake(String(Math.min(effectiveStakeBounds.max, (Number(stake) || 0) + amt)))
            }
          >
            <Text style={styles.quickBtnText}>+{amt >= 1000 ? `${amt / 1000}K` : amt}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.utilityRow}>
        <Pressable
          style={[styles.utilBtn, { backgroundColor: '#ca8a04' }]}
          onPress={() => setStake(String(effectiveStakeBounds.min))}
        >
          <Text style={styles.utilBtnText}>MIN STAKE</Text>
        </Pressable>
        <Pressable
          style={[styles.utilBtn, { backgroundColor: '#2563eb' }]}
          onPress={() => setStake(String(effectiveStakeBounds.max))}
        >
          <Text style={styles.utilBtnText}>MAX STAKE</Text>
        </Pressable>
        <Pressable
          style={[styles.utilBtn, { backgroundColor: '#16a34a' }]}
          onPress={() => stakeInputRef.current?.focus()}
        >
          <Text style={styles.utilBtnText}>EDIT STAKE</Text>
        </Pressable>
        <Pressable style={[styles.utilBtn, { backgroundColor: '#dc2626' }]} onPress={onClear}>
          <Text style={styles.utilBtnText}>CLEAR</Text>
        </Pressable>
      </View>

      <View style={styles.summaryBlock}>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryLabel}>Your profit/loss as per placed bet</Text>
          <Text style={styles.summaryProfit}>{calculateProfitLine} ₹</Text>
        </View>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryLabel}>Total Amount (in ₹)</Text>
          <Text style={styles.summaryTotal}>
            {stake === '' ? '0.00' : (Number(stake) || 0).toFixed(2)} ₹
          </Text>
        </View>
      </View>

      {placeBetError ? <Text style={styles.slipError}>{placeBetError}</Text> : null}

      <Pressable
        style={[
          styles.placeBetBtn,
          (placeBetLoading || isDemoUser) && { opacity: 0.7 },
          isDemoUser && { backgroundColor: '#4b5563', borderColor: '#374151' },
        ]}
        onPress={onPlaceBet}
        disabled={placeBetLoading || isDemoUser}
      >
        <Text style={styles.placeBetBtnText}>
          {isDemoUser ? 'Login to Play' : placeBetLoading ? 'Placing…' : 'Place Bet'}
        </Text>
      </Pressable>
    </View>
  )
}

/** Port of web `buildNoYesRowsFromMarkets` → flat rows (Back = yes/b1, Lay = no/l1). */
function buildFancyDisplayRows(markets: any[]): FancyDisplayRow[] {
  const rows: FancyDisplayRow[] = []
  for (const m of markets) {
    const oddList = toOddDatasArray(m?.oddDatas)
    const marketName = String(m.marketName ?? m.market ?? m.mname ?? m.name ?? 'Market')
    const mId = pickMarketId(m)

    const pushOne = (o: any) => {
      const sid = pickSelectionId(o)
      rows.push({
        label: String(o.rname ?? o.selectionName ?? marketName),
        backP: o.b1 != null && o.b1 !== '' ? String(o.b1) : '—',
        backSz: o.bs1 != null && o.bs1 !== '' ? String(o.bs1) : '—',
        layP: o.l1 != null && o.l1 !== '' ? String(o.l1) : '—',
        laySz: o.ls1 != null && o.ls1 !== '' ? String(o.ls1) : '—',
        status: o?.status,
        marketId: mId,
        marketName,
        backSelectionId: sid,
        laySelectionId: sid,
      })
    }

    if (oddList.length > 2) {
      oddList.forEach(pushOne)
    } else if (oddList.length === 2) {
      const n0 = String(oddList[0]?.rname ?? oddList[0]?.selectionName ?? '').trim()
      const n1 = String(oddList[1]?.rname ?? oddList[1]?.selectionName ?? '').trim()
      const pairedNoYes =
        /^(no|yes|n\/a)$/i.test(n0) ||
        /^(no|yes|n\/a)$/i.test(n1) ||
        (n0.toLowerCase() === 'no' && n1.toLowerCase() === 'yes') ||
        (n0.toLowerCase() === 'yes' && n1.toLowerCase() === 'no')
      if (pairedNoYes) {
        const noSel = oddList[0]
        const yesSel = oddList[1]
        const noOdds = noSel?.l1 ?? noSel?.b1
        const yesOdds = yesSel?.b1 ?? yesSel?.l1
        const noSize = noSel?.ls1 ?? noSel?.bs1
        const yesSize = yesSel?.bs1 ?? yesSel?.ls1
        rows.push({
          label: marketName,
          backP: yesOdds != null && yesOdds !== '' ? String(yesOdds) : '—',
          backSz: yesSize != null && yesSize !== '' ? String(yesSize) : '—',
          layP: noOdds != null && noOdds !== '' ? String(noOdds) : '—',
          laySz: noSize != null && noSize !== '' ? String(noSize) : '—',
          status: noSel?.status ?? yesSel?.status,
          marketId: mId,
          marketName,
          backSelectionId: pickSelectionId(yesSel),
          laySelectionId: pickSelectionId(noSel),
        })
      } else {
        oddList.forEach(pushOne)
      }
    } else if (oddList.length === 1) {
      pushOne(oddList[0])
    }
  }
  return rows
}

function isOddsLockedStr(val: string): boolean {
  if (val == null || val === '' || val === '—') return true
  const n = parseFloat(String(val).trim())
  return Number.isNaN(n) || n <= 0
}

/** Web `selectionStatusRowLabel` — back-only / mini rows overlay. */
function selectionStatusRowLabel(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  const s = String(raw).trim().toLowerCase()
  if (s === 'ball running') return 'Ball Running'
  if (s === 'suspended') return 'Suspended'
  return null
}

type BackOnlyFancyBlock = {
  key: string
  marketId: string | null
  title: string
  minMax: string
  market: any
  rows: {
    label: string
    backP: string
    backSz: string
    selectionId: string | null
    statusOverlay: string | null
  }[]
}

function buildBackOnlyFancyBlocks(markets: any[]): BackOnlyFancyBlock[] {
  return markets.map((m, bi) => {
    const oddList = toOddDatasArray(m?.oddDatas)
    const marketId = pickMarketId(m)
    const title = String(m.marketName ?? m.market ?? m.mname ?? m.name ?? 'Market')
    const rows = oddList.map((o: any) => ({
      label: String(o.rname ?? o.selectionName ?? '—'),
      backP: o.b1 != null && o.b1 !== '' ? String(o.b1) : '—',
      backSz: o.bs1 != null && o.bs1 !== '' ? String(o.bs1) : '—',
      selectionId: pickSelectionId(o),
      statusOverlay: selectionStatusRowLabel(o?.status),
    }))
    return {
      key: `${String(marketId ?? 'bo')}-${bi}`,
      marketId,
      title,
      minMax: formatMinMaxLabel(m),
      market: m,
      rows,
    }
  })
}

function normalizeOddsPayload(match: Record<string, any>) {
  const matchOdds = Array.isArray(match.matchOdds)
    ? match.matchOdds
    : Array.isArray(match.match_odds)
      ? match.match_odds
      : []
  const bookMakerOddsFlat = flattenBookMakerOdds(
    Array.isArray(match.bookMakerOdds) ? match.bookMakerOdds : match.book_maker_odds,
  )
  const rawFancy = Array.isArray(match.fancyOdds) ? match.fancyOdds : match.fancy_odds
  const fancyArr = Array.isArray(rawFancy) ? rawFancy : []
  const fancyPart = partitionFancyOdds(fancyArr)

  const premiumRaw = Array.isArray(match.premiumFancy) ? match.premiumFancy : match.premium_fancy
  const premiumArr = Array.isArray(premiumRaw) ? premiumRaw : []
  const premiumSessions = premiumArr.filter((m: any) => oddDatasLenForNormalize(m) <= 2)

  const baseOddEven = Array.isArray(match.oddEvenOdds)
    ? match.oddEvenOdds
    : Array.isArray(match.odd_even_odds)
      ? match.odd_even_odds
      : []
  const oddEvenAll = [...baseOddEven, ...fancyPart.oddEvenFancy]

  const otherMo = Array.isArray(match.otherMarketOdds)
    ? match.otherMarketOdds
    : Array.isArray(match.other_market_odds)
      ? match.other_market_odds
      : []
  const totalGoals = Array.isArray(match.totalGoalsOdds)
    ? match.totalGoalsOdds
    : Array.isArray(match.total_goals_odds)
      ? match.total_goals_odds
      : []
  const overUnder = Array.isArray(match.overUnderOdds)
    ? match.overUnderOdds
    : Array.isArray(match.over_under_odds)
      ? match.over_under_odds
      : []

  const premiumMore = premiumArr.filter((m: any) => oddDatasLenForNormalize(m) > 2)
  /** Web: `fancyOdds` mini only; if empty, fall back to full `premiumFancy` for mini bookmaker blocks. */
  const fancyMiniMarkets =
    fancyPart.miniFancy.length > 0 ? fancyPart.miniFancy : premiumArr.length > 0 ? premiumArr : []

  return {
    matchOdds,
    bookMakerOdds: bookMakerOddsFlat,
    fancyMiniMarkets,
    sessionsFancyRows: buildFancyDisplayRows(fancyPart.sessionFancy),
    wpFancyRows: buildFancyDisplayRows([...otherMo, ...totalGoals, ...overUnder]),
    extraFancyRows: buildFancyDisplayRows(premiumSessions),
    oddEvenFancyRows: buildFancyDisplayRows(oddEvenAll),
    backOnlyFancyBlocks: buildBackOnlyFancyBlocks(premiumMore),
    eventName:
      match.eventName ??
      match.event_name ??
      match.matchName ??
      matchOdds[0]?.eventName ??
      matchOdds[0]?.event_name ??
      null,
  }
}

const BACK_KEYS = ['b1', 'b2', 'b3'] as const
const LAY_KEYS = ['l1', 'l2', 'l3'] as const

function priceFromRunner(r: any, key: string): { p: string; sz: string; lock: boolean } {
  const v = r?.[key]
  const num = v != null && v !== '' ? String(v) : '—'
  const bsKey = key.startsWith('b') ? `bs${key.slice(1)}` : `ls${key.slice(1)}`
  const stack = r?.[bsKey]
  const sz = stack != null && stack !== '' ? String(stack) : '—'
  const status = r?.status != null ? String(r.status).toLowerCase() : ''
  const lock = status.includes('suspend') || status.includes('suspended') || status === 'ball running'
  return { p: num, sz, lock }
}

function rowLockedFromStatus(status: unknown): boolean {
  const s = String(status ?? '').toLowerCase()
  return s.includes('suspend') || s.includes('suspended') || s === 'ball running'
}

/** Web mobile: one Back + one Lay cell — use first “active” ladder step, else b1/l1. */
function pickBestBackLay(r: any) {
  let back = priceFromRunner(r, 'b1')
  let lay = priceFromRunner(r, 'l1')
  for (const k of BACK_KEYS) {
    const x = priceFromRunner(r, k)
    if (!x.lock && x.p !== '—' && x.p !== '0') {
      back = x
      break
    }
  }
  for (const k of LAY_KEYS) {
    const x = priceFromRunner(r, k)
    if (!x.lock && x.p !== '—' && x.p !== '0') {
      lay = x
      break
    }
  }
  return { back, lay }
}

function MobileOddsCell({
  price,
  size,
  isBack,
  locked,
  onPress,
  selected,
}: {
  price: string
  size: string
  isBack: boolean
  locked: boolean
  onPress?: () => void
  selected?: boolean
}) {
  const hasPrice = price !== '—' && price !== '' && !locked
  /** Accent colors only when this cell is the active selection (slip open below this row). */
  const bg = locked
    ? '#94a3b8'
    : selected && hasPrice
      ? isBack
        ? BACK_BLUE
        : LAY_PINK
      : hasPrice
        ? isBack
          ? '#a7d8fd'
          : '#f9c9d4'
        : isBack
          ? '#d4ecfe'
          : '#fce4ea'
  const cell = (
    <View
      style={[
        styles.mobileOddsCell,
        { backgroundColor: bg },
        selected && (isBack ? styles.cellSelectedBack : styles.cellSelectedLay),
      ]}
    >
      {locked ? (
        <Text style={styles.lockText}>🔒</Text>
      ) : price === '—' ? (
        <Text style={styles.ladderDash}>-</Text>
      ) : (
        <>
          <Text style={styles.oddsPrice}>{price}</Text>
          {size && size !== '—' ? <Text style={styles.oddsVol}>{size}</Text> : null}
        </>
      )}
    </View>
  )
  if (onPress && hasPrice) {
    return (
      <Pressable onPress={onPress} style={{ flex: 1 }} hitSlop={4}>
        {cell}
      </Pressable>
    )
  }
  return cell
}

function MarketBlock({
  title,
  minMax,
  icon,
  children,
  columns = 'backLay',
}: {
  title: string
  minMax: string
  icon: string
  children: React.ReactNode
  /** Web premium “back only” tables: Market + Back only. */
  columns?: 'backLay' | 'backOnly'
}) {
  return (
    <View style={styles.marketCard}>
      <View style={styles.marketHead}>
        <View style={styles.marketTitleRow}>
          <Text style={styles.marketIcon}>{icon}</Text>
          <Text style={styles.marketTitle} numberOfLines={2}>
            {title}
          </Text>
        </View>
        {minMax ? (
          <Text style={styles.marketLimits} numberOfLines={2}>
            {minMax}
          </Text>
        ) : null}
      </View>
      <View style={styles.tableHead}>
        <Text style={styles.colMarket}>Market</Text>
        <Text style={[styles.colGroup, columns === 'backOnly' ? { flex: 2 } : null]}>Back</Text>
        {columns === 'backLay' ? <Text style={styles.colGroupLay}>Lay</Text> : null}
      </View>
      {children}
    </View>
  )
}

function RunnerRows({
  market,
  sportName,
  placeBetGameId,
  eventNameForBets,
  seriesName,
  marketTypeApi,
  rowKeyPrefix = '',
  selectedElementId,
  onSelectBet,
  betSlipBelow,
}: {
  market: any
  sportName: string
  placeBetGameId: string
  eventNameForBets: string
  seriesName?: string
  marketTypeApi: 'match_odds' | 'bookmaker' | 'fancy'
  rowKeyPrefix?: string
  selectedElementId: string | null
  onSelectBet: (sel: MatchDetailSelectedBet) => void
  betSlipBelow?: (elIdBack: string, elIdLay: string) => React.ReactNode
}) {
  const runners = toOddDatasArray(market?.oddDatas)
  const marketId = pickMarketId(market)
  const marketTitle = String(market.marketName ?? market.mname ?? market.market ?? market.name ?? 'Market')

  if (!runners.length) {
    return (
      <View style={styles.emptyMarket}>
        <Text style={styles.emptyText}>No runners yet</Text>
      </View>
    )
  }
  return (
    <>
      {runners.map((r, idx) => {
        const { back, lay } = pickBestBackLay(r)
        const name = runnerLabel(r) || '—'
        const selId = pickSelectionId(r)
        const pfx = rowKeyPrefix ? `${rowKeyPrefix}-` : ''
        const elIdBack = `${pfx}${marketTypeApi}-${marketId ?? 'm'}-${idx}-back`
        const elIdLay = `${pfx}${marketTypeApi}-${marketId ?? 'm'}-${idx}-lay`
        const oddsBack = parseFloat(back.p) || 0
        const oddsLay = parseFloat(lay.p) || 0
        const canBack =
          !back.lock &&
          Boolean(marketId && selId && placeBetGameId) &&
          !isOddsLockedStr(back.p) &&
          oddsBack >= 1.01
        const canLay =
          !lay.lock &&
          Boolean(marketId && selId && placeBetGameId) &&
          !isOddsLockedStr(lay.p) &&
          oddsLay >= 1.01

        const basePayload = {
          sport: sportName,
          gameId: placeBetGameId,
          eventName: eventNameForBets,
          ...(seriesName ? { seriesName } : {}),
          marketType: marketTypeApi,
          marketId: String(marketId),
          marketName: marketTitle,
          selectionId: String(selId),
          selectionName: name,
        }

        return (
          <Fragment key={elIdBack}>
            <View style={styles.runnerRow}>
              <View style={styles.runnerNameWrap}>
                <Text style={styles.runnerName} numberOfLines={3}>
                  {name}
                </Text>
              </View>
              <MobileOddsCell
                price={back.p}
                size={back.sz}
                isBack
                locked={back.lock}
                selected={selectedElementId === elIdBack}
                onPress={
                  canBack
                    ? () =>
                      onSelectBet({
                        elementId: elIdBack,
                        betName: name,
                        marketLabel: marketTitle,
                        odds: oddsBack,
                        betType: 'back',
                        placePayload: { ...basePayload, betType: 'back', odds: oddsBack },
                      })
                    : undefined
                }
              />
              <MobileOddsCell
                price={lay.p}
                size={lay.sz}
                isBack={false}
                locked={lay.lock}
                selected={selectedElementId === elIdLay}
                onPress={
                  canLay
                    ? () =>
                      onSelectBet({
                        elementId: elIdLay,
                        betName: name,
                        marketLabel: marketTitle,
                        odds: oddsLay,
                        betType: 'lay',
                        placePayload: { ...basePayload, betType: 'lay', odds: oddsLay },
                      })
                    : undefined
                }
              />
            </View>
            {betSlipBelow?.(elIdBack, elIdLay)}
          </Fragment>
        )
      })}
    </>
  )
}

function FancyNormalRows({
  rows,
  sectionKey,
  sportName,
  placeBetGameId,
  eventNameForBets,
  seriesName,
  selectedElementId,
  onSelectBet,
  betSlipBelow,
}: {
  rows: FancyDisplayRow[]
  /** Web section id: sessions, wp, extra, odd_even — keeps elementIds unique across blocks. */
  sectionKey: string
  sportName: string
  placeBetGameId: string
  eventNameForBets: string
  seriesName?: string
  selectedElementId: string | null
  onSelectBet: (sel: MatchDetailSelectedBet) => void
  betSlipBelow?: (elIdBack: string, elIdLay: string) => React.ReactNode
}) {
  if (!rows.length) {
    return (
      <View style={styles.emptyMarket}>
        <Text style={styles.emptyText}>No session markets yet</Text>
      </View>
    )
  }
  return (
    <>
      {rows.map((r, i) => {
        const lk = rowLockedFromStatus(r.status)
        const elIdBack = `fancy-${sectionKey}-${r.marketId ?? i}-${i}-back`
        const elIdLay = `fancy-${sectionKey}-${r.marketId ?? i}-${i}-lay`
        const oddsBack = parseFloat(r.backP) || 0
        const oddsLay = parseFloat(r.layP) || 0
        const canBack =
          !lk &&
          Boolean(r.marketId && r.backSelectionId && placeBetGameId) &&
          !isOddsLockedStr(r.backP) &&
          oddsBack >= 1.01
        const canLay =
          !lk &&
          Boolean(r.marketId && r.laySelectionId && placeBetGameId) &&
          !isOddsLockedStr(r.layP) &&
          oddsLay >= 1.01

        const basePayload = (betType: 'back' | 'lay', selectionId: string, odds: number) => ({
          sport: sportName,
          gameId: placeBetGameId,
          eventName: eventNameForBets,
          ...(seriesName ? { seriesName } : {}),
          marketType: 'fancy' as const,
          marketId: String(r.marketId),
          marketName: r.marketName || r.label,
          selectionId: String(selectionId),
          selectionName: r.label,
          betType,
          odds,
        })

        return (
          <Fragment key={`${elIdBack}-${i}`}>
            <View style={styles.runnerRow}>
              <View style={styles.runnerNameWrap}>
                <Text style={styles.runnerName} numberOfLines={4}>
                  {r.label}
                </Text>
              </View>
              <MobileOddsCell
                price={r.backP}
                size={r.backSz}
                isBack
                locked={lk}
                selected={selectedElementId === elIdBack}
                onPress={
                  canBack && r.backSelectionId
                    ? () => {
                      const sid = r.backSelectionId as string
                      onSelectBet({
                        elementId: elIdBack,
                        betName: r.label,
                        marketLabel: r.marketName,
                        odds: oddsBack,
                        betType: 'back',
                        placePayload: basePayload('back', sid, oddsBack),
                      })
                    }
                    : undefined
                }
              />
              <MobileOddsCell
                price={r.layP}
                size={r.laySz}
                isBack={false}
                locked={lk}
                selected={selectedElementId === elIdLay}
                onPress={
                  canLay && r.laySelectionId
                    ? () => {
                      const sid = r.laySelectionId as string
                      onSelectBet({
                        elementId: elIdLay,
                        betName: r.label,
                        marketLabel: r.marketName,
                        odds: oddsLay,
                        betType: 'lay',
                        placePayload: basePayload('lay', sid, oddsLay),
                      })
                    }
                    : undefined
                }
              />
            </View>
            {betSlipBelow?.(elIdBack, elIdLay)}
          </Fragment>
        )
      })}
    </>
  )
}

/** Premium fancy with 3+ runners: Back only (web `renderBackOnlySection`). */
function BackOnlyRows({
  blockKey,
  market,
  sportName,
  placeBetGameId,
  eventNameForBets,
  seriesName,
  rows,
  selectedElementId,
  onSelectBet,
  betSlipBelow,
}: {
  blockKey: string
  market: any
  sportName: string
  placeBetGameId: string
  eventNameForBets: string
  seriesName?: string
  rows: BackOnlyFancyBlock['rows']
  selectedElementId: string | null
  onSelectBet: (sel: MatchDetailSelectedBet) => void
  betSlipBelow?: (elIdBack: string, elIdLay: string) => React.ReactNode
}) {
  const marketId = pickMarketId(market)
  const marketTitle = String(market.marketName ?? market.mname ?? market.market ?? market.name ?? 'Market')

  if (!rows.length) {
    return (
      <View style={styles.emptyMarket}>
        <Text style={styles.emptyText}>No data.</Text>
      </View>
    )
  }

  return (
    <>
      {rows.map((row, idx) => {
        const elId = `backonly-${blockKey}-${idx}`
        const overlay = row.statusOverlay
        const backLocked = overlay != null || isOddsLockedStr(row.backP)
        const oddsNum = parseFloat(row.backP) || 0
        const canBack =
          !overlay &&
          !isOddsLockedStr(row.backP) &&
          Boolean(row.selectionId && marketId && placeBetGameId) &&
          oddsNum >= 1.01

        const basePayload = {
          sport: sportName,
          gameId: placeBetGameId,
          eventName: eventNameForBets,
          ...(seriesName ? { seriesName } : {}),
          marketType: 'fancy' as const,
          marketId: String(marketId),
          marketName: marketTitle,
          selectionId: String(row.selectionId),
          selectionName: row.label,
        }

        return (
          <Fragment key={elId}>
            <View style={styles.runnerRow}>
              <View style={styles.runnerNameWrap}>
                <Text style={styles.runnerName} numberOfLines={4}>
                  {row.label}
                </Text>
              </View>
              <View style={styles.backOnlyCellWrap}>
                {overlay ? (
                  <View style={[styles.mobileOddsCell, styles.backOnlyOverlayCell]}>
                    <Text style={styles.backOnlyOverlayText}>{overlay.toUpperCase()}</Text>
                  </View>
                ) : (
                  <MobileOddsCell
                    price={row.backP}
                    size={row.backSz}
                    isBack
                    locked={backLocked}
                    selected={selectedElementId === elId}
                    onPress={
                      canBack && row.selectionId
                        ? () =>
                          onSelectBet({
                            elementId: elId,
                            betName: row.label,
                            marketLabel: marketTitle,
                            odds: oddsNum,
                            betType: 'back',
                            placePayload: { ...basePayload, betType: 'back', odds: oddsNum },
                          })
                        : undefined
                    }
                  />
                )}
              </View>
              <View style={styles.backOnlyLaySpacer} />
            </View>
            {betSlipBelow?.(elId, elId)}
          </Fragment>
        )
      })}
    </>
  )
}

/**
 * Match detail — mobile layout aligned with web `CricketDetail.js` (Markets + ladder grids).
 * Data: `/matchdata` → `matchData:matchUpdate` after `subscribeMatchDataDetail`.
 */
const MatchDetailScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const insets = useSafeAreaInsets()
  const params: MatchDetailParams = route.params ?? {}
  const { isAuthenticated, updateUser, user } = useAuth()
  const stakeInputRef = useRef<TextInput>(null)

  const sportName = useMemo(() => normSport(params.sportName || 'cricket'), [params.sportName])
  const gameId = params.gameId ? String(params.gameId) : ''
  const eventId = params.eventId ? String(params.eventId) : ''
  const oddsId = sportName === 'tennis' ? (eventId || gameId) : gameId || eventId
  /** Same id as socket + event config; place-bet `gameId` (web parity). */
  const placeBetGameId = oddsId

  const [loading, setLoading] = useState(true)
  const [matchPayload, setMatchPayload] = useState<Record<string, any> | null>(null)
  const [eventStakeLimits, setEventStakeLimits] = useState<Record<string, unknown>>({})
  const [selectedBet, setSelectedBet] = useState<MatchDetailSelectedBet | null>(null)
  const [stake, setStake] = useState('100')
  const [slipOdds, setSlipOdds] = useState<number | null>(null)
  const [placeBetLoading, setPlaceBetLoading] = useState(false)
  const [placeBetError, setPlaceBetError] = useState<string | null>(null)

  const headerTitle =
    params.eventName ||
    params.seriesName ||
    normalizeOddsPayload(matchPayload || {}).eventName ||
    'Match'

  const eventNameForBets = useMemo(() => {
    const t = (v: unknown) => (v == null ? '' : String(v).trim())
    return (
      t(params.eventName) ||
      t(normalizeOddsPayload(matchPayload || {}).eventName) ||
      t(matchPayload?.eventName ?? matchPayload?.event_name ?? matchPayload?.matchName) ||
      'Match'
    )
  }, [params.eventName, matchPayload])

  const minMaxHero = formatMinMaxLabel(matchPayload as any)

  const oddsData = useMemo(() => (matchPayload ? normalizeOddsPayload(matchPayload) : null), [matchPayload])

  const limitsFallbackPayload = useMemo(
    () => ({
      ...eventStakeLimits,
      ...(matchPayload && typeof matchPayload === 'object' ? matchPayload : {}),
    }),
    [eventStakeLimits, matchPayload],
  )

  const effectiveStakeBounds = useMemo(() => {
    const { min, max } = getNumericStakeLimitsFromPayload(limitsFallbackPayload)
    return {
      min: min != null ? min : 100,
      max: max != null ? max : 10000,
    }
  }, [limitsFallbackPayload])

  const limitsSlipLabel = useMemo(
    () =>
      `MIN: ${effectiveStakeBounds.min} MAX: ${effectiveStakeBounds.max >= 1000 ? `${effectiveStakeBounds.max / 1000}K` : effectiveStakeBounds.max}`,
    [effectiveStakeBounds.min, effectiveStakeBounds.max],
  )

  const onDetail = useCallback(
    (payload: unknown) => {
      const p = payload as Record<string, any>
      const pSport = normSport(String(p?.sportName ?? ''))
      const pGid = p?.gameId != null ? String(p.gameId) : ''
      if (pSport !== sportName || pGid !== String(oddsId)) return
      const match = p?.match
      if (!match || typeof match !== 'object') return
      setMatchPayload(match as Record<string, any>)
      setLoading(false)
    },
    [sportName, oddsId],
  )

  useEffect(() => {
    if (!oddsId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setMatchPayload(null)
    subscribeMatchDataDetail(sportName, oddsId)
    addMatchDataDetailListener(onDetail)
    return () => {
      removeMatchDataDetailListener(onDetail)
      unsubscribeMatchDataDetail(sportName, oddsId)
    }
  }, [sportName, oddsId, onDetail])

  useEffect(() => {
    if (!oddsId) return
    let cancelled = false
    fetchSportsbookEventConfig(oddsId).then(cfg => {
      if (!cancelled && cfg && typeof cfg === 'object') setEventStakeLimits(cfg as Record<string, unknown>)
    })
    return () => {
      cancelled = true
    }
  }, [oddsId])

  const onSelectBet = useCallback((sel: MatchDetailSelectedBet) => {
    setSelectedBet(sel)
    setSlipOdds(sel.odds >= 1.01 ? sel.odds : null)
    setPlaceBetError(null)
  }, [])

  const bumpSlipOdds = useCallback((delta: number) => {
    setSlipOdds(prev => {
      const base = prev ?? selectedBet?.odds ?? 1.01
      const n = Math.round((base + delta) * 100) / 100
      return Math.max(1.01, n)
    })
  }, [selectedBet?.odds])

  const calculateProfitLine = useMemo(() => {
    if (!selectedBet) return '0.00'
    const s = Number(stake) || 0
    const oddsVal = Number(slipOdds != null ? slipOdds : selectedBet.odds) || 0
    const betType = (selectedBet.placePayload?.betType ?? 'back').toLowerCase()
    const profit = betType === 'lay' ? s : s * (oddsVal - 1)
    return profit.toFixed(2)
  }, [selectedBet, stake, slipOdds])

  const handlePlaceBet = useCallback(async () => {
    if (!isAuthenticated) {
      navigation.navigate('Login', { initialTab: 'login' })
      return
    }
    const isDemoUser = (user as any)?.role === 'demo' || (user as any)?.isDemo === true
    if (isDemoUser) {
      navigation.navigate('Login', { initialTab: 'login' })
      return
    }
    if (!selectedBet?.placePayload) {
      Alert.alert('Bet slip', 'Select a Back or Lay price first.')
      return
    }
    const stakeNum = Number(stake) || 0
    const { min: minStake, max: maxStake } = effectiveStakeBounds
    if (stakeNum < minStake) {
      const msg = `Minimum stake is ₹${minStake}`
      setPlaceBetError(msg)
      Alert.alert('Stake', msg)
      return
    }
    if (stakeNum > maxStake) {
      const msg = `Maximum stake is ₹${maxStake}`
      setPlaceBetError(msg)
      Alert.alert('Stake', msg)
      return
    }
    setPlaceBetError(null)
    setPlaceBetLoading(true)
    try {
      const p = selectedBet.placePayload
      const oddsFromSlip = slipOdds != null && slipOdds >= 1.01 ? slipOdds : null
      let oddsNum = oddsFromSlip ?? (p.odds >= 1.01 ? p.odds : 0)
      if (oddsNum < 1.01) {
        throw new Error('Invalid odds')
      }
      const priceVersion = matchPayload?.oddsUpdatedAt ?? matchPayload?.odds_updated_at
      const body: SportsbookPlaceBetBody = {
        sport: p.sport,
        gameId: String(p.gameId),
        eventName: p.eventName || eventNameForBets,
        ...(params.seriesName ? { seriesName: params.seriesName } : {}),
        marketType: p.marketType,
        marketId: String(p.marketId),
        marketName: marketNameForPlaceBet(p),
        selectionId: String(p.selectionId),
        selectionName: p.selectionName,
        betType: p.betType,
        odds: Number(oddsNum),
        stake: stakeNum,
        isLive: Boolean(matchPayload?.inPlay ?? matchPayload?.in_play ?? true),
        requestId: `req-${selectedBet.elementId}-${Date.now()}`,
        ...(priceVersion != null && priceVersion !== ''
          ? { priceVersion: priceVersion as string | number }
          : {}),
      }
      const res = await postSportsbookPlaceBet(body)
      const { ok, message: failMsg, balanceAfter } = unwrapPlaceBetResponse(res)
      if (!ok) {
        throw new Error(failMsg || (res as { message?: string })?.message || 'Bet failed')
      }
      const successMsg = failMsg || (res as { message?: string })?.message || 'Bet placed successfully.'
      Alert.alert('Success', successMsg)
      if (balanceAfter != null && Number.isFinite(balanceAfter)) {
        await updateUser({ wallet: { ...user?.wallet, balance: balanceAfter } })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Bet failed'
      setPlaceBetError(msg)
      Alert.alert('Bet failed', msg)
    } finally {
      setPlaceBetLoading(false)
    }
  }, [
    isAuthenticated,
    navigation,
    selectedBet,
    stake,
    effectiveStakeBounds,
    slipOdds,
    matchPayload,
    eventNameForBets,
    params.seriesName,
    updateUser,
    user?.wallet,
  ])

  const clearBetSlip = useCallback(() => {
    setSelectedBet(null)
    setSlipOdds(null)
    setPlaceBetError(null)
  }, [])

  const betSlipBelow = useCallback(
    (elIdBack: string, elIdLay: string) =>
      selectedBet && (selectedBet.elementId === elIdBack || selectedBet.elementId === elIdLay) ? (
        <InlineBetSlipPanel
          selectedBet={selectedBet}
          eventNameForBets={eventNameForBets}
          limitsSlipLabel={limitsSlipLabel}
          stake={stake}
          setStake={setStake}
          slipOdds={slipOdds}
          bumpSlipOdds={bumpSlipOdds}
          effectiveStakeBounds={effectiveStakeBounds}
          calculateProfitLine={calculateProfitLine}
          placeBetError={placeBetError}
          placeBetLoading={placeBetLoading}
          isDemoUser={(user as any)?.role === 'demo' || (user as any)?.isDemo === true}
          stakeInputRef={stakeInputRef}
          onClear={clearBetSlip}
          onPlaceBet={handlePlaceBet}
        />
      ) : null,
    [
      selectedBet,
      eventNameForBets,
      limitsSlipLabel,
      stake,
      slipOdds,
      bumpSlipOdds,
      effectiveStakeBounds,
      calculateProfitLine,
      placeBetError,
      placeBetLoading,
      handlePlaceBet,
      clearBetSlip,
    ],
  )

  const matchMarket = oddsData?.matchOdds?.[0]
  const bookMkts = oddsData?.bookMakerOdds ?? []
  const fancyMiniMarkets = oddsData?.fancyMiniMarkets ?? []
  const sessionsFancyRows = oddsData?.sessionsFancyRows ?? []
  const wpFancyRows = oddsData?.wpFancyRows ?? []
  const extraFancyRows = oddsData?.extraFancyRows ?? []
  const oddEvenFancyRows = oddsData?.oddEvenFancyRows ?? []
  const backOnlyFancyBlocks = oddsData?.backOnlyFancyBlocks ?? []
  const isCricket = sportName === 'cricket'

  return (
    <View style={styles.page}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={ImageAssets.backImg} style={{ width: 24, height: 24, tintColor: '#fff' }} resizeMode="contain" />
        </Pressable>
        <Text style={styles.topSport}>{sportName === 'soccer' ? 'Football' : sportName}</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollInner,
          { paddingBottom: Math.max(insets.bottom, 16) + (selectedBet ? 48 : 96) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ImageBackground
          source={ImageAssets.herobgMainJpg}
          style={styles.hero}
          imageStyle={styles.heroImg}
        >
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>{headerTitle}</Text>
            {minMaxHero ? <Text style={styles.heroSub}>{minMaxHero}</Text> : null}
            <View style={styles.liveTvBox}>
              <Text style={styles.liveTvTitle}>Live TV</Text>
              <Text style={styles.liveTvHint}>Stream opens when available.</Text>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.tabRow}>
          <View style={styles.tabMarkets}>
            <Text style={styles.tabMarketsText}>Markets</Text>
          </View>
          <Text style={styles.openBets}>OPEN BETS (0)</Text>
        </View>

        {loading && !matchPayload ? (
          <View style={styles.center}>
            <ActivityIndicator color="#2E90FA" />
            <Text style={styles.hint}>Loading markets…</Text>
          </View>
        ) : null}

        {!oddsId ? (
          <View style={styles.center}>
            <Text style={styles.hint}>Missing match id</Text>
          </View>
        ) : null}

        {matchMarket ? (
          <MarketBlock icon="📊" title="Match" minMax={formatMinMaxLabel(matchMarket)}>
            <RunnerRows
              market={matchMarket}
              sportName={sportName}
              placeBetGameId={placeBetGameId}
              eventNameForBets={eventNameForBets}
              seriesName={params.seriesName}
              marketTypeApi="match_odds"
              selectedElementId={selectedBet?.elementId ?? null}
              onSelectBet={onSelectBet}
              betSlipBelow={betSlipBelow}
            />
          </MarketBlock>
        ) : null}

        {bookMkts.map((bm: any, i: number) => (
          <MarketBlock
            key={`bm-${bm?.mid ?? bm?.marketId ?? i}`}
            icon="🔧"
            title="Bookmaker"
            minMax={formatMinMaxLabel(bm)}
          >
            <RunnerRows
              market={bm}
              sportName={sportName}
              placeBetGameId={placeBetGameId}
              eventNameForBets={eventNameForBets}
              seriesName={params.seriesName}
              marketTypeApi="bookmaker"
              selectedElementId={selectedBet?.elementId ?? null}
              onSelectBet={onSelectBet}
              betSlipBelow={betSlipBelow}
            />
          </MarketBlock>
        ))}

        {fancyMiniMarkets.length > 0
          ? fancyMiniMarkets.map((fm: any, fi: number) => (
            <MarketBlock
              key={`fancy-mini-${pickMarketId(fm) ?? fi}-${fi}`}
              icon="✨"
              title={String(fm.marketName ?? fm.market ?? fm.mname ?? 'Fancy')}
              minMax={formatMinMaxLabel(fm)}
            >
              <RunnerRows
                market={fm}
                sportName={sportName}
                placeBetGameId={placeBetGameId}
                eventNameForBets={eventNameForBets}
                seriesName={params.seriesName}
                marketTypeApi="fancy"
                rowKeyPrefix={`fmini-${fi}`}
                selectedElementId={selectedBet?.elementId ?? null}
                onSelectBet={onSelectBet}
                betSlipBelow={betSlipBelow}
              />
            </MarketBlock>
          ))
          : null}

        {isCricket && sessionsFancyRows.length > 0 ? (
          <MarketBlock icon="🎯" title="SESSIONS" minMax={formatMinMaxLabel(matchPayload as any)}>
            <FancyNormalRows
              sectionKey="sessions"
              rows={sessionsFancyRows}
              sportName={sportName}
              placeBetGameId={placeBetGameId}
              eventNameForBets={eventNameForBets}
              seriesName={params.seriesName}
              selectedElementId={selectedBet?.elementId ?? null}
              onSelectBet={onSelectBet}
              betSlipBelow={betSlipBelow}
            />
          </MarketBlock>
        ) : null}

        {isCricket && wpFancyRows.length > 0 ? (
          <MarketBlock icon="📌" title="W/P MARKET" minMax={formatMinMaxLabel(matchPayload as any)}>
            <FancyNormalRows
              sectionKey="wp"
              rows={wpFancyRows}
              sportName={sportName}
              placeBetGameId={placeBetGameId}
              eventNameForBets={eventNameForBets}
              seriesName={params.seriesName}
              selectedElementId={selectedBet?.elementId ?? null}
              onSelectBet={onSelectBet}
              betSlipBelow={betSlipBelow}
            />
          </MarketBlock>
        ) : null}

        {isCricket && extraFancyRows.length > 0 ? (
          <MarketBlock icon="➕" title="EXTRA MARKET" minMax={formatMinMaxLabel(matchPayload as any)}>
            <FancyNormalRows
              sectionKey="extra"
              rows={extraFancyRows}
              sportName={sportName}
              placeBetGameId={placeBetGameId}
              eventNameForBets={eventNameForBets}
              seriesName={params.seriesName}
              selectedElementId={selectedBet?.elementId ?? null}
              onSelectBet={onSelectBet}
              betSlipBelow={betSlipBelow}
            />
          </MarketBlock>
        ) : null}

        {isCricket && oddEvenFancyRows.length > 0 ? (
          <MarketBlock icon="🔢" title="ODD/EVEN" minMax={formatMinMaxLabel(matchPayload as any)}>
            <FancyNormalRows
              sectionKey="odd_even"
              rows={oddEvenFancyRows}
              sportName={sportName}
              placeBetGameId={placeBetGameId}
              eventNameForBets={eventNameForBets}
              seriesName={params.seriesName}
              selectedElementId={selectedBet?.elementId ?? null}
              onSelectBet={onSelectBet}
              betSlipBelow={betSlipBelow}
            />
          </MarketBlock>
        ) : null}

        {isCricket
          ? backOnlyFancyBlocks.map((block: BackOnlyFancyBlock) => (
            <MarketBlock
              key={`bo-${block.key}`}
              icon="📋"
              title={block.title}
              minMax={block.minMax}
              columns="backOnly"
            >
              <BackOnlyRows
                blockKey={block.key}
                market={block.market}
                sportName={sportName}
                placeBetGameId={placeBetGameId}
                eventNameForBets={eventNameForBets}
                seriesName={params.seriesName}
                rows={block.rows}
                selectedElementId={selectedBet?.elementId ?? null}
                onSelectBet={onSelectBet}
                betSlipBelow={betSlipBelow}
              />
            </MarketBlock>
          ))
          : null}
      </ScrollView>

    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#040f21' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: '#060d18',
    borderBottomWidth: 0.7,
    borderBottomColor: '#1c2f4a',
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  backText: { color: '#93C5FD', fontFamily: AppFonts.montserratSemiBold, fontSize: 14 },
  topSport: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 14, textTransform: 'capitalize' },
  scrollInner: { paddingBottom: 16 },
  hero: { height: 160, width: '100%' },
  heroImg: { opacity: 0.85 },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4,15,33,0.72)',
    padding: 14,
    justifyContent: 'flex-end',
  },
  heroTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 16 },
  heroSub: { color: '#9CA3AF', fontFamily: AppFonts.montserratRegular, fontSize: 11, marginTop: 4 },
  liveTvBox: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e3a5f',
    minWidth: 120,
  },
  liveTvTitle: { color: '#E5E7EB', fontFamily: AppFonts.montserratBold, fontSize: 11 },
  liveTvHint: { color: '#6B7280', fontFamily: AppFonts.montserratRegular, fontSize: 9, marginTop: 2 },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#060d18',
    borderBottomWidth: 0.7,
    borderBottomColor: '#1c2f4a',
  },
  tabMarkets: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabMarketsText: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 12 },
  openBets: { color: '#E5E7EB', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  center: { padding: 24, alignItems: 'center' },
  hint: { color: '#9CA3AF', fontFamily: AppFonts.montserratRegular, fontSize: 12, marginTop: 8 },
  marketCard: {
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 0.7,
    borderColor: '#1c2f4a',
    backgroundColor: '#0f172a',
  },
  marketHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1e2a38',
    gap: 10,
  },
  marketTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  marketIcon: { fontSize: 16 },
  marketTitle: { color: '#FFFFFF', fontFamily: AppFonts.montserratBold, fontSize: 13, flex: 1 },
  marketLimits: {
    color: '#9CA3AF',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 10,
    maxWidth: '42%',
    textAlign: 'right',
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#1a2332',
    borderBottomWidth: 0.7,
    borderBottomColor: '#1c2f4a',
  },
  colMarket: {
    flex: 1.15,
    color: '#9CA3AF',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 10,
    paddingLeft: 4,
  },
  colGroup: {
    flex: 1,
    textAlign: 'center',
    color: '#BAE6FD',
    fontFamily: AppFonts.montserratBold,
    fontSize: 10,
  },
  colGroupLay: {
    flex: 1,
    textAlign: 'center',
    color: '#FBCFE8',
    fontFamily: AppFonts.montserratBold,
    fontSize: 10,
  },
  runnerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 0.7,
    borderBottomColor: '#1c2f4a',
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 6,
    minHeight: 56,
    backgroundColor: '#1a2332'
  },
  backOnlyCellWrap: { flex: 2, minWidth: 0 },
  backOnlyLaySpacer: { flex: 1, minWidth: 0 },
  backOnlyOverlayCell: {
    backgroundColor: '#475569',
    justifyContent: 'center',
    minHeight: 52,
  },
  backOnlyOverlayText: {
    color: '#f1f5f9',
    fontFamily: AppFonts.montserratBold,
    fontSize: 10,
    textAlign: 'center',
  },
  runnerNameWrap: {
    flex: 1.15,
    justifyContent: 'center',
    paddingRight: 4,
    minWidth: 0,
  },
  runnerName: {
    color: '#F3F4F6',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 11,
    lineHeight: 15,
  },
  mobileOddsCell: {
    flex: 1,
    minHeight: 52,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  oddsPrice: { color: '#0f172a', fontFamily: AppFonts.montserratExtraBold, fontSize: 13 },
  oddsVol: { color: '#1e3a5f', fontFamily: AppFonts.montserratMedium, fontSize: 10, marginTop: 3 },
  lockText: { fontSize: 14 },
  ladderDash: { color: '#475569', fontFamily: AppFonts.montserratSemiBold, fontSize: 14 },
  emptyMarket: { padding: 16, alignItems: 'center' },
  emptyText: { color: '#6B7280', fontFamily: AppFonts.montserratRegular, fontSize: 12 },
  betSlipBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a1628',
    borderTopWidth: 0.7,
    borderTopColor: '#ffffff',
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  inlineBetSlipWrap: {
    borderTopWidth: 1,
    borderTopColor: '#2563eb',
    backgroundColor: '#0a1628',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 14,
    marginTop: 4,
    marginHorizontal: 2,
    borderBottomWidth: 0.7,
    borderBottomColor: '#1e3a5f',
  },
  inlineBetSlipWrapLay: {
    borderTopColor: LAY_PINK,
    borderTopWidth: 2,
  },
  slipTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  slipTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  slipTopIcon: { fontSize: 14 },
  slipTopTitle: { color: '#E5E7EB', fontFamily: AppFonts.montserratBold, fontSize: 13 },
  slipLimitsSmall: {
    color: '#9CA3AF',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 9,
    maxWidth: '48%',
    textAlign: 'right',
  },
  tableHeadSlip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: '#0c1524',
    borderRadius: 6,
    marginBottom: 6,
  },
  slipSelectionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    marginBottom: 10,
    minHeight: 48,
  },
  slipOddsGhost: { backgroundColor: BACK_BLUE, flex: 1, justifyContent: 'center' },
  slipOddsGhostLay: { backgroundColor: LAY_PINK, flex: 1, justifyContent: 'center' },
  slipFieldLabel: {
    color: '#9CA3AF',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 11,
    marginBottom: 4,
  },
  oddsStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
    borderWidth: 0.7,
    borderColor: '#1e3a5f',
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: '#F8FAFC', fontFamily: AppFonts.montserratBold, fontSize: 18 },
  stepMid: { color: '#FFF', fontFamily: AppFonts.montserratExtraBold, fontSize: 15 },
  stakeInput: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F3F4F6',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 14,
    borderWidth: 0.7,
    borderColor: '#1e3a5f',
    marginBottom: 10,
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  quickBtn: {
    width: '22%',
    minWidth: '21%',
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickBtnText: { color: '#E5E7EB', fontFamily: AppFonts.montserratSemiBold, fontSize: 10 },
  utilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  utilBtn: { flex: 1, minWidth: '22%', paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  utilBtnText: { color: '#0f172a', fontFamily: AppFonts.montserratBold, fontSize: 9 },
  summaryBlock: { marginBottom: 10 },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    color: '#E5E7EB',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 11,
    flex: 1,
    paddingRight: 8,
  },
  summaryProfit: { color: '#22c55e', fontFamily: AppFonts.montserratBold, fontSize: 12 },
  summaryTotal: { color: '#F97316', fontFamily: AppFonts.montserratBold, fontSize: 12 },
  slipError: {
    color: '#f87171',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 11,
    marginBottom: 8,
  },
  placeBetBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  placeBetBtnText: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 15 },
  cellSelectedBack: { borderTopWidth: 3, borderTopColor: '#0288d1' },
  cellSelectedLay: { borderTopWidth: 3, borderTopColor: '#ad1457' },
  betSlipTitle: { color: '#F97316', fontFamily: AppFonts.montserratBold, fontSize: 14 },
  betSlipHint: { color: '#9CA3AF', fontFamily: AppFonts.montserratRegular, fontSize: 11, marginTop: 4 },
})

export default MatchDetailScreen
