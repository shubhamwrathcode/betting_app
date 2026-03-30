import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { LandingHeader } from '../../components/common/LandingHeader'
import { useAuth } from '../../hooks/useAuth'
import { AppFonts } from '../../components/AppFonts'
import { ImageAssets } from '../../components/ImageAssets'
import CricketIcon from '../../../assets/AppImages/menu-icon19.svg'
import TennisIcon from '../../../assets/AppImages/menu-icon20.svg'
import SportsbookIcon from '../../../assets/AppImages/sports_icon.svg'
import { sportsbookService } from '../../services/sportsbookService'
import {
  computeTop1x2Cells,
  getLandingOddsStripColumns,
  landingOddsValid,
  type LandingOddsPairColumn,
} from '../../utils/sportsGameOdds'
import {
  addMatchDataListener,
  normalizeMatchDataUpdatePayload,
  subscribeMatchDataLandingAll,
  unsubscribeMatchDataLandingAll,
} from '../../socket/matchDataSocket'
import { normalizeMatchDataEventTime, pickMatchEventTime } from '../../utils/matchDataNormalize'

type SportTab = 'cricket' | 'tennis' | 'soccer'
type TabId = SportTab | 'sportsbook'
type SportsFilter = '' | 'live' | 'virtual' | 'premium'
type MatchItem = {
  eventId?: string
  gameId?: string
  eventName?: string
  event_name?: string
  name?: string
  teams?: string
  eventTime?: string
  event_time?: string
  startTime?: string
  seriesName?: string
  series_name?: string
  inPlay?: boolean
  in_play?: boolean
  isLive?: boolean
  status?: string
  matchStatus?: string
  selections?: Array<any>
  matchOdds?: any[]
  matchOddsResponseDTO?: any[]
  match_odds?: any[]
  marketBadges?: any[]
  markets?: any[]
  category?: any
  Category?: any
}

const BANNERS = [ImageAssets.sportsBnrMobile2Jpg, ImageAssets.sportsBnrMobileJpg, ImageAssets.sportsBnrMobile3Jpg]
const ODDS_CELL_W = 56
const LANDING_STRIP_MAX_COLS = 12
const ROW_H = 76

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'cricket', label: 'Cricket', icon: ImageAssets.menuIcon19Svg },
  { id: 'tennis', label: 'Tennis', icon: ImageAssets.menuIcon20Svg },
  { id: 'soccer', label: 'Football', icon: ImageAssets.football },
  { id: 'sportsbook', label: 'Sportsbook', icon: ImageAssets.bookopenfill },
]

const FILTERS: Array<{ id: SportsFilter; label: string }> = [
  { id: 'live', label: '+ Live' },
  { id: 'virtual', label: '+ Virtual' },
  { id: 'premium', label: '+ Premium' },
]

const isLiveMatch = (m: MatchItem) =>
  !!(
    m.inPlay ||
    m.in_play ||
    m.isLive ||
    (m.status && String(m.status).toLowerCase() === 'live') ||
    (m.matchStatus && String(m.matchStatus).toLowerCase().includes('live'))
  )

const splitEventTitleLines = (raw: unknown) => {
  const s = String(raw ?? '').trim()
  if (!s) return { line1: '', line2: '' }
  const parts = s
    .split(/\s+(?:vs|v)\s+/i)
    .map(p => p.trim())
    .filter(Boolean)
  if (parts.length >= 2) return { line1: parts[0], line2: parts.slice(1).join(' v ') }
  const chunks = s.split(/\s{2,}|\n+/).map(x => x.trim()).filter(Boolean)
  if (chunks.length >= 2) return { line1: chunks[0], line2: chunks.slice(1).join(' ') }
  return { line1: s, line2: '' }
}

const marketPillCodesForRow = (row: MatchItem): string[] => {
  const f: any = (row as any).marketFlags
  if (!f || typeof f !== 'object') return []
  const out: string[] = []
  if (f.MO) out.push('MO')
  if (f.BM) out.push('BM')
  if (f.FO) out.push('F')
  if (f.OM) out.push('OM')
  if (f.PF) out.push('P')
  return out
}

const formatTime = (raw?: string) => {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

const formatTimeOnly = (raw?: string) => {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
}

const getDayGroup = (raw?: string) => {
  if (!raw) return ''
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return ''
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return d.toLocaleDateString('en-IN', { weekday: 'long' })
  } catch {
    return ''
  }
}

