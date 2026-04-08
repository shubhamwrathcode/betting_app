import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
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
import {
  formatTimeOnlyIST,
  getDayGroupIST,
  resolveEventTimeForIndiaDisplay,
} from '../../utils/matchTimeIST'

type SportTab = 'cricket' | 'tennis' | 'soccer' | 'sportsbook'
type TabId = SportTab
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

// --- Helper Functions ---

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
  if (!s) return { line1: '—', line2: '' }
  const parts = s.split(/\s+(?:vs|v)\s+/i).map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2) return { line1: parts[0], line2: parts.slice(1).join(' v ') }
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

// --- Local time formatters removed in favor of matchTimeIST ---

const hasTag = (match: MatchItem, tag: string) => {
  const badges = Array.isArray(match?.marketBadges) ? match.marketBadges.join(' ') : ''
  const mk = Array.isArray(match?.markets)
    ? match.markets.map((x: any) => `${x?.marketName ?? ''} ${x?.market ?? ''}`).join(' ')
    : ''
  const hay = `${badges} ${mk} ${match?.seriesName ?? ''} ${match?.series_name ?? ''} ${match?.eventName ?? ''} ${match?.event_name ?? ''
    } ${match?.name ?? ''} ${match?.teams ?? ''} ${match?.category ?? ''} ${match?.Category ?? ''}`.toLowerCase()
  return hay.includes(tag)
}

const filterList = (list: MatchItem[], mode: SportsFilter) => {
  if (mode === 'live') return list.filter(isLiveMatch)
  if (mode === 'virtual') return list.filter(m => hasTag(m, 'virtual'))
  if (mode === 'premium') return list.filter(m => hasTag(m, 'premium'))
  return [...list]
}

const sortInPlayMatches = (list: MatchItem[]) => {
  return [...list].sort((a, b) => {
    const aLive = isLiveMatch(a);
    const bLive = isLiveMatch(b);
    if (aLive !== bLive) return aLive ? -1 : 1;
    const dateA = resolveEventTimeForIndiaDisplay(a.eventTime || a.event_time || a.startTime) || 0;
    const dateB = resolveEventTimeForIndiaDisplay(b.eventTime || b.event_time || b.startTime) || 0;
    return dateA - dateB;
  })
}

// --- Optimized Atomic UI Components (Ported from LandingPage) ---

