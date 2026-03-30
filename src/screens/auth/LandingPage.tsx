import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  GestureResponderEvent,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
  Alert,
  TouchableOpacity,
} from 'react-native'
const isFabricRenderer = !!(globalThis as any)?.nativeFabricUIManager
if (!isFabricRenderer && Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
import { useAuth } from '../../hooks/useAuth'
import { useNavigation, NavigationProp } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { colors } from '../../theme/colors'
import { API_BASE_URL } from '../../api/client'
import { LandingGame, landingService } from '../../services/landingService'
import { gameService } from '../../services/gameService'
import { SportsbookMatch, sportsbookService } from '../../services/sportsbookService'
import {
  subscribeMatchDataLandingAll,
  unsubscribeMatchDataLandingAll,
  addMatchDataListener,
  normalizeMatchDataUpdatePayload,
} from '../../socket/matchDataSocket'
import { normalizeRestMatchesList } from '../../utils/sportsbookMatchesPayload'
import { pickMatchEventTime, normalizeMatchDataEventTime } from '../../utils/matchDataNormalize'
import {
  getLandingOddsStripColumns,
  landingOddsValid,
  type LandingOddsPairColumn,
} from '../../utils/sportsGameOdds'
import { LandingHeader } from '../../components/common/LandingHeader'
import { ImageAssets } from '../../components/ImageAssets'
import { AppFonts } from '../../components/AppFonts'
import MenuIcon from '../../../assets/AppImages/menu-icon.svg'
import CasinoIcon from '../../../assets/AppImages/casino_icon.svg'
import LobbyIcon from '../../../assets/AppImages/lobby_icon.svg'
import LiveIcon from '../../../assets/AppImages/live_icon.svg'
import BasketballIcon from '../../../assets/AppImages/basketball_icon.svg'
import CricketIcon from '../../../assets/AppImages/menu-icon19.svg'
import TennisIcon from '../../../assets/AppImages/menu-icon20.svg'
import SoccerIcon from '../../../assets/AppImages/soccer_icon.svg'
import CasinoVector from '../../../assets/AppImages/casino_vector.svg'
import SportVector from '../../../assets/AppImages/sport_vector.svg'
import LinearGradient from 'react-native-linear-gradient'
import Video, {
  ResizeMode,
  PosterResizeModeType,
  IgnoreSilentSwitchType,
  MixWithOthersType,
} from 'react-native-video'
import FastImage from 'react-native-fast-image'
import { LandingFooter } from '../../components/common/LandingFooter'

type LandingPageProps = {
  onOpenLogin: () => void
  onOpenSignup: () => void
  onOpenHome: () => void
  navigation?: any
}

type SectionType = {
  title: string
  cta: string
  items: LandingGame[]
}

type LandingGamesState = {
  liveCasino: LandingGame[]
  slots: LandingGame[]
  trending: LandingGame[]
  roulette: LandingGame[]
  cardGames: LandingGame[]
}

type HeroSlide = {
  id: number
  image: number
  heading: string
  subContent: string
}

const heroSlides: HeroSlide[] = [
  {
    id: 1,
    image: ImageAssets.homeBnrPng,
    heading: 'All Mini Games',
    subContent: 'Play More. Win Faster. Endless Fun Awaits.',
  },
  {
    id: 2,
    image: ImageAssets.homeBnr2Png,
    heading: 'Sports & Betting',
    subContent: 'Play Smart. Bet Big. Win with the Best Odds.',
  },
  {
    id: 3,
    image: ImageAssets.homeBnr3Png,
    heading: 'Casino',
    subContent: 'Play Live. Bet Bold. Win Real Rewards.',
  },
  {
    id: 4,
    image: ImageAssets.homeBnr4Png,
    heading: 'Dragon Tiger',
    subContent: 'Choose Your Side. Bet Fast. Win Instantly.',
  },
  {
    id: 5,
    image: ImageAssets.homeBnr5Png,
    heading: 'Aviator',
    subContent: 'Take Off Early. Cash Out Big. Win Smart.',
  },
  {
    id: 6,
    image: ImageAssets.homeBnr6Png,
    heading: 'Cricket',
    subContent: 'Level up and unlock exclusive perks.',
  },
  {
    id: 7,
    image: ImageAssets.homeBnr7Png,
    heading: 'Casino & Sports Hub',
    subContent: 'Bet Every Ball. Play Every Moment. Win Bigger.',
  },
]

/** "Team A vs Team B" → two lines like mobile web */
const splitEventTitleLines = (raw: unknown): { line1: string; line2: string | null } => {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return { line1: '—', line2: null }
  const parts = s.split(/\s+(?:vs|v)\s+/i).map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { line1: parts[0], line2: parts.slice(1).join(' vs ') }
  }
  return { line1: s, line2: null }
}

const safeText = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallback
}

const getLandingGameImage = (item: LandingGame) =>
  item.thumb || item.thumbnail || item.image || item.icon || item.logo || ''