const getRowOdds = (match: MatchItem) => {
  const matchOdds =
    (Array.isArray(match.matchOdds) && match.matchOdds) ||
    (Array.isArray(match.matchOddsResponseDTO) && match.matchOddsResponseDTO) ||
    (Array.isArray(match.match_odds) && match.match_odds) ||
    null
  const cells = computeTop1x2Cells(match, matchOdds ? { matchOdds } : null, landingOddsValid)
  const pick = (i: number) => {
    const c = cells[i]
    if (!c) return '—'
    const b = c.back?.price
    const l = c.lay?.price
    return b != null ? String(b) : l != null ? String(l) : '—'
  }
  return { one: pick(0), x: pick(1), two: pick(2) }
}

const hasTag = (match: MatchItem, tag: string) => {
  const badges = Array.isArray(match?.marketBadges) ? match.marketBadges.join(' ') : ''
  const mk = Array.isArray(match?.markets)
    ? match.markets.map((x: any) => `${x?.marketName ?? ''} ${x?.market ?? ''}`).join(' ')
    : ''
  const hay = `${badges} ${mk} ${match?.seriesName ?? ''} ${match?.series_name ?? ''} ${match?.eventName ?? ''} ${
    match?.event_name ?? ''
  } ${match?.name ?? ''} ${match?.teams ?? ''} ${match?.category ?? ''} ${match?.Category ?? ''}`.toLowerCase()
  return hay.includes(tag)
}

const filterList = (list: MatchItem[], mode: SportsFilter) => {
  if (mode === 'live') return list.filter(isLiveMatch)
  if (mode === 'virtual') return list.filter(m => hasTag(m, 'virtual'))
  if (mode === 'premium') return list.filter(m => hasTag(m, 'premium'))
  return [...list].sort((a, b) => (isLiveMatch(b) ? 1 : 0) - (isLiveMatch(a) ? 1 : 0))
}

const isPastTodayNonLive = (m: MatchItem, nowMs: number) => {
  if (isLiveMatch(m)) return false
  const raw = m.eventTime || m.event_time || m.startTime
  if (!raw || typeof raw !== 'string') return false
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  if (d.toDateString() !== today.toDateString()) return false
  return d.getTime() < nowMs
}

const dayGroupLabel = (isoStr?: string) => {
  if (!isoStr) return 'Other'
  try {
    const d = new Date(isoStr)
    if (Number.isNaN(d.getTime())) return 'Other'
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return d.toLocaleDateString('en-IN', { weekday: 'long' })
  } catch {
    return 'Other'
  }
}

const sortLiveTodayTomorrow = (list: MatchItem[]) => {
  const rank = (m: MatchItem) => {
    if (isLiveMatch(m)) return 0
    const raw = m.eventTime || m.event_time || m.startTime
    const g = dayGroupLabel(raw)
    if (g === 'Today') return 1
    if (g === 'Tomorrow') return 2
    return 3
  }
  const timeMs = (m: MatchItem) => {
    const raw = m.eventTime || m.event_time || m.startTime
    if (!raw || typeof raw !== 'string') return Number.MAX_SAFE_INTEGER
    const d = new Date(raw)
    const t = d.getTime()
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t
  }
  return [...list].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    const ta = timeMs(a)
    const tb = timeMs(b)
    if (ta !== tb) return ta - tb
    const ka = String(a.eventId ?? a.gameId ?? a.eventName ?? '')
    const kb = String(b.eventId ?? b.gameId ?? b.eventName ?? '')
    return ka.localeCompare(kb)
  })
}

const renderTabIcon = (id: TabId) => {
  if (id === 'cricket') return <CricketIcon width={16} height={16} />
  if (id === 'tennis') return <TennisIcon width={16} height={16} />
  if (id === 'sportsbook') return <SportsbookIcon width={16} height={16} />
  return <Image source={ImageAssets.football} style={styles.tabIcon} resizeMode="contain" />
}

const renderSectionIcon = (sport: SportTab) => {
  if (sport === 'tennis') return <TennisIcon width={16} height={16} />
  if (sport === 'soccer') return <Image source={ImageAssets.football} style={styles.sectionIcon} resizeMode="contain" />
  return <CricketIcon width={16} height={16} />
}

