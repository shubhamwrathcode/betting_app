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
import { API_ENDPOINTS } from '../../api/endpoints'
import { apiClient } from '../../api/client'
import CricketIcon from '../../../assets/AppImages/menu-icon19.svg'
import TennisIcon from '../../../assets/AppImages/menu-icon20.svg'
import SportsbookIcon from '../../../assets/AppImages/sports_icon.svg'

type SportTab = 'cricket' | 'tennis' | 'soccer'
type TabId = SportTab | 'sportsbook'
type SportsFilter = 'all' | 'live' | 'virtual' | 'premium'
type MatchItem = {
  eventId?: string
  gameId?: string
  eventName?: string
  event_name?: string
  name?: string
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
}

const BANNERS = [ImageAssets.sportsBnrMobile2Jpg, ImageAssets.sportsBnrMobileJpg, ImageAssets.sportsBnrMobile3Jpg]

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'cricket', label: 'Cricket', icon: ImageAssets.menuIcon19Svg },
  { id: 'tennis', label: 'Tennis', icon: ImageAssets.menuIcon20Svg },
  { id: 'soccer', label: 'Football', icon: ImageAssets.football },
  { id: 'sportsbook', label: 'Sportsbook', icon: ImageAssets.bookopenfill },
]

const FILTERS: Array<{ id: SportsFilter; label: string }> = [
  { id: 'all', label: 'All' },
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

const getOddsRows = (match: MatchItem) => {
  const rows = Array.isArray(match.selections) ? match.selections.slice(0, 3) : []
  return rows.map(sel => ({
    name: String(sel?.selectionName || sel?.name || '-'),
    back: sel?.b1 ?? sel?.back1 ?? sel?.back?.[0]?.price ?? null,
    lay: sel?.l1 ?? sel?.lay1 ?? sel?.lay?.[0]?.price ?? null,
  }))
}

const getRowOdds = (match: MatchItem) => {
  const rows = getOddsRows(match)
  const first = rows[0]
  const second = rows[1]
  const third = rows[2]
  return {
    one: first?.back ?? first?.lay ?? '—',
    x: second?.back ?? second?.lay ?? '—',
    two: third?.back ?? third?.lay ?? '—',
  }
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
  const [sportsFilter, setSportsFilter] = useState<SportsFilter>('all')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [loading, setLoading] = useState(false)
  const [cricketMatches, setCricketMatches] = useState<MatchItem[]>([])
  const [tennisMatches, setTennisMatches] = useState<MatchItem[]>([])
  const [soccerMatches, setSoccerMatches] = useState<MatchItem[]>([])

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
          apiClient<any>(API_ENDPOINTS.sportsbookCricketMatches, { skipAuth: true }),
          apiClient<any>(API_ENDPOINTS.sportsbookTennisMatches, { skipAuth: true }),
          apiClient<any>(API_ENDPOINTS.sportsbookSoccerMatches, { skipAuth: true }),
        ])
        if (!mounted) return
        setCricketMatches(Array.isArray(c?.data?.matches) ? c.data.matches : Array.isArray(c?.matches) ? c.matches : [])
        setTennisMatches(Array.isArray(t?.data?.matches) ? t.data.matches : Array.isArray(t?.matches) ? t.matches : [])
        setSoccerMatches(Array.isArray(s?.data?.matches) ? s.data.matches : Array.isArray(s?.matches) ? s.matches : [])
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
    if (sportsFilter === 'live') return list.filter(isLiveMatch)
    return list
  }, [activeTab, sportsFilter, cricketMatches, tennisMatches, soccerMatches])

  const onOpenSportsbookMatch = (match: MatchItem) => {
    navigation.navigate('MainTabs', {
      screen: 'SportsBook',
      params: {
        eventId: match.eventId,
        gameId: match.gameId,
      },
    })
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
                onPress={() => setSportsFilter(f.id)}
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
            <View style={styles.tableHeader}>
              <View style={styles.timeColHead} />
              <View style={styles.matchColHead} />
              <Text style={styles.head1}>1</Text>
              <Text style={styles.headX}>X</Text>
              <Text style={styles.head2}>2</Text>
            </View>
            {activeMatches.map((match, idx) => {
              const odds = getRowOdds(match)
              const timeRaw = match.eventTime || match.event_time || match.startTime
              const timeParts = formatTime(timeRaw).split(',')
              return (
                <Pressable
                  key={`${match.eventId || match.gameId || idx}`}
                  style={styles.rowCard}
                  onPress={() => onOpenSportsbookMatch(match)}
                >
                  <View style={styles.timeCol}>
                    {isLiveMatch(match) ? <Text style={styles.liveMini}>LIVE</Text> : null}
                    <Text style={styles.dayText} numberOfLines={1}>
                      {timeParts[0] || 'Today'}
                    </Text>
                    <Text style={styles.clockText} numberOfLines={1}>
                      {timeParts[1]?.trim() || ''}
                    </Text>
                  </View>
                  <View style={styles.matchCol}>
                    <Text style={styles.matchSeries} numberOfLines={1}>
                    {match.seriesName || match.series_name || 'Sportsbook'}
                    </Text>
                    <Text style={styles.matchTitle} numberOfLines={2}>
                      {match.eventName || match.event_name || match.name || 'Match'}
                    </Text>
                  </View>
                  <View style={styles.oddColBlue}>
                    <Text style={styles.oddValDark}>{odds.one}</Text>
                  </View>
                  <View style={styles.oddColPink}>
                    <Text style={styles.oddValDark}>{odds.x}</Text>
                  </View>
                  <View style={styles.oddColBlue}>
                    <Text style={styles.oddValDark}>{odds.two}</Text>
                  </View>
                </Pressable>
              )
            })}
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
  listWrap: { marginTop: 12 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderWidth: 1,
    borderColor: '#22324A',
    backgroundColor: '#09162C',
    minHeight: 36,
  },
  timeColHead: { width: 56 },
  matchColHead: { flex: 1 },
  head1: { width: 48, textAlign: 'center', color: '#FFFFFF', fontFamily: AppFonts.montserratBold, fontSize: 12 },
  headX: { width: 48, textAlign: 'center', color: '#FFFFFF', fontFamily: AppFonts.montserratBold, fontSize: 12 },
  head2: { width: 48, textAlign: 'center', color: '#FFFFFF', fontFamily: AppFonts.montserratBold, fontSize: 12 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 62,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#22324A',
    backgroundColor: '#0A1324',
  },
  timeCol: {
    width: 56,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: '#1C2C42',
    justifyContent: 'center',
  },
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
  matchCol: { flex: 1, paddingHorizontal: 8, justifyContent: 'center' },
  matchSeries: { color: '#D7E2F3', fontFamily: AppFonts.montserratMedium, fontSize: 10, marginBottom: 2 },
  matchTitle: { color: '#FFFFFF', fontFamily: AppFonts.montserratSemiBold, fontSize: 12, lineHeight: 15 },
  oddColBlue: {
    width: 48,
    borderLeftWidth: 1,
    borderLeftColor: '#365A79',
    backgroundColor: '#A8C0D8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  oddColPink: {
    width: 48,
    borderLeftWidth: 1,
    borderLeftColor: '#7A4D61',
    backgroundColor: '#D7C1CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  oddValDark: { color: '#0F1827', fontFamily: AppFonts.montserratBold, fontSize: 16 / 2 },
})

export default InPlayScreen