const OddsCell = memo(({ side, pair, isLast }: { side: 'back' | 'lay'; pair: LandingOddsPairColumn | null; isLast?: boolean }) => {
  const raw = pair ? (side === 'back' ? pair.back : pair.lay) : null
  const sz = pair ? (side === 'back' ? pair.backSize : pair.laySize) : null
  const ok = raw != null && raw !== '—' && landingOddsValid(raw)
  const bg = ok ? (side === 'back' ? '#a7d8fd' : '#f9c9d4') : side === 'back' ? '#d4ecfe' : '#fce4ea'

  return (
    <View style={[styles.oddsCell, { width: ODDS_CELL_W, backgroundColor: bg }, isLast && styles.oddsCellLast]}>
      {ok ? (
        <>
          <Text style={styles.oddsPrice}>{String(raw)}</Text>
          {sz != null && sz !== '—' && String(sz).trim() !== '' && String(sz) !== '0.00' ? (
            <Text style={styles.oddsVol}>{String(sz)}</Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.oddsDash}>-</Text>
      )}
    </View>
  )
}, (prev, next) => {
  const pPair = prev.pair;
  const nPair = next.pair;
  if (!pPair || !nPair) return pPair === nPair && prev.isLast === next.isLast && prev.side === next.side;
  const pRaw = prev.side === 'back' ? pPair.back : pPair.lay;
  const nRaw = next.side === 'back' ? nPair.back : nPair.lay;
  const pSz = prev.side === 'back' ? pPair.backSize : pPair.laySize;
  const nSz = next.side === 'back' ? nPair.backSize : nPair.laySize;
  return pRaw === nRaw && pSz === nSz && prev.isLast === next.isLast;
})

const InPlayTeamRow = memo(({ row, eventTime, leftW, metaW, onPress }: { row: MatchItem, eventTime: any, leftW: number, metaW: number, onPress: () => void }) => {
  const timeVal = eventTime
  const pills = marketPillCodesForRow(row)
  const { line1, line2 } = splitEventTitleLines(row.eventName || row.event_name || row.name || row.teams)

  return (
    <Pressable style={[styles.matchRow, { minHeight: ROW_H, width: leftW }]} onPress={onPress}>
      <View style={[styles.matchMeta, { width: metaW }]}>
        {isLiveMatch(row) ? <Text style={styles.liveMini}>LIVE</Text> : null}
        <Text style={styles.dayText} numberOfLines={1}>{getDayGroupIST(timeVal) || 'Today'}</Text>
        <Text style={styles.clockText} numberOfLines={1}>{formatTimeOnlyIST(timeVal) || '--:--'}</Text>
      </View>
      <View style={styles.matchTeamsBox}>
        <View style={styles.matchInfoTitleRow}>
          {pills.length > 0 && (
            <View style={styles.marketPillsRow}>
              {pills.map(p => (
                <View key={p} style={styles.marketPill}><Text style={styles.marketPillText}>{p}</Text></View>
              ))}
            </View>
          )}
        </View>
        <View>
          <Text style={styles.matchTeamsLine1} numberOfLines={line2 ? 2 : 3}>{line1}</Text>
          {line2 ? <Text style={styles.matchTeamsLine2} numberOfLines={2}>{line2}</Text> : null}
        </View>
      </View>
    </Pressable>
  )
}, (prev, next) => {
  return prev.row.gameId === next.row.gameId &&
    prev.row.eventName === next.row.eventName &&
    isLiveMatch(prev.row) === isLiveMatch(next.row) &&
    prev.eventTime === next.eventTime;
})

const InPlayOddsRow = memo(({ stripCols, maxCols, h }: { stripCols: LandingOddsPairColumn[], maxCols: number, h?: number }) => {
  return (
    <View style={[styles.oddsRow, { minHeight: ROW_H, height: h }]}>
      <View style={styles.oddsStripRowHorizontal}>
        {Array.from({ length: maxCols }, (_, i) => (
          <OddsCell key={`b-${i}`} side="back" pair={stripCols[i] ?? null} />
        ))}
        {Array.from({ length: maxCols }, (_, i) => (
          <OddsCell key={`l-${i}`} side="lay" pair={stripCols[i] ?? null} isLast={i === maxCols - 1} />
        ))}
      </View>
    </View>
  )
}, (prev, next) => {
  if (prev.maxCols !== next.maxCols || prev.stripCols.length !== next.stripCols.length || prev.h !== next.h) return false;
  for (let i = 0; i < prev.stripCols.length; i++) {
    const p = prev.stripCols[i];
    const n = next.stripCols[i];
    if (!p || !n) { if (p !== n) return false; continue; }
    if (p.back !== n.back || p.lay !== n.lay || p.backSize !== n.backSize || p.laySize !== n.laySize) return false;
  }
  return true;
})

// --- Main Screen ---

const InPlayScreen = () => {
  const navigation = useNavigation<any>()
  const { isAuthenticated } = useAuth()
  const sliderRef = useRef<FlatList<any> | null>(null)
  const bannerWidth = Math.max(260, Dimensions.get('window').width - 24)

  const [activeTab, setActiveTab] = useState<SportTab>('cricket')

  useEffect(() => {
    if (activeTab === 'sportsbook') {
      navigation.navigate('MainTabs', { screen: 'SportsBook' });
      // Reset back to cricket so if they come back to InPlay, it shows cricket
      setTimeout(() => setActiveTab('cricket'), 500);
    }
  }, [activeTab, navigation]);
  const [sportsFilter, setSportsFilter] = useState<SportsFilter>('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({})

  // Buffers for Socket Data (Mirroring LandingPage)
  const cricketRef = useRef<MatchItem[]>([])
  const tennisRef = useRef<MatchItem[]>([])
  const soccerRef = useRef<MatchItem[]>([])
  const [cricketMatches, setCricketMatches] = useState<MatchItem[]>([])
  const [tennisMatches, setTennisMatches] = useState<MatchItem[]>([])
  const [soccerMatches, setSoccerMatches] = useState<MatchItem[]>([])

  // 1. Throttled State Update (Every 1.2s)
  useEffect(() => {
    const interval = setInterval(() => {
      setCricketMatches(prev => (cricketRef.current !== prev ? cricketRef.current : prev));
      setTennisMatches(prev => (tennisRef.current !== prev ? tennisRef.current : prev));
      setSoccerMatches(prev => (soccerRef.current !== prev ? soccerRef.current : prev));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    subscribeMatchDataLandingAll()
    const remove = addMatchDataListener((kind, payload) => {
      if (kind === 'error') return;
      const { sportName, matches } = normalizeMatchDataUpdatePayload(payload)
      if (!sportName || !Array.isArray(matches)) return
      let key = sportName.toLowerCase()
      if (key === 'football') key = 'soccer'
      if (key !== 'cricket' && key !== 'tennis' && key !== 'soccer') return

      const label = key === 'cricket' ? 'Cricket' : key === 'tennis' ? 'Tennis' : 'Football'
      const mapped = matches.filter(r => r && typeof r === 'object').map((r: any) => {
        const gid = String(r.gameId ?? r.eventId ?? '')
        const rawTime = pickMatchEventTime(r)
        const et = resolveEventTimeForIndiaDisplay(rawTime)
        return {
          gameId: gid || undefined, eventId: gid || undefined,
          eventName: r.eventName ?? r.event_name ?? r.name ?? r.teams ?? '—',
          event_name: r.event_name ?? r.eventName ?? r.name ?? r.teams ?? '—',
          name: r.name ?? r.eventName ?? r.event_name ?? r.teams ?? '—',
          teams: typeof r.teams === 'string' ? r.teams : undefined,
          eventTime: et ?? undefined, event_time: et ?? undefined,
          inPlay: !!(r.inPlay ?? r.in_play), in_play: !!(r.in_play ?? r.inPlay),
          seriesName: r.seriesName ?? r.series_name ?? label,
          series_name: r.series_name ?? r.seriesName ?? label,
          matchOdds: Array.isArray(r.matchOdds) ? r.matchOdds : [],
          marketFlags: { MO: !!r.MO, BM: !!r.BM, OM: !!r.OM, FO: !!r.FO, PF: !!r.PF },
          marketBadges: r.marketBadges ?? r.market_badges,
          markets: r.markets,
          category: r.category ?? r.Category,
        }
      }).filter(m => m.gameId).slice(0, 50)

      if (key === 'cricket') cricketRef.current = mapped as any[];
      else if (key === 'tennis') tennisRef.current = mapped as any[];
      else soccerRef.current = mapped as any[];
      setLoading(false);
    })
    return () => { remove(); unsubscribeMatchDataLandingAll(); }
  }, [])

  // REST Prefetch - Now non-blocking, updates sports as they arrive
  useEffect(() => {
    let mounted = true
    const loadSport = async (sport: 'Cricket' | 'Tennis' | 'Soccer') => {
      try {
        let data: any[] = []
        if (sport === 'Cricket') data = await sportsbookService.getCricketMatches()
        else if (sport === 'Tennis') data = await sportsbookService.getTennisMatches()
        else data = await sportsbookService.getSoccerMatches()

        if (!mounted) return
        if (sport === 'Cricket') {
          cricketRef.current = data
          setCricketMatches(data)
        } else if (sport === 'Tennis') {
          tennisRef.current = data
          setTennisMatches(data)
        } else {
          soccerRef.current = data
          setSoccerMatches(data)
        }
      } catch (err) {
        console.warn(`[InPlayScreen] Failed to fetch ${sport} matches:`, err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadSport('Cricket')
    loadSport('Tennis')
    loadSport('Soccer')

    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setCurrentSlide(prev => (prev + 1) % BANNERS.length), 5000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { sliderRef.current?.scrollToIndex({ index: currentSlide, animated: true }) }, [currentSlide])

  const activeMatches = useMemo(() => {
    const list = activeTab === 'tennis' ? tennisMatches : activeTab === 'soccer' ? soccerMatches : cricketMatches
    const base = filterList(list, sportsFilter)
    return sortInPlayMatches(base)
  }, [activeTab, sportsFilter, cricketMatches, tennisMatches, soccerMatches])

  const onOpenSportsbookMatch = useCallback((match: MatchItem) => {
    const sportNav = activeTab === 'soccer' ? 'soccer' : activeTab
    navigation.navigate('MatchDetail', {
      sportName: sportNav,
      gameId: match.gameId, eventId: match.eventId,
      eventName: match.eventName ?? match.event_name ?? match.name,
      seriesName: match.seriesName ?? match.series_name,
    })
  }, [navigation, activeTab])

  const rowsPrep = useMemo(() => {
    return activeMatches.map((row, idx) => {
      const eventTime = resolveEventTimeForIndiaDisplay(row.eventTime ?? row.event_time ?? row.startTime)
      const oddsPayload = Array.isArray(row.matchOdds) && row.matchOdds.length > 0 ? { matchOdds: row.matchOdds } : null
      const stripCols = getLandingOddsStripColumns(
        { ...row, teams: row.teams ?? row.eventName ?? row.event_name ?? row.name },
        oddsPayload, LANDING_STRIP_MAX_COLS
      )
      const rowKey = `${activeTab}-${row.eventId ?? row.gameId ?? idx}`
      return { row, eventTime, stripCols, rowKey }
    })
  }, [activeMatches, activeTab])

  const maxCols = useMemo(() => Math.max(1, ...rowsPrep.map(r => r.stripCols.length)), [rowsPrep]);
  const stripPx = useMemo(() => maxCols * ODDS_CELL_W * 2, [maxCols]);
  const winW = useMemo(() => Dimensions.get('window').width, []);
  const leftW = useMemo(() => Math.min(270, Math.round(winW * 0.58)), [winW]);
  const metaW = 76;

  const renderMatchRow = useCallback(({ item }: { item: any }) => {
    const { row, eventTime, stripCols, rowKey } = item;
    return (
      <View style={styles.combinedRow}>
        <InPlayTeamRow
          row={row}
          eventTime={eventTime}
          leftW={leftW}
          metaW={metaW}
          onPress={() => onOpenSportsbookMatch(row)}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ width: stripPx }}
        >
          <InPlayOddsRow stripCols={stripCols} maxCols={maxCols} />
        </ScrollView>
      </View>
    );
  }, [leftW, metaW, onOpenSportsbookMatch, stripPx, maxCols]);

  const renderHeader = () => (
    <>
      <View style={styles.bannerWrap}>
        <FlatList
          ref={sliderRef} data={BANNERS} horizontal pagingEnabled bounces={false}
          showsHorizontalScrollIndicator={false} style={{ width: bannerWidth, alignSelf: 'center' }}
          keyExtractor={(_, i) => `sports-banner-${i}`}
          getItemLayout={(_, index) => ({ length: bannerWidth, offset: bannerWidth * index, index })}
          renderItem={({ item }) => (
            <View style={[styles.bannerSlide, { width: bannerWidth }]}>
              <Image source={item} style={[styles.bannerImage, { width: bannerWidth }]} resizeMode="cover" />
            </View>
          )}
        />
        <View style={styles.dots}>
          {BANNERS.map((_, i) => (
            <Pressable key={i} style={[styles.dot, currentSlide === i && styles.dotActive]} onPress={() => setCurrentSlide(i)} />
          ))}
        </View>
      </View>

      <FlatList
        data={TABS} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isSportsbook = item.id === 'sportsbook'
          const isActive = !isSportsbook && activeTab === item.id
          return (
            <Pressable style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(item.id)}>
              <View style={styles.tabIconWrap}>
                {item.id === 'cricket' ? <CricketIcon width={16} height={16} /> :
                  item.id === 'tennis' ? <TennisIcon width={16} height={16} /> :
                    item.id === 'sportsbook' ? <SportsbookIcon width={16} height={16} /> :
                      <Image source={ImageAssets.football} style={styles.tabIcon} resizeMode="contain" />}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{item.label}</Text>
            </Pressable>
          )
        }}
      />

      <View style={styles.sectionHead}>
        <View style={styles.sectionTitleWrap}>
          <View style={styles.sectionIconWrap}>
            {activeTab === 'tennis' ? <TennisIcon width={16} height={16} /> :
              activeTab === 'soccer' ? <Image source={ImageAssets.football} style={styles.sectionIcon} resizeMode="contain" /> :
                <CricketIcon width={16} height={16} />}
          </View>
          <Text style={styles.sectionTitle}>{activeTab === 'cricket' ? 'Cricket' : activeTab === 'tennis' ? 'Tennis' : 'Football'}</Text>
        </View>
        <View style={styles.filtersRow}>
          {FILTERS.map(f => (
            <Pressable key={f.id} style={[styles.filterBtn, sportsFilter === f.id && styles.filterBtnActive]}
              onPress={() => setSportsFilter(prev => (prev === f.id ? '' : f.id))}>
              <Text style={[styles.filterText, sportsFilter === f.id && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <LandingHeader
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />

      {loading && activeMatches.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#2E90FA" />
          <Text style={styles.stateText}>Loading matches...</Text>
        </View>
      ) : (
        <FlatList
          data={rowsPrep}
          renderItem={renderMatchRow}
          keyExtractor={item => item.rowKey}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={() => (
            <View style={styles.centerState}>
              <Text style={styles.stateText}>No matches available</Text>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040f21' },
  content: { paddingHorizontal: 12, paddingBottom: 90 },
  bannerWrap: { marginVertical: 10 },
  bannerSlide: { justifyContent: 'center' },
  bannerImage: { height: 250, borderRadius: 16, backgroundColor: '#0B162A' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  dot: { width: 9, height: 9, borderRadius: 6, backgroundColor: '#4B5B72' },
  dotActive: { width: 20, backgroundColor: '#2E90FA' },
  tabsRow: { marginTop: 14, gap: 8, paddingRight: 6 },
  tabBtn: {
    minWidth: 102, height: 42, borderRadius: 20, backgroundColor: '#2B3950',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 10,
  },
  tabBtnActive: { backgroundColor: '#E07B34' },
  tabIconWrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { width: 16, height: 16, tintColor: '#fff' },
  tabLabel: { color: '#DCE7F6', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  tabLabelActive: { color: '#FFF' },
  sectionHead: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIconWrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  sectionIcon: { width: 16, height: 16, tintColor: '#D8E4F5' },
  sectionTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 14 },
  filtersRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 },
  filterBtn: {
    height: 30, borderRadius: 8, borderWidth: 1, borderColor: '#31405B',
    backgroundColor: '#1A2337', paddingHorizontal: 10, justifyContent: 'center',
  },
  filterBtnActive: { borderColor: '#F1A44F', backgroundColor: '#3A2A1C' },
  filterText: { color: '#AFC0D9', fontFamily: AppFonts.montserratMedium, fontSize: 11 },
  filterTextActive: { color: '#FFD2A6' },
  centerState: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  stateText: { color: '#9FB0C9', fontFamily: AppFonts.montserratRegular, fontSize: 12 },
  listWrap: { marginTop: 12 },
  combinedRow: { flexDirection: 'row', alignItems: 'stretch' },
  matchBlockRow: { flexDirection: 'row', alignItems: 'flex-start' },
  matchLeftCol: { flexShrink: 0 },
  oddsOnlyHScrollInner: { flexGrow: 0, paddingRight: 1 },
  oddsOnlyCol: { flexDirection: 'column' },
  oddsRow: { backgroundColor: '#0b1620', borderBottomWidth: 0.7, borderBottomColor: '#ffffff', alignItems: 'stretch' },
  matchRow: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#11161c', borderBottomWidth: 0.7, borderBottomColor: '#1c2f4a' },
  matchMeta: { paddingVertical: 8, paddingHorizontal: 6, justifyContent: 'flex-end', borderRightWidth: 0.8, borderRightColor: "#1c2f4a" },
  matchTeamsBox: { flex: 1, minWidth: 0, paddingVertical: 6, paddingHorizontal: 6, justifyContent: 'flex-end' },
  matchInfoTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 4, marginBottom: 4 },
  matchTeamsLine1: { color: '#FFFFFF', fontSize: 11, fontFamily: AppFonts.montserratSemiBold, lineHeight: 16 },
  matchTeamsLine2: { color: '#FFFFFF', fontSize: 11, fontFamily: AppFonts.montserratSemiBold, lineHeight: 16, marginTop: 2 },
  marketPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  marketPill: {
    backgroundColor: '#374151', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#6B7280',
  },
  marketPillText: { color: '#F9FAFB', fontSize: 8, fontFamily: AppFonts.montserratSemiBold },
  liveMini: {
    backgroundColor: '#E53935', color: '#FFF', borderRadius: 3,
    paddingVertical: 1, paddingHorizontal: 5, alignSelf: 'flex-start',
    fontFamily: AppFonts.montserratBold, fontSize: 8, marginBottom: 3, overflow: 'hidden',
  },
  dayText: { color: '#D4DEEE', fontFamily: AppFonts.montserratRegular, fontSize: 10, },
  clockText: { color: '#D4DEEE', fontFamily: AppFonts.montserratMedium, fontSize: 10, marginTop: 2 },
  oddsStripRowHorizontal: { flex: 1, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'stretch' },
  oddsCell: { alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#ffffff' },
  oddsCellLast: { borderRightWidth: 0 },
  oddsPrice: { color: '#0f172a', fontSize: 12, fontFamily: AppFonts.montserratBold },
  oddsVol: { color: '#1e3a5f', fontSize: 9, fontFamily: AppFonts.montserratRegular, marginTop: 2 },
  oddsDash: { color: '#475569', fontSize: 14, fontFamily: AppFonts.montserratSemiBold },
})

export default InPlayScreen