const InPlayScreen = () => {
  const navigation = useNavigation<any>()
  const { isAuthenticated } = useAuth()
  const sliderRef = useRef<FlatList<any> | null>(null)
  const bannerWidth = Math.max(260, Dimensions.get('window').width - 24)

  const [activeTab, setActiveTab] = useState<SportTab>('cricket')
  const [sportsFilter, setSportsFilter] = useState<SportsFilter>('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [loading, setLoading] = useState(false)
  const [cricketMatches, setCricketMatches] = useState<MatchItem[]>([])
  const [tennisMatches, setTennisMatches] = useState<MatchItem[]>([])
  const [soccerMatches, setSoccerMatches] = useState<MatchItem[]>([])
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({})

  useEffect(() => {
    // Web uses `/matchdata` socket for the Sports Game grid; mirror that in-app.
    subscribeMatchDataLandingAll()
    const remove = addMatchDataListener((kind, payload) => {
      if (kind === 'error') {
        setLoading(false)
        return
      }
      const { sportName, matches } = normalizeMatchDataUpdatePayload(payload)
      if (!sportName || !Array.isArray(matches)) return
      let key = sportName.toLowerCase()
      // Some deployments emit `football` instead of `soccer`.
      if (key === 'football') key = 'soccer'
      if (key !== 'cricket' && key !== 'tennis' && key !== 'soccer') return

      const label = key === 'cricket' ? 'Cricket' : key === 'tennis' ? 'Tennis' : 'Football'
      const next = (matches as any[])
        .filter(r => r && typeof r === 'object')
        .map((r: any) => {
          const gid = String(r.gameId ?? r.eventId ?? '')
          const rawTime = pickMatchEventTime(r)
          const et = rawTime != null ? normalizeMatchDataEventTime(rawTime) : null
          return {
            gameId: gid || undefined,
            eventId: gid || undefined,
            eventName: r.eventName ?? r.event_name ?? r.name ?? r.teams ?? '—',
            event_name: r.event_name ?? r.eventName ?? r.name ?? r.teams ?? '—',
            name: r.name ?? r.eventName ?? r.event_name ?? r.teams ?? '—',
            teams: typeof r.teams === 'string' ? r.teams : undefined,
            eventTime: et ?? undefined,
            event_time: et ?? undefined,
            inPlay: !!(r.inPlay ?? r.in_play),
            in_play: !!(r.in_play ?? r.inPlay),
            seriesName: r.seriesName ?? r.series_name ?? label,
            series_name: r.series_name ?? r.seriesName ?? label,
            marketId: r.marketId,
            matchOdds: Array.isArray(r.matchOdds) ? r.matchOdds : [],
            marketFlags: { MO: !!r.MO, BM: !!r.BM, OM: !!r.OM, FO: !!r.FO, PF: !!r.PF },
            marketBadges: r.marketBadges ?? r.market_badges,
            markets: r.markets,
            category: r.category ?? r.Category,
            Category: r.Category ?? r.category,
          } as MatchItem
        })
        .filter((m: any) => (m.eventId || m.gameId) && String(m.eventId || m.gameId).trim() !== '')
        .slice(0, 50) as MatchItem[]
      if (key === 'cricket') setCricketMatches(next)
      else if (key === 'tennis') setTennisMatches(next)
      else setSoccerMatches(next)
      setLoading(false)
    })
    return () => {
      remove()
      unsubscribeMatchDataLandingAll()
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % BANNERS.length)
    }, 5000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    sliderRef.current?.scrollToIndex({ index: currentSlide, animated: true })
  }, [currentSlide])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const [c, t, s] = await Promise.all([
          sportsbookService.getCricketMatches(),
          sportsbookService.getTennisMatches(),
          sportsbookService.getSoccerMatches(),
        ])
        if (!mounted) return
        setCricketMatches((c as any[]) as MatchItem[])
        setTennisMatches((t as any[]) as MatchItem[])
        setSoccerMatches((s as any[]) as MatchItem[])
      } catch {
        if (!mounted) return
        setCricketMatches([])
        setTennisMatches([])
        setSoccerMatches([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const activeMatches = useMemo(() => {
    const list =
      activeTab === 'tennis' ? tennisMatches : activeTab === 'soccer' ? soccerMatches : cricketMatches
    const nowMs = Date.now()
    const base = filterList(list, sportsFilter)
    const filtered = base.filter(m => !isPastTodayNonLive(m, nowMs))
    return sortLiveTodayTomorrow(filtered)
  }, [activeTab, sportsFilter, cricketMatches, tennisMatches, soccerMatches])

  const onOpenSportsbookMatch = (match: MatchItem) => {
    const sportNav = activeTab === 'soccer' ? 'soccer' : activeTab
    navigation.navigate('MatchDetail' as never, {
      sportName: sportNav,
      gameId: match.gameId,
      eventId: match.eventId,
      eventName: match.eventName ?? match.event_name ?? match.name,
      seriesName: match.seriesName ?? match.series_name,
    } as never)
  }

  const showVol = (sz: unknown) => sz != null && sz !== '—' && String(sz).trim() !== '' && String(sz) !== '0.00'

  const renderStripCell = (key: string, pair: LandingOddsPairColumn, side: 'back' | 'lay', isLast: boolean) => {
    const raw = pair ? (side === 'back' ? pair.back : pair.lay) : null
    const sz = pair ? (side === 'back' ? pair.backSize : pair.laySize) : null
    const ok = raw != null && raw !== '—' && landingOddsValid(raw)
    const bg = ok ? (side === 'back' ? '#a7d8fd' : '#f9c9d4') : side === 'back' ? '#d4ecfe' : '#fce4ea'
    return (
      <View key={key} style={[styles.oddsCell, { width: ODDS_CELL_W, backgroundColor: bg }, isLast && styles.oddsCellLast]}>
        {ok ? (
          <>
            <Text style={styles.oddsPrice}>{String(raw)}</Text>
            {showVol(sz) ? <Text style={styles.oddsVol}>{String(sz)}</Text> : null}
          </>
        ) : (
          <Text style={styles.oddsDash}>-</Text>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <LandingHeader
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.bannerWrap}>
          <FlatList
            ref={sliderRef}
            data={BANNERS}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            style={{ width: bannerWidth, alignSelf: 'center' }}
            keyExtractor={(_, i) => `sports-banner-${i}`}
            getItemLayout={(_, index) => ({
              length: bannerWidth,
              offset: bannerWidth * index,
              index,
            })}
            onMomentumScrollEnd={e => {
              const w = e.nativeEvent.layoutMeasurement.width
              const x = e.nativeEvent.contentOffset.x
              setCurrentSlide(Math.round(x / w))
            }}
            renderItem={({ item }) => (
              <View style={[styles.bannerSlide, { width: bannerWidth }]}>
                <Image source={item} style={[styles.bannerImage, { width: bannerWidth }]} resizeMode="cover" />
              </View>
            )}
          />
          <View style={styles.dots}>
            {BANNERS.map((_, i) => (
              <Pressable
                key={i}
                style={[styles.dot, currentSlide === i && styles.dotActive]}
                onPress={() => setCurrentSlide(i)}
              />
            ))}
          </View>
        </View>

        <FlatList
          data={TABS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const isSportsbook = item.id === 'sportsbook'
            const isActive = !isSportsbook && activeTab === item.id
            return (
              <Pressable
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() =>
                  isSportsbook
                    ? navigation.navigate('MainTabs', { screen: 'SportsBook' })
                    : setActiveTab(item.id as SportTab)
                }
              >
                <View style={styles.tabIconWrap}>{renderTabIcon(item.id)}</View>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{item.label}</Text>
              </Pressable>
            )
          }}
        />

        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleWrap}>
            <View style={styles.sectionIconWrap}>{renderSectionIcon(activeTab)}</View>
            <Text style={styles.sectionTitle}>
              {activeTab === 'cricket' ? 'Cricket' : activeTab === 'tennis' ? 'Tennis' : 'Football'}
            </Text>
          </View>
          <View style={styles.filtersRow}>
            {FILTERS.map(f => (
              <Pressable
                key={f.id}
                style={[styles.filterBtn, sportsFilter === f.id && styles.filterBtnActive]}
                onPress={() => setSportsFilter(prev => (prev === f.id ? '' : f.id))}
              >
                <Text style={[styles.filterText, sportsFilter === f.id && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#2E90FA" />
            <Text style={styles.stateText}>Loading matches...</Text>
          </View>
        ) : activeMatches.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>No matches available</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {(() => {
              const rowsPrep = activeMatches.map((row, idx) => {
                const eventTime = row.eventTime ?? row.event_time ?? row.startTime
                const oddsPayload = Array.isArray(row.matchOdds) && row.matchOdds.length > 0 ? { matchOdds: row.matchOdds } : null
                const stripCols = getLandingOddsStripColumns(
                  { ...row, teams: row.teams ?? row.eventName ?? row.event_name ?? row.name },
                  oddsPayload,
                  LANDING_STRIP_MAX_COLS,
                )
                const rowKey = `${activeTab}-${row.eventId ?? row.gameId ?? idx}`
                return { row, eventTime, stripCols, rowKey }
              })
              const maxCols = Math.max(1, ...rowsPrep.map(r => r.stripCols.length))
              const stripPx = maxCols * ODDS_CELL_W * 2
              const winW = Dimensions.get('window').width
              const leftW = Math.min(270, Math.round(winW * 0.58))
              return (
                <>
                  <View style={[styles.matchBlockRow, { width: winW }]}>
                    <View style={[styles.matchLeftCol, { width: leftW }]}>
                      {rowsPrep.map(({ row, eventTime, rowKey }) => {
                        const timeRaw = typeof eventTime === 'string' ? eventTime : undefined
                        const pills = marketPillCodesForRow(row)
                        const { line1, line2 } = splitEventTitleLines(row.eventName || row.event_name || row.name || row.teams)
                        return (
                          <Pressable
                            key={rowKey}
                            style={[styles.matchRow, { minHeight: ROW_H }]}
                            onPress={() => onOpenSportsbookMatch(row)}
                            onLayout={e => {
                              const h = e.nativeEvent.layout.height
                              setRowHeights(prev => (prev[rowKey] === h ? prev : { ...prev, [rowKey]: h }))
                            }}
                          >
                            <View style={styles.matchMeta}>
                              {isLiveMatch(row) ? <Text style={styles.liveMini}>LIVE</Text> : null}
                              <Text style={styles.dayText} numberOfLines={1}>
                                {getDayGroup(timeRaw) || 'Today'}
                              </Text>
                              <Text style={styles.clockText} numberOfLines={1}>
                                {formatTimeOnly(timeRaw)}
                              </Text>
                            </View>
                            <View style={styles.matchTeamsBox}>
                              <View style={styles.matchInfoTitleRow}>
                              
                                {pills.length > 0 ? (
                                  <View style={styles.marketPillsRow}>
                                    {pills.map(p => (
                                      <View key={p} style={styles.marketPill}>
                                        <Text style={styles.marketPillText}>{p}</Text>
                                      </View>
                                    ))}
                                  </View>
                                ) : null}
                              </View>
                              <Text style={styles.matchTeamsLine1} numberOfLines={line2 ? 2 : 3}>
                                {line1 || '—'}
                              </Text>
                              {line2 ? (
                                <Text style={styles.matchTeamsLine2} numberOfLines={2}>
                                  {line2}
                                </Text>
                              ) : null}
                            </View>
                          </Pressable>
                        )
                      })}
                    </View>

                    <ScrollView
                      horizontal
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsHorizontalScrollIndicator={false}
                      style={styles.oddsOnlyHScroll}
                      contentContainerStyle={[styles.oddsOnlyHScrollInner, { width: stripPx }]}
                    >
                      <View style={styles.oddsOnlyCol}>
                        {rowsPrep.map(({ stripCols, rowKey }) => (
                          <View
                            key={`${rowKey}-odds`}
                            style={[styles.oddsRow, { minHeight: ROW_H, height: rowHeights[rowKey] ?? undefined }]}
                          >
                            <View style={styles.oddsStripRowHorizontal}>
                              {Array.from({ length: maxCols }, (_, i) =>
                                renderStripCell(`${rowKey}-b-${i}`, stripCols[i] ?? null, 'back', false),
                              )}
                              {Array.from({ length: maxCols }, (_, i) =>
                                renderStripCell(
                                  `${rowKey}-l-${i}`,
                                  stripCols[i] ?? null,
                                  'lay',
                                  i === maxCols - 1,
                                ),
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </>
              )
            })()}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040f21' },
  content: { paddingHorizontal: 12, paddingBottom: 90, },
  bannerWrap: { marginVertical: 10 ,},
  bannerSlide: { justifyContent: 'center' },
  bannerImage: { height: 250, borderRadius: 16, backgroundColor: '#0B162A' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  dot: { width: 9, height: 9, borderRadius: 6, backgroundColor: '#4B5B72' },
  dotActive: { width: 20, backgroundColor: '#2E90FA' },
  tabsRow: { marginTop: 14, gap: 8, paddingRight: 6 },
  tabBtn: {
    minWidth: 102,
    height: 42,
    borderRadius: 20,
    backgroundColor: '#2B3950',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
  },
  tabBtnActive: { backgroundColor: '#E07B34' },
  tabIconWrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { width: 16, height: 16,tintColor:'#fff'},
  tabLabel: { color: '#DCE7F6', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  tabLabelActive: { color: '#FFF' },
  sectionHead: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIconWrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  sectionIcon: { width: 16, height: 16, tintColor: '#D8E4F5' },
  sectionTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 28 / 2 },
  filtersRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 },
  filterBtn: {
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#31405B',
    backgroundColor: '#1A2337',
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  filterBtnActive: { borderColor: '#F1A44F', backgroundColor: '#3A2A1C' },
  filterText: { color: '#AFC0D9', fontFamily: AppFonts.montserratMedium, fontSize: 11 },
  filterTextActive: { color: '#FFD2A6' },
  centerState: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  stateText: { color: '#9FB0C9', fontFamily: AppFonts.montserratRegular, fontSize: 12 },
  listWrap: { marginTop: 12, marginHorizontal: -12 },

  matchBlockRow: { flexDirection: 'row', alignItems: 'flex-start' },
  matchLeftCol: { flexShrink: 0 },
  oddsOnlyHScroll: { flex: 1 },
  oddsOnlyHScrollInner: { flexGrow: 0, paddingRight: 1 },
  oddsOnlyCol: { flexDirection: 'column' },
  oddsRow: {
    backgroundColor: '#0b1620',
    borderBottomWidth: 0.7,
    borderBottomColor: '#ffffff',
    alignItems: 'stretch',
  },

  matchRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#11161c',
    borderBottomWidth: 0.7,
    borderBottomColor: '#ffffff',
  },
  matchMeta: {

    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: 'flex-end',
    borderRightWidth:0.8,
    borderRightColor:"white"
  },
  matchTeamsBox: { flex: 1, minWidth: 0, paddingVertical: 6, paddingHorizontal: 6, justifyContent: 'flex-end' },
  matchInfoTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 4, marginBottom: 4 },
  matchLeague: { color: '#D1D5DB', fontSize: 11, fontFamily: AppFonts.montserratRegular, flex: 1, minWidth: 140 },
  matchTeamsLine1: { color: '#FFFFFF', fontSize: 11, fontFamily: AppFonts.montserratSemiBold, lineHeight: 16 },
  matchTeamsLine2: { color: '#FFFFFF', fontSize: 11, fontFamily: AppFonts.montserratSemiBold, lineHeight: 16, marginTop: 2 },
  marketPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  marketPill: {
    backgroundColor: '#374151',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#6B7280',
  },
  marketPillText: { color: '#F9FAFB', fontSize: 8, fontFamily: AppFonts.montserratSemiBold },

  liveMini: {
    backgroundColor: '#E53935',
    color: '#FFF',
    borderRadius: 3,
    textAlign: 'center',
    paddingVertical: 1,
    fontFamily: AppFonts.montserratBold,
    fontSize: 8,
    marginBottom: 3,
  },
  dayText: { color: '#D4DEEE', fontFamily: AppFonts.montserratRegular, fontSize: 10, textAlign: 'center' },
  clockText: {
    color: '#D4DEEE',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },

  oddsStripRowHorizontal: { flex: 1, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'stretch' },
  oddsCell: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
    margin: 0,
    borderRightWidth: 1,
    borderRightColor: '#ffffff',
  },
  oddsCellLast: { borderRightWidth: 0 },
  oddsPrice: { color: '#0f172a', fontSize: 12, fontFamily: AppFonts.montserratExtraBold },
  oddsVol: { color: '#1e3a5f', fontSize: 9, fontFamily: AppFonts.montserratRegular, marginTop: 2 },
  oddsDash: { color: '#475569', fontSize: 14, fontFamily: AppFonts.montserratSemiBold },
})

export default InPlayScreen