const toAbsoluteImageUrl = (rawUrl: string) => {
  const src = rawUrl.trim()
  if (!src) return ''
  let resolvedUrl = ''
  if (src.startsWith('http://')) resolvedUrl = src.replace(/^http:\/\//i, 'https://')
  else if (src.startsWith('https://')) resolvedUrl = src
  else if (src.startsWith('//')) resolvedUrl = `https:${src}`
  else if (src.startsWith('/')) resolvedUrl = `${API_BASE_URL}${src}`
  else resolvedUrl = `${API_BASE_URL}/${src}`

  return resolvedUrl
}

// const toAbsoluteImageUrl = (rawUrl: string) => {
//   const src = rawUrl.trim()
//   if (!src) return ''
//   if (src.startsWith('http://') || src.startsWith('https://')) return src
//   if (src.startsWith('//')) return `https:${src}`
//   if (src.startsWith('/')) return `${API_BASE_URL}${src}`
//   return `${API_BASE_URL}/${src}`
// }
function getDayGroup(isoStr: string | undefined): string {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return ''
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

function formatTimeOnly(input: unknown): string {
  if (typeof input !== 'string' || !input) return '--:--'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
}

/** Same as web `sportsGame.css` — `.sports_grid_back` / `.sports_grid_lay` / disabled. */
const ODDS_BACK_ON = '#a7d8fd'
const ODDS_LAY_ON = '#f9c9d4'
const ODDS_BACK_OFF = '#d4ecfe'
const ODDS_LAY_OFF = '#fce4ea'
const ODDS_CELL_W = 56
const LANDING_ROW_H = 76
const LANDING_STRIP_MAX_COLS = 12

/** Home rows from `/matchdata` `matchData:update` — same mapping as web `mapMatchDataRowsToTopMatches`. */
const mapMatchDataRowsToTopMatches = (matches: any[], defaults: { tournament: string }): SportsbookMatch[] => {
  if (!Array.isArray(matches)) return []
  return matches
    .filter((r: any) => {
      if (!r || typeof r !== 'object') return false
      const id = r.gameId ?? r.eventId
      return id != null && String(id).trim() !== ''
    })
    .map((r: any) => {
      const gid = String(r.gameId ?? r.eventId)
      const rawTime = pickMatchEventTime(r)
      const et = rawTime != null ? normalizeMatchDataEventTime(rawTime) : null
      const mid = r.marketId
      const ev =
        r.eventName ??
        r.event_name ??
        r.name ??
        r.title ??
        r.matchName ??
        r.match_name ??
        (typeof r.teams === 'string' ? r.teams : null) ??
        '—'
      return {
        gameId: gid,
        game_id: gid,
        eventId: gid,
        event_id: gid,
        marketId: mid != null && mid !== '' ? String(mid) : null,
        seriesName: r.seriesName ?? r.series_name ?? r.competitionName ?? r.leagueName ?? defaults.tournament,
        series_name: r.series_name ?? r.seriesName ?? r.competitionName ?? r.leagueName ?? defaults.tournament,
        eventName: ev,
        event_name: ev,
        name: ev,
        teams: typeof r.teams === 'string' ? r.teams : ev,
        inPlay: !!r.inPlay,
        in_play: !!r.inPlay,
        eventTime: et ?? undefined,
        event_time: et ?? undefined,
        matchOdds: Array.isArray(r.matchOdds) ? r.matchOdds : undefined,
        selections: r.selections,
        marketFlags: {
          MO: !!r.MO,
          BM: !!r.BM,
          OM: !!r.OM,
          FO: !!r.FO,
          PF: !!r.PF,
        },
      } as SportsbookMatch
    })
    .sort((a, b) => ((b.inPlay || b.in_play) ? 1 : 0) - ((a.inPlay || a.in_play) ? 1 : 0))
    .slice(0, 25)
}

const mapSocketRowsToTopMatches = (rows: any[], tournament: string): SportsbookMatch[] => {
  return rows
    .map((m: any) => {
      const id = m.gameId ?? m.game_id ?? m.eventId ?? m.event_id
      if (!id) return null
      const raw = m.eventTime ?? m.event_time ?? pickMatchEventTime(m)
      const et = raw != null ? normalizeMatchDataEventTime(raw) ?? raw : undefined
      return {
        gameId: m.gameId ?? m.game_id ?? String(id),
        game_id: m.game_id ?? m.gameId ?? String(id),
        eventId: m.eventId ?? m.event_id ?? String(id),
        event_id: m.event_id ?? m.eventId ?? String(id),
        eventName: m.eventName ?? m.event_name ?? m.name ?? '—',
        event_name: m.event_name ?? m.eventName ?? m.name ?? '—',
        name: m.name ?? m.eventName ?? m.event_name ?? '—',
        inPlay: m.inPlay ?? m.in_play ?? false,
        in_play: m.in_play ?? m.inPlay ?? false,
        eventTime: et,
        event_time: et,
        seriesName: m.seriesName ?? m.series_name ?? tournament,
        series_name: m.series_name ?? m.seriesName ?? tournament,
        openDate: m.openDate ?? m.open_date,
        open_date: m.open_date ?? m.openDate,
        matchOdds: Array.isArray(m.matchOdds) ? m.matchOdds : undefined,
        selections: m.selections,
      } as SportsbookMatch
    })
    .filter((m): m is SportsbookMatch => m !== null)
    .sort((a, b) => ((b.inPlay || b.in_play) ? 1 : 0) - ((a.inPlay || a.in_play) ? 1 : 0))
    .slice(0, 25)
}

const marketPillCodesForRow = (row: SportsbookMatch): string[] => {
  const f = row.marketFlags
  if (!f) return []
  const out: string[] = []
  if (f.MO) out.push('MO')
  if (f.BM) out.push('BM')
  if (f.FO) out.push('F')
  if (f.OM) out.push('OM')
  if (f.PF) out.push('P')
  return out
}

const trendingCategories = [
  { name: 'Aviator', image: ImageAssets.aviatorImgPng, video: ImageAssets.vidAviator },
  { name: 'Dragon Tiger', image: ImageAssets.betcasinoImg4Png, video: ImageAssets.vidDragonTiger },
  { name: 'Chicken Road', image: ImageAssets.funChickenPng, video: ImageAssets.vidChickenRoad },
  { name: 'Baccarat', image: ImageAssets.betcasinoImg2Png, video: ImageAssets.vidBaccarat },
  { name: 'Roulette', image: ImageAssets.betcasinoImg3Png, video: ImageAssets.vidRoulette },
  { name: 'Teen Patti', image: ImageAssets.betcasinoImg5Png, video: ImageAssets.vidTeenPatti },
]

export const LandingPage = ({ onOpenLogin, onOpenSignup, onOpenHome, navigation: propsNav }: LandingPageProps) => {
  const { isAuthenticated } = useAuth()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const finalNav = propsNav || navigation

  const [launchingGame, setLaunchingGame] = useState(false)
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set())
  /** Trending strip: MP4 decode failed → show static image (after onError). */
  const [stripVideoFailed, setStripVideoFailed] = useState<Set<string>>(() => new Set())
  const markStripVideoFailed = useCallback((name: string) => {
    setStripVideoFailed(prev => {
      const next = new Set(prev)
      next.add(name)
      return next
    })
  }, [])

  const handleLaunchGame = async (game: any) => {
    if (!isAuthenticated) {
      Toast.show({
        type: 'error',
        text1: 'Authentication Required',
        text2: 'Please login to play games',
      })
      if (onOpenLogin) {
        onOpenLogin()
      } else {
        finalNav.navigate('Login')
      }
      return
    }

    const targetCode = game.code || game.gameCode
    if (!targetCode) {
      Toast.show({
        type: 'info',
        text1: 'Coming Soon',
        text2: 'This game will be available shortly',
      })
      return
    }

    setLaunchingGame(true)
    try {
      const res = await gameService.launchGame(targetCode, game.providerCode || 'all')
      console.log(res, '==game launch response')

      const d = res.data ?? (res as any).response?.data ?? (res as any).result ?? res
      const launchURL = d?.launchURL || d?.launchUrl || d?.url || d?.gameUrl || d?.gameURL || d?.iframeUrl || (typeof d === 'string' ? d : null)

      if (launchURL) {
        finalNav.navigate('Game', { url: launchURL, title: game.name || 'Game' })
      } else {
        Toast.show({
          type: 'error',
          text1: 'Launch Failed',
          text2: res.message || 'Could not start the game',
        })
      }
    } catch (err) {
      console.error(err)
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to launch game',
      })
    } finally {
      setLaunchingGame(false)
    }
  }

  const [heroIndex, setHeroIndex] = useState(0)
  const [gamesLoading, setGamesLoading] = useState(true)
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [gamesError, setGamesError] = useState<string | null>(null)

  const [landingGames, setLandingGames] = useState<LandingGamesState>({
    liveCasino: [],
    slots: [],
    trending: [],
    roulette: [],
    cardGames: [],
  })
  const [casinoLobbyGames, setCasinoLobbyGames] = useState<LandingGame[]>([])
  const [cricketMatches, setCricketMatches] = useState<SportsbookMatch[]>([])
  const [tennisMatches, setTennisMatches] = useState<SportsbookMatch[]>([])
  const [footballMatches, setFootballMatches] = useState<SportsbookMatch[]>([])
  const dots = useMemo(() => Array.from({ length: heroSlides.length }, (_, i) => i), [])
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [heroAnimating, setHeroAnimating] = useState(false)
  const [heroDirection, setHeroDirection] = useState<1 | -1>(1)
  const heroProgress = useMemo(() => new Animated.Value(0), [])

  const heroOffsets = [-1, 1, 0] as const
  const getHeroSlideIndex = (offset: number) =>
    (heroIndex + offset + heroSlides.length * 10) % heroSlides.length

  const runHeroSlide = useCallback((direction: 1 | -1) => {
    if (heroAnimating) return
    setHeroDirection(direction)
    setHeroAnimating(true)
    heroProgress.setValue(0)
    Animated.timing(heroProgress, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setHeroIndex(prev => (prev + direction + heroSlides.length) % heroSlides.length)
      heroProgress.setValue(0)
      setHeroAnimating(false)
    })
  }, [heroAnimating, heroProgress])

  const onHeroTouchStart = (e: GestureResponderEvent) => {
    setTouchStartX(e.nativeEvent.pageX)
  }

  const onHeroTouchEnd = (e: GestureResponderEvent) => {
    if (touchStartX == null) return
    const deltaX = e.nativeEvent.pageX - touchStartX
    if (deltaX < -40) {
      runHeroSlide(1)
    } else if (deltaX > 40) {
      runHeroSlide(-1)
    }
    setTouchStartX(null)
  }

  useEffect(() => {
    let mounted = true
    const loadLandingData = async () => {
      try {
        const [gamesData, lobbyData] = await Promise.all([
          landingService.getLandingGames(),
          landingService.getCasinoLobbyGames(18),
        ])
        if (!mounted) return
        setLandingGames(gamesData)
        setCasinoLobbyGames(lobbyData)
        setGamesError(null)
      } catch (error) {
        if (!mounted) return
        setLandingGames({
          liveCasino: [],
          slots: [],
          trending: [],
          roulette: [],
          cardGames: [],
        })
        setCasinoLobbyGames([])
        setGamesError(error instanceof Error ? error.message : 'Failed to load landing games')
      } finally {
        if (mounted) setGamesLoading(false)
      }
    }
    loadLandingData()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      runHeroSlide(1)
    }, 5000)
    return () => clearInterval(timer)
  }, [runHeroSlide])

  // === Website-identical pattern: REST prefetch + Socket.IO live updates ===

  // Max wait: after 10s, hide spinner regardless (same as website TOP_MATCH_LOAD_MAX_WAIT_MS)
  const matchLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    matchLoadTimerRef.current = setTimeout(() => {
      setMatchesLoading(false)
    }, 10000)
    return () => {
      if (matchLoadTimerRef.current) clearTimeout(matchLoadTimerRef.current)
    }
  }, [])

  // 1) REST prefetch (fast first paint) – errors silently swallowed, socket will fill in
  useEffect(() => {
    let cancelled = false
    const prefetchSport = async (
      sport: string,
      setRows: React.Dispatch<React.SetStateAction<SportsbookMatch[]>>,
      tournament: string,
    ) => {
      try {
        const res = await sportsbookService.getRawMatches(sport)
        console.log(`[TopMatches][REST] ${sport} raw response:`, res)
        if (cancelled) return
        const raw = normalizeRestMatchesList(res)
        console.log(`[TopMatches][REST] ${sport} normalized rows:`, raw.length)
        if (!raw.length) return
        const mapped = mapSocketRowsToTopMatches(raw, tournament)
        console.log(`[TopMatches][REST] ${sport} mapped rows:`, mapped.length)
        if (mapped.length > 0) {
          setRows(mapped)
          setMatchesLoading(false)
        }
      } catch (e) {
        console.warn(`[TopMatches][REST] ${sport} prefetch failed`, e)
        /* socket / max-wait timer still clears spinner – identical to website */
      }
    }
    prefetchSport('cricket', setCricketMatches, 'Cricket')
    prefetchSport('tennis', setTennisMatches, 'Tennis')
    prefetchSport('soccer', setFootballMatches, 'Football')
    return () => { cancelled = true }
  }, [])

  // 2) `/matchdata` socket — same as web LandingPage (`matchData:subscribeAll` + `matchData:update`).
  //    `/sportsbook` `matches` events do not carry this landing list on your backend.
  useEffect(() => {
    subscribeMatchDataLandingAll()
    const remove = addMatchDataListener((kind, payload) => {
      if (kind === 'error') {
        console.warn('[matchData] error', payload)
        setMatchesLoading(false)
        return
      }
      const { sportName, matches } = normalizeMatchDataUpdatePayload(payload)
      const defaults =
        sportName === 'cricket'
          ? { tournament: 'Cricket' as const }
          : sportName === 'tennis'
            ? { tournament: 'Tennis' as const }
            : sportName === 'soccer'
              ? { tournament: 'Football' as const }
              : null
      if (!defaults) return
      if (!Array.isArray(matches)) return

      if (matches.length === 0) {
        if (sportName === 'cricket') {
          setCricketMatches([])
        } else if (sportName === 'tennis') {
          setTennisMatches([])
        } else if (sportName === 'soccer') {
          setFootballMatches([])
        }
        setMatchesLoading(false)
        return
      }

      const mapped = mapMatchDataRowsToTopMatches(matches, defaults)
      if (mapped.length === 0) return

      if (sportName === 'cricket') {
        setCricketMatches(mapped)
      } else if (sportName === 'tennis') {
        setTennisMatches(mapped)
      } else if (sportName === 'soccer') {
        setFootballMatches(mapped)
      }
      setMatchesLoading(false)
    })
    return () => {
      remove()
      unsubscribeMatchDataLandingAll()
    }
  }, [])

  const sections: SectionType[] = useMemo(
    () => [
      { title: 'Trending Games', cta: '', items: landingGames.trending },
      { title: 'Card Games', cta: 'Go to Card Games', items: landingGames.cardGames },
      { title: 'Casino Lobby', cta: 'Go to Casino Lobby', items: landingGames.liveCasino },
      { title: 'Live Casino', cta: 'Go to Live Casino', items: casinoLobbyGames },
      { title: 'Slots', cta: 'Go to Slots', items: landingGames.slots },
      { title: 'Trending', cta: 'Go to Casino', items: landingGames.trending },
      { title: 'Roulette', cta: 'Go to Roulette', items: landingGames.roulette },
    ],
    [landingGames, casinoLobbyGames],
  )

  const renderSection = (section: SectionType) => {
    const isTwoRow = section.title === 'Casino Lobby'
    const totalItems = section.items

    const row1 = []
    const row2 = []

    if (isTwoRow) {
      // Limit to 18 items (9 per row) ONLY for Casino Lobby
      const limited = section.title === 'Casino Lobby' ? totalItems.slice(0, 18) : totalItems
      const mid = Math.ceil(limited.length / 2)
      row1.push(...limited.slice(0, mid))
      row2.push(...limited.slice(mid))
      // Add View All at the end of both rows
      row1.push({ viewAll: true })
      row2.push({ viewAll: true })
    } else {
      // Limit to 9 items ONLY for specific conditions if needed, otherwise all
      const limited = section.title === 'Casino Lobby' ? totalItems.slice(0, 9) : totalItems
      row1.push(...limited)
      row1.push({ viewAll: true })
    }

    const renderGameCard = (game: any, idx: number, isSmall: boolean) => {
      if (game.viewAll) {
        return (
          <TouchableOpacity
            key={`view-all-${idx}`}
            onPress={() => handleLaunchGame({ name: 'All Games' })}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#451325', '#0f172a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.gameCard, isSmall && styles.gameCardSmall, styles.viewAllCard]}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </LinearGradient>
          </TouchableOpacity>
        )
      }

      const imgUrl = getLandingGameImage(game)
      const thumbKey = String((game as any).gameCode || (game as any).code || idx)
      const absoluteImgUrl = toAbsoluteImageUrl(imgUrl)
      const showRemoteImage = absoluteImgUrl.length > 0 && !failedThumbs.has(thumbKey)
      return (
        <TouchableOpacity
          key={idx}
          style={[styles.gameCard, isSmall && styles.gameCardSmall]}
          onPress={() => handleLaunchGame(game)}
          activeOpacity={0.8}
        >
          {showRemoteImage ? (
            <FastImage
              source={{
                uri: absoluteImgUrl,
                priority: FastImage.priority.normal,
                cache: FastImage.cacheControl.web,
              }}
              style={styles.gameCardImage}
              resizeMode={FastImage.resizeMode.cover}
              onError={() =>
                setFailedThumbs(prev => {
                  const next = new Set(prev)
                  next.add(thumbKey)
                  return next
                })
              }
            />
          ) : (
            <Image source={ImageAssets.gameItemsliderPng} style={styles.gameCardImage} resizeMode="cover" />
          )}
        </TouchableOpacity>
      )
    }

    return (
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            {section.title !== 'Trending Games' && <LiveIcon width={20} height={20} />}
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          {section.cta ? <Text style={styles.sectionCta}>{section.cta}</Text> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
          {isTwoRow ? (
            <View style={styles.twoRowWrapper}>
              <View style={styles.gameRow}>
                {row1.map((game, idx) => renderGameCard(game, idx, false))}
              </View>
              <View style={styles.gameRow}>
                {row2.map((game, idx) => renderGameCard(game, idx, false))}
              </View>
            </View>
          ) : (
            <View style={styles.gameRow}>
              {row1.map((game, idx) => renderGameCard(game, idx, section.title === 'Trending Games'))}
            </View>
          )}
        </ScrollView>
      </View>
    )
  }

  const renderMatchBlock = (data: SportsbookMatch[], sportKey: 'cricket' | 'tennis' | 'soccer') => {
    const isCricket = sportKey === 'cricket'
    const isTennis = sportKey === 'tennis'
    const Icon = isCricket ? CricketIcon : isTennis ? TennisIcon : SoccerIcon
    const displayName = isCricket ? 'Cricket' : isTennis ? 'Tennis' : 'Football'
    const winW = Dimensions.get('window').width
    // Match rows are full-bleed (we keep header padded via `matchWrapper`).
    const innerW = winW
    const leftClusterW = Math.min(270, Math.round(innerW * 0.58))

    const showVol = (sz: unknown) =>
      sz != null && sz !== '—' && String(sz).trim() !== '' && String(sz) !== '0.00'

    const renderStripCell = (
      key: string,
      pair: LandingOddsPairColumn,
      side: 'back' | 'lay',
      isLast: boolean,
    ) => {
      const raw = pair ? (side === 'back' ? pair.back : pair.lay) : null
      const sz = pair ? (side === 'back' ? pair.backSize : pair.laySize) : null
      const ok = raw != null && raw !== '—' && landingOddsValid(raw)
      const isBack = side === 'back'
      const bg = ok ? (isBack ? ODDS_BACK_ON : ODDS_LAY_ON) : isBack ? ODDS_BACK_OFF : ODDS_LAY_OFF
      return (
        <View
          key={key}
          style={[
            styles.oddsStripCell,
            { width: ODDS_CELL_W, backgroundColor: bg },
            isLast && styles.oddsStripCellLast,
          ]}
        >
          {ok ? (
            <>
              <Text style={styles.oddsStripPrice}>{raw}</Text>
              {showVol(sz) ? <Text style={styles.oddsStripVol}>{String(sz)}</Text> : null}
            </>
          ) : (
            <Text style={styles.oddsDash}>-</Text>
          )}
        </View>
      )
    }

    return (
      <View style={styles.matchWrapper}>
        <View style={styles.matchHeader}>
          <View style={styles.matchHeaderLeft}>
            <Icon width={22} height={26} fill="#FFFFFF" />
            <Text style={styles.matchTitle}>{displayName}</Text>
          </View>
          <Pressable onPress={() => finalNav.navigate('SportsBook')} hitSlop={8} style={styles.matchViewAllPress}>
            <Text style={styles.matchViewAll}>View all</Text>
          </Pressable>
        </View>

        <View style={styles.matchSection}>
          {data.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>No matches at the moment.</Text>
            </View>
          ) : (
            (() => {
              const rowsPrep = data.map((row, idx) => {
                const eventTime = row.eventTime ?? row.event_time ?? row.openDate ?? row.open_date
                const oddsPayload =
                  Array.isArray(row.matchOdds) && row.matchOdds.length > 0
                    ? { matchOdds: row.matchOdds as any[] }
                    : null
                const stripCols = getLandingOddsStripColumns(
                  { ...row, teams: row.teams ?? row.eventName ?? row.name },
                  oddsPayload,
                  LANDING_STRIP_MAX_COLS,
                )
                const rowKey = `${sportKey}-${row.gameId ?? row.game_id ?? row.eventId ?? row.event_id ?? idx}`
                return { row, eventTime, stripCols, rowKey }
              })
              const rowsSorted = [...rowsPrep].sort((a, b) => {
                const aLive = !!(a.row.inPlay ?? (a.row as any).in_play)
                const bLive = !!(b.row.inPlay ?? (b.row as any).in_play)
                if (aLive !== bLive) return aLive ? -1 : 1

                const aGroup = getDayGroup(typeof a.eventTime === 'string' ? a.eventTime : undefined)
                const bGroup = getDayGroup(typeof b.eventTime === 'string' ? b.eventTime : undefined)
                const rank = (g: string) => (g === 'Today' ? 0 : g === 'Tomorrow' ? 1 : 2)
                const ra = rank(aGroup)
                const rb = rank(bGroup)
                if (ra !== rb) return ra - rb

                const ta =
                  typeof a.eventTime === 'string' && !Number.isNaN(new Date(a.eventTime).getTime())
                    ? new Date(a.eventTime).getTime()
                    : Number.MAX_SAFE_INTEGER
                const tb =
                  typeof b.eventTime === 'string' && !Number.isNaN(new Date(b.eventTime).getTime())
                    ? new Date(b.eventTime).getTime()
                    : Number.MAX_SAFE_INTEGER
                if (ta !== tb) return ta - tb
                return String(a.rowKey).localeCompare(String(b.rowKey))
              })
              const maxCols = Math.max(1, ...rowsPrep.map(r => r.stripCols.length))
              /** One line: all backs (blue) then all lays (pink) — same as web mobile order. */
              const stripPx = maxCols * ODDS_CELL_W * 2

              return (
                <View style={[styles.matchBlockRow, { width: winW }]}>
                  <View style={[styles.matchLeftCol, { width: leftClusterW }]}>
                    {rowsSorted.map(({ row, eventTime, rowKey }) => {
                      const pills = marketPillCodesForRow(row)
                      return (
                        <View key={rowKey} style={[styles.matchRow, { minHeight: LANDING_ROW_H }]}>
                          <View style={[styles.matchRowLeft, { width: leftClusterW, flexShrink: 0 }]}>
                            <View style={styles.matchMeta}>
                              {row.inPlay ?? (row as any).in_play ? <Text style={styles.liveTag}>LIVE</Text> : null}
                              <Text style={styles.matchMetaDay}>
                                {getDayGroup(typeof eventTime === 'string' ? eventTime : undefined) || 'Today'}
                              </Text>
                              <Text style={styles.matchMetaClock}>{formatTimeOnly(eventTime)}</Text>
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
                              {(() => {
                                const { line1, line2 } = splitEventTitleLines(
                                  row.eventName ?? (row as any).event_name ?? row.name ?? row.teams,
                                )
                                return (
                                  <View>
                                    <Text style={styles.matchTeamsLine1} numberOfLines={line2 ? 2 : 3}>
                                      {safeText(line1, '—')}
                                    </Text>
                                    {line2 ? (
                                      <Text style={styles.matchTeamsLine2} numberOfLines={2}>
                                        {line2}
                                      </Text>
                                    ) : null}
                                  </View>
                                )
                              })()}
                            </View>
                          </View>
                        </View>
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
                      {rowsSorted.map(({ stripCols, rowKey }) => (
                        <View key={`${rowKey}-odds`} style={[styles.oddsRow, { minHeight: LANDING_ROW_H }]}>
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
              )
            })()
          )}
        </View>
      </View>
    )
  }

  return (<View style={styles.page}>
    {launchingGame && (
      <View style={styles.globalLoader}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loaderText}>Starting Game...</Text>
      </View>
    )}
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.mainContentArea}>
        <LandingHeader onLoginPress={onOpenLogin} onSignupPress={onOpenSignup} />

        <ImageBackground source={ImageAssets.herobgMainJpg} style={styles.heroWrap} resizeMode="cover">
          <View style={styles.heroOverlay}>
            <View
              style={styles.heroCardRow}
              onTouchStart={onHeroTouchStart}
              onTouchEnd={onHeroTouchEnd}
            >
              {heroAnimating
                ? ([-1, 0, 1] as const).map(offset => {
                  const slide = heroSlides[getHeroSlideIndex(offset)]
                  const isCenter = offset === 0
                  const seq = (
                    from: number,
                    to: number,
                    start = 0,
                    end = 1,
                  ) =>
                    heroProgress.interpolate({
                      inputRange: [0, start, end, 1],
                      outputRange: [from, from, to, to],
                    })
                  const styleByOffset =
                    heroDirection === 1
                      ? offset === -1
                        ? {
                          translateX: seq(-126, -220, 0.35, 0.92),
                          translateY: seq(4, 12, 0.35, 0.92),
                          scale: seq(0.84, 0.74, 0.35, 0.92),
                          opacity: seq(0.82, 0, 0.55, 0.98),
                        }
                        : offset === 0
                          ? {
                            translateX: seq(0, -126, 0.0, 0.56),
                            translateY: seq(-16, 4, 0.0, 0.56),
                            scale: seq(1, 0.84, 0.0, 0.56),
                            opacity: seq(1, 0.82, 0.0, 0.56),
                          }
                          : {
                            translateX: seq(126, 0, 0.12, 0.78),
                            translateY: seq(4, -16, 0.12, 0.78),
                            scale: seq(0.84, 1, 0.12, 0.78),
                            opacity: seq(0.82, 1, 0.12, 0.78),
                          }
                      : offset === 1
                        ? {
                          translateX: seq(126, 220, 0.35, 0.92),
                          translateY: seq(4, 12, 0.35, 0.92),
                          scale: seq(0.84, 0.74, 0.35, 0.92),
                          opacity: seq(0.82, 0, 0.55, 0.98),
                        }
                        : offset === 0
                          ? {
                            translateX: seq(0, 126, 0.0, 0.56),
                            translateY: seq(-16, 4, 0.0, 0.56),
                            scale: seq(1, 0.84, 0.0, 0.56),
                            opacity: seq(1, 0.82, 0.0, 0.56),
                          }
                          : {
                            translateX: seq(-126, 0, 0.12, 0.78),
                            translateY: seq(4, -16, 0.12, 0.78),
                            scale: seq(0.84, 1, 0.12, 0.78),
                            opacity: seq(0.82, 1, 0.12, 0.78),
                          }

                  return (
                    <Animated.View
                      key={`${slide.id}-anim-${offset}`}
                      style={[
                        styles.hero3dCard,
                        isCenter && styles.heroMainCard,
                        {
                          opacity: styleByOffset.opacity,
                          transform: [
                            { translateX: styleByOffset.translateX },
                            { translateY: styleByOffset.translateY },
                            { scale: styleByOffset.scale },
                          ],
                        },
                      ]}
                    >
                      <ImageBackground
                        source={slide.image}
                        style={styles.heroCardFill}
                        imageStyle={styles.heroMainCardImage}
                        resizeMode="cover"
                      >
                        {isCenter ? (
                          <View style={styles.heroMainCardOverlay}>
                            <Text style={styles.heroMainTitle}>{slide.heading}</Text>
                            <Text style={styles.heroMainSubtitle}>{slide.subContent}</Text>
                          </View>
                        ) : null}
                      </ImageBackground>
                    </Animated.View>
                  )
                })
                : heroOffsets.map(offset => {
                  const slide = heroSlides[getHeroSlideIndex(offset)]
                  const isCenter = offset === 0
                  const positionStyle =
                    offset === -1
                      ? styles.heroPosLeft1
                      : offset === 1
                        ? styles.heroPosRight1
                        : styles.heroPosCenter
                  return (
                    <ImageBackground
                      key={`${slide.id}-${offset}`}
                      source={slide.image}
                      style={[styles.hero3dCard, positionStyle, isCenter && styles.heroMainCard]}
                      imageStyle={styles.heroMainCardImage}
                      resizeMode="cover"
                    >
                      {isCenter ? (
                        <View style={styles.heroMainCardOverlay}>
                          <Text style={styles.heroMainTitle}>{slide.heading}</Text>
                          <Text style={styles.heroMainSubtitle}>{slide.subContent}</Text>
                        </View>
                      ) : null}
                    </ImageBackground>
                  )
                })}
            </View>

            <View style={styles.heroNav}>
              <Pressable
                style={styles.heroArrowBtn}
                onPress={() => runHeroSlide(-1)}
              >
                <Text style={styles.arrow}>‹</Text>
              </Pressable>
              <View style={styles.dotRow}>
                {dots.map(i => (
                  <Pressable
                    key={i}
                    onPress={() => setHeroIndex(i)}
                    style={[styles.dot, i === heroIndex && styles.dotActive]}
                  />
                ))}
              </View>
              <Pressable
                style={styles.heroArrowBtn}
                onPress={() => runHeroSlide(1)}
              >
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            </View>

            <Text style={styles.heroHeadline}>
              <Text style={styles.heroHeadlineAccent}>Your Ultimate</Text>
              {'\n'}
              Casino & Sports Gaming Hub
            </Text>
            <View style={styles.heroSubRow}>
              <Text style={styles.heroSubItem}>
                <Text style={styles.heroSubBullet}>•</Text> Instant Deposit
              </Text>
              <Text style={styles.heroSubItem}>
                <Text style={styles.heroSubBullet}>•</Text> Instant Withdrawal
              </Text>
            </View>
            <View style={[styles.heroCtaRow, isAuthenticated && styles.heroCtaRowLoggedIn]}>
              {!isAuthenticated ? (
                <Pressable style={styles.signupBtn} onPress={onOpenSignup}>
                  <Text style={styles.signupBtnText}>Sign Up and Play</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.depositBtn} onPress={isAuthenticated ? onOpenHome : onOpenLogin}>
                <Text style={styles.signupBtnText}>Deposit Now</Text>
              </Pressable>
              <View style={styles.iconGroup}>
                <View style={styles.smallIcon}>
                  <Image source={ImageAssets.spade} style={styles.smallIconImage} resizeMode="contain" />
                </View>
                <View style={styles.smallIcon}>
                  <Image source={ImageAssets.football} style={styles.smallIconImage} resizeMode="contain" />
                </View>
                <View style={styles.smallIcon}>
                  <Image source={ImageAssets.dice} style={styles.smallIconImage} resizeMode="contain" />
                </View>
                <View style={styles.smallIcon}>
                  <Image source={ImageAssets.airplane} style={styles.smallIconImage} resizeMode="contain" />
                </View>
              </View>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.quickRow}>
          <LinearGradient
            colors={['#9A0C4C', '#0B1A30', '#0B1A30']}
            locations={[0, 0.4, 0.85]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={[styles.quickCard, styles.quickCardCasino]}
          >
            <Text style={styles.quickTitle}>Casino ›</Text>
            <CasinoVector width={120} height={120} style={styles.quickVector} />
          </LinearGradient>
          <LinearGradient
            colors={['#1D5EA8', '#174E8F', '#0B1A30']}
            locations={[0, 0.4, 0.85]}
            start={{ x: 0.08, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={[styles.quickCard, styles.quickCardSport]}
          >
            <Text style={styles.quickTitle}>Sport ›</Text>
            <SportVector width={120} height={120} style={styles.quickVector} />
          </LinearGradient>
        </View>

        <View style={styles.topStrip}>
          {trendingCategories.map(cat => (
            <Pressable key={cat.name} style={styles.stripCard} onPress={onOpenLogin}>
              {stripVideoFailed.has(cat.name) ? (
                <Image source={cat.image} style={styles.stripCardImage} resizeMode="cover" />
              ) : (
                <Video
                  key={`strip-video-${cat.name}`}
                  source={cat.video}
                  style={styles.stripCardImage}
                  paused={false}
                  repeat
                  muted
                  resizeMode={ResizeMode.COVER}
                  useTextureView={Platform.OS === 'android'}
                  disableFocus={Platform.OS === 'android'}
                  hideShutterView={Platform.OS === 'android'}
                  poster={Image.resolveAssetSource(cat.image).uri}
                  posterResizeMode={PosterResizeModeType.COVER}
                  ignoreSilentSwitch={IgnoreSilentSwitchType.IGNORE}
                  mixWithOthers={MixWithOthersType.MIX}
                  onError={e => {
                    console.warn('[LandingPage] trending video error', cat.name, e)
                    markStripVideoFailed(cat.name)
                  }}
                />
              )}
              <View style={styles.stripTitleBar}>
                <Text style={styles.stripCardTitle}>{cat.name}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {gamesLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Loading landing games...</Text>
          </View>
        ) : gamesError ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{gamesError}</Text>
          </View>
        ) : (
          sections.map(section => (
            <React.Fragment key={section.title}>
              {renderSection(section)}
            </React.Fragment>
          ))
        )}

        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>TOP Sports</Text>
            <Text style={styles.sectionCta}>Go to Sportsbook</Text>
          </View>
          <View style={styles.topSportsRow}>
            <LinearGradient
              colors={['#1e3b60', '#10131c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.topSportCard}
            >
              <CricketIcon width={34} height={34} fill="#8da0b9" />
              <Text style={styles.topSportText}>Cricket</Text>
            </LinearGradient>

            <LinearGradient
              colors={['#1e3b60', '#10131c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.topSportCard}
            >
              <SoccerIcon width={34} height={34} fill="#8da0b9" />
              <Text style={styles.topSportText}>Football</Text>
            </LinearGradient>
          </View>
        </View>

        {matchesLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Loading top matches...</Text>
          </View>
        ) : (
          <>
            {renderMatchBlock(cricketMatches, 'cricket')}
            {renderMatchBlock(tennisMatches, 'tennis')}
            {renderMatchBlock(footballMatches, 'soccer')}
          </>
        )}
      </View>
      <LandingFooter />
    </ScrollView>
  </View>
  )
}

export default LandingPage

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#10131c' },
  scroll: { flex: 1 },
  mainContentArea: { backgroundColor: '#040f21', paddingBottom: 20 },
  content: { paddingBottom: 0 },
  heroWrap: { gap: 14 },
  heroOverlay: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 18, backgroundColor: 'rgba(7, 21, 43, 0.72)' },
  heroCardRow: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 252,
    marginTop: 6,
    marginBottom: 10,
  },
  hero3dCard: {
    position: 'absolute',
    width: 136,
    height: 200,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#8CA1BE',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    elevation: 1,
  },
  heroCardFill: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  heroMainCard: {
    width: 210,
    height: 220,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#9CB0CA',
    zIndex: 2,
    elevation: 8,
  },
  heroPosLeft1: {
    transform: [{ translateX: -126 }, { translateY: 4 }, { scale: 0.84 }],
    opacity: 0.82,
    zIndex: 2,
  },
  heroPosCenter: {
    transform: [{ translateX: 0 }, { translateY: -16 }, { scale: 1 }],
    opacity: 1,
    zIndex: 9,
    elevation: 20,
  },
  heroPosRight1: {
    transform: [{ translateX: 126 }, { translateY: 4 }, { scale: 0.84 }],
    opacity: 0.82,
    zIndex: 2,
  },
  heroMainCardImage: {
    borderRadius: 20,
  },
  heroMainCardOverlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroMainTitle: { color: '#FFFFFF', fontSize: 36 / 2, fontFamily: AppFonts.montserratExtraBold, textAlign: 'center' },
  heroMainSubtitle: { color: '#E8EDF8', fontSize: 11, fontFamily: AppFonts.montserratRegular, textAlign: 'center' },
  heroNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  heroArrowBtn: { width: 24, height: 22, alignItems: 'center', justifyContent: 'center' },
  arrow: {
    color: '#6B7282',
    fontSize: 24,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
    transform: [{ translateY: -1 }],
  },
  dotRow: { flexDirection: 'row', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 20, backgroundColor: '#9098A7' },
  dotActive: { backgroundColor: '#FFF', width: 10, height: 10 },
  heroHeadline: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: AppFonts.montserratExtraBold,
    fontSize: 38 / 2,
    lineHeight: 46 / 2,
    marginBottom: 8,
  },
  heroHeadlineAccent: {
    color: '#E07B34',
  },
  heroSub: {
    color: '#EA8D3A',
    textAlign: 'center',
    fontSize: 20 / 2,
    fontFamily: AppFonts.montserratSemiBold,
    marginBottom: 14,
  },
  heroSubRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  heroSubItem: {
    color: '#EA8D3A',
    fontSize: 20 / 2,
    lineHeight: 26 / 2,
    fontFamily: AppFonts.montserratSemiBold,
    includeFontPadding: false,
  },
  heroSubBullet: {
    fontSize: 38 / 2,
    lineHeight: 26 / 2,
    fontFamily: AppFonts.montserratBold,
    textAlignVertical: 'center',
  },
  heroCtaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 6,
    marginBottom: 8,
  },
  heroCtaRowLoggedIn: {
    justifyContent: 'center',
    gap: 10,
  },
  signupBtn: { backgroundColor: '#E07B34', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  depositBtn: { backgroundColor: '#1F2B45', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  signupBtnText: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 13 },
  iconGroup: { flexDirection: 'row', gap: 4 },
  smallIcon: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#1D2638', justifyContent: 'center', alignItems: 'center' },
  smallIconImage: { width: 16, height: 16, tintColor: '#fff' },
  quickRow: { paddingHorizontal: 12, flexDirection: 'row', gap: 10, marginTop: 10 },
  quickCard: {
    flex: 1,
    borderRadius: 14,
    minHeight: 132,
    padding: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  quickCardCasino: {},
  quickCardSport: {},
  quickTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 28 / 2 },
  quickVector: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -60,
  },
  topStrip: { paddingHorizontal: 10, marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stripCard: {
    width: '31.4%',
    height: 86,
    borderRadius: 12,
    backgroundColor: '#111',
    overflow: 'hidden',
    position: 'relative',
  },
  stripCardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  stripTitleBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stripCardTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: AppFonts.montserratBold,
    textAlign: 'center',
  },
  sectionWrap: { marginTop: 22, paddingHorizontal: 12, },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontFamily: AppFonts.montserratBold },
  sectionCta: { color: '#1588FF', fontSize: 24 / 2, fontFamily: AppFonts.montserratSemiBold },
  gameRow: { flexDirection: 'row', gap: 12 },
  twoRowWrapper: { gap: 12 },
  scrollContainer: { paddingRight: 12 },
  gameCard: {
    width: 156,
    height: 112,
    borderRadius: 14,
    backgroundColor: '#1F2C47',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  viewAllCard: {
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: 'transparent',
  },
  viewAllText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: AppFonts.montserratBold,
  },
  gameCardSmall: { width: 134 },
  gameCardImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    opacity: 0.88,
  },
  loadingWrap: { paddingVertical: 14, alignItems: 'center', gap: 8 },
  globalLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    color: '#FFF',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 16,
  },
  loadingText: { color: '#9DB0CC', fontSize: 13, fontFamily: AppFonts.montserratRegular },
  errorWrap: { backgroundColor: '#2A1620', marginHorizontal: 12, borderRadius: 10, padding: 10 },
  errorText: { color: '#FFC4D2', fontSize: 12, fontFamily: AppFonts.montserratRegular },
  emptyBlock: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontFamily: AppFonts.montserratRegular,
    textAlign: 'center',
  },
  topSportsRow: { flexDirection: 'row', gap: 10 },
  topSportCard: {
    flex: 1,
    height: 120,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1d3b60',
    gap: 10,
  },
  topSportText: { color: '#FFFFFF', fontFamily: AppFonts.montserratBold, fontSize: 16 },
  matchWrapper: { marginTop: 16, paddingHorizontal: 14 },
  matchSection: {
    backgroundColor: '#11161c',
    paddingVertical: 0,
    width: '100%',
    marginTop: 8,
    marginHorizontal: -14,
    overflow: 'visible',
  },
  matchBlockHScroll: {
    flexGrow: 0,
  },
  matchBlockHScrollInner: {
    flexGrow: 1,
  },
  matchBlockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  matchLeftCol: {
    flexShrink: 0,
  },
  oddsOnlyHScroll: {
    flex: 1,
  },
  oddsOnlyHScrollInner: {
    flexGrow: 0,
    paddingRight: 1,
  },
  oddsOnlyCol: {
    flexDirection: 'column',
  },
  oddsRow: {
    backgroundColor: '#0b1620',
    borderBottomWidth: 0.7,
    borderBottomColor: 'white',
    justifyContent: 'center',
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  matchHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: AppFonts.montserratBold,
  },
  matchViewAllPress: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  matchViewAll: {
    color: '#60A5FA',
    fontSize: 14,
    fontFamily: AppFonts.montserratSemiBold,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.background,
    borderBottomWidth: 0.7,
    borderBottomColor: 'white',
    width: '100%',
  },
  matchRowLeft: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    minWidth: 0,
  },
  matchMeta: {
    width: 76,
    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
    borderRightWidth:0.8,
    borderRightColor:"white"
  },
  liveTag: {
    color: '#FFF',
    backgroundColor: '#D4322E',
    fontSize: 9,
    fontFamily: AppFonts.montserratExtraBold,
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  matchMetaDay: { color: '#9CA3AF', fontSize: 10, fontFamily: AppFonts.montserratRegular, marginBottom: 2 },
  matchMetaClock: { color: '#E5E7EB', fontSize: 12, fontFamily: AppFonts.montserratSemiBold },
  matchTeamsBox: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 6,
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
  },
  matchInfoTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 4,
  },
  matchLeague: {
    color: '#D1D5DB',
    fontSize: 11,
    fontFamily: AppFonts.montserratRegular,
    flex: 1,
    minWidth: 140,
  },
  matchTeamsLine1: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: AppFonts.montserratSemiBold,
    lineHeight: 16,
  },
  matchTeamsLine2: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: AppFonts.montserratSemiBold,
    lineHeight: 16,
    marginTop: 2,
  },
  marketPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3,justifyContent:"flex-end",backgroundColor:"red" },
  marketPill: {
    backgroundColor: '#374151',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#6B7280',
  },
  marketPillText: { color: '#F9FAFB', fontSize: 8, fontFamily: AppFonts.montserratSemiBold },
  oddsStripStatic: {
    backgroundColor: '#0b1620',
    flexShrink: 0,
    alignSelf: 'stretch',
    flexDirection: 'column',
  },
  /** Single horizontal band: [B1][B2]…[Bk][L1][L2]…[Lk] */
  oddsStripRowHorizontal: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
  },
  oddsStripCell: {
    width: ODDS_CELL_W,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
    margin: 0,
    borderRightWidth: 1,
    borderRightColor: '#ffffff',
  },
  oddsStripCellLast: {
    borderRightWidth: 0,
  },
  oddsStripPrice: { color: '#0f172a', fontSize: 12, fontFamily: AppFonts.montserratExtraBold },
  oddsStripVol: { color: '#1e3a5f', fontSize: 9, fontFamily: AppFonts.montserratRegular, marginTop: 2 },
  oddsDash: { color: '#475569', fontSize: 14, fontFamily: AppFonts.montserratSemiBold },
})