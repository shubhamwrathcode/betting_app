import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
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
  Platform,
  UIManager,
  Dimensions,
  TouchableOpacity,
  FlatList,
} from 'react-native'
const isFabricRenderer = !!(globalThis as any)?.nativeFabricUIManager
// LayoutAnimation can cause crashes on Android during high-frequency scroll updates
// if (!isFabricRenderer && Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
//   UIManager.setLayoutAnimationEnabledExperimental(true)
// }
import { useAuth } from '../../hooks/useAuth'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { colors } from '../../theme/colors'
import { API_BASE_URL, apiClient } from '../../api/client'
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
import LiveIcon from '../../../assets/AppImages/live_icon.svg'
import CricketIcon from '../../../assets/AppImages/menu-icon19.svg'
import TennisIcon from '../../../assets/AppImages/menu-icon20.svg'
import SoccerIcon from '../../../assets/AppImages/soccer_icon.svg'
import CasinoVector from '../../../assets/AppImages/casino_vector.svg'
import SportVector from '../../../assets/AppImages/sport_vector.svg'
import LinearGradient from 'react-native-linear-gradient'
import Video, {
  ResizeMode,

} from 'react-native-video'
import FastImage from 'react-native-fast-image'
import { LandingFooter } from '../../components/common/LandingFooter'
import {
  formatTimeOnlyIST,
  getDayGroupIST,
  resolveEventTimeForIndiaDisplay,
} from '../../utils/matchTimeIST'
import { API_ENDPOINTS } from '../../api/endpoints'

/** Types */
export interface LandingPageProps {
  onOpenLogin?: () => void
  onOpenSignup?: () => void
  onOpenHome?: () => void
  navigation?: any
}

const heroSlides = [
  { id: 1, image: ImageAssets.homeBnrPng, heading: 'All Mini Games', subContent: 'Play More. Win Faster. Endless Fun Awaits.', navigateTo: 'Casino' },
  { id: 2, image: ImageAssets.homeBnr2Png, heading: 'Sports & Betting', subContent: 'Play Smart. Bet Big. Win with the Best Odds.', navigateTo: 'SportsBook' },
  { id: 3, image: ImageAssets.homeBnr3Png, heading: 'Casino', subContent: 'Play Live. Bet Bold. Win Real Rewards.', navigateTo: 'Casino' },
  { id: 4, image: ImageAssets.homeBnr4Png, heading: 'Dragon Tiger', subContent: 'Choose Your Side. Bet Fast. Win Instantly.', navigateTo: 'Casino', params: { searchSelection: { key: 'dt', categoryCode: 'Dragon Tiger' } } },
  { id: 5, image: ImageAssets.homeBnr5Png, heading: 'Aviator', subContent: 'Take Off Early. Cash Out Big. Win Smart.', action: 'launchGame', gameData: { code: 'aviator', providerCode: 'SPB', name: 'Aviator' } },
  { id: 6, image: ImageAssets.homeBnr6Png, heading: 'Cricket', subContent: 'Level up and unlock exclusive perks.', navigateTo: 'InPlay' },
  { id: 7, image: ImageAssets.homeBnr7Png, heading: 'Casino & Sports Hub', subContent: 'Bet Every Ball. Play Every Moment. Win Bigger.', navigateTo: 'Casino' },
]

// const topSportsItems = [
//   { id: 1, title: 'Cricket', icon: CricketIconSvg, to: 'InPlay' },
//   { id: 2, title: 'Football', icon: FootballPng, to: 'InPlay' },
//   { id: 3, title: 'Tennis', icon: TennisIconComponent, to: 'InPlay' },
//   { id: 4, title: 'Basketball', icon: BasketballIcon, to: 'SportsBook' },
//   { id: 5, title: 'Baseball', icon: BaseballIcon, to: 'SportsBook' },
//   { id: 6, title: 'Horse Racing', icon: HorseIcon, to: 'SportsBook' },
//   { id: 7, title: 'Ice Hockey', icon: IceHockeyIcon, to: 'SportsBook' },
//   { id: 8, title: 'Futsal', icon: FutsalIcon, to: 'SportsBook' },
// ]

const trendingCategories = [
  { name: 'Aviator', image: ImageAssets.aviatorImgPng, video: ImageAssets.vidAviator },
  { name: 'Dragon Tiger', image: ImageAssets.betcasinoImg4Png, video: ImageAssets.vidDragonTiger },
  { name: 'Chicken Road', image: ImageAssets.funChickenPng, video: ImageAssets.vidChickenRoad },
  { name: 'Baccarat', image: ImageAssets.betcasinoImg2Png, video: ImageAssets.vidBaccarat },
  { name: 'Roulette', image: ImageAssets.betcasinoImg3Png, video: ImageAssets.vidRoulette },
  { name: 'Teen Patti', image: ImageAssets.betcasinoImg5Png, video: ImageAssets.vidTeenPatti },
]

/** Constants for rendering */
const ODDS_BACK_ON = '#a7d8fd'
const ODDS_LAY_ON = '#f9c9d4'
const ODDS_BACK_OFF = '#d4ecfe'
const ODDS_LAY_OFF = '#fce4ea'
const ODDS_CELL_W = 56
const LANDING_ROW_H = 76
const LANDING_STRIP_MAX_COLS = 12

// --- Helper Functions ---

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

const isChickenRoadStyleGame = (g: LandingGame) => {
  if (!g) return false
  const code = String(g.code ?? (g as any).gameCode ?? '').toLowerCase()
  const name = String(g.name ?? '').toLowerCase()
  return code.includes('chicken') || name.includes('chicken')
}

const isCrashGameStyleGame = (g: LandingGame) => {
  if (!g) return false
  if (isChickenRoadStyleGame(g)) return false
  const hay = `${String(g.code ?? (g as any).gameCode ?? '')} ${String(g.name ?? '')}`.toLowerCase()
  return (
    hay.includes('aviator') ||
    hay.includes('crash') ||
    hay.includes('jetx') ||
    hay.includes('jet x') ||
    hay.includes('spaceman') ||
    hay.includes('lucky jet') ||
    hay.includes('luckyjet') ||
    (hay.includes('rocket') && hay.includes('crash'))
  )
}

const mergeDedupeGames = (...lists: LandingGame[][]): LandingGame[] => {
  const seen = new Set<string>()
  const out: LandingGame[] = []
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    for (const g of list) {
      if (!g) continue
      const id = (g as any)._id ?? (g as any).id
      const key =
        id != null && String(id).trim() !== ''
          ? `id:${String(id)}`
          : `gc:${String(g.providerCode ?? (g as any).provider ?? '').trim().toLowerCase()}:${String((g as any).gameCode ?? g.code ?? '').trim().toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(g)
    }
  }
  return out
}

const winW = Dimensions.get('window').width;

const SkeletonItem = ({ style }: { style?: any }) => {
  const move = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(move, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [move]);

  const translateX = move.interpolate({
    inputRange: [0, 1],
    outputRange: [-winW, winW],
  });

  return (
    <View style={[style, { backgroundColor: '#1e293b', overflow: 'hidden' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.12)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}


const GameSkeletonRow = () => (
  <View style={styles.sectionWrap}>
    <SkeletonItem style={{ width: 140, height: 20, borderRadius: 4, marginBottom: 16 }} />
    <View style={styles.gameRow}>
      {[1, 2, 3].map(i => (
        <SkeletonItem key={i} style={[styles.gameCard, { backgroundColor: '#1e293b' }]} />
      ))}
    </View>
  </View>
);

const MatchSectionSkeleton = ({ title, icon }: { title: string, icon: any }) => {
  const Icon = icon;
  return (
    <View style={styles.matchWrapper}>
      <View style={styles.matchHeader}>
        <View style={styles.matchHeaderLeft}>
          <Icon width={22} height={26} fill="#64748b" />
          <Text style={[styles.matchTitle, { color: '#64748b' }]}>{title}</Text>
        </View>
      </View>
      <View style={styles.matchSectionSkeletonList}>
        {[1, 2, 3].map(i => (
          <View key={i} style={styles.matchSkeletonRow}>
            <View style={styles.matchSkeletonLeft}>
              <SkeletonItem style={{ width: 60, height: 40, borderRadius: 4 }} />
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonItem style={{ width: '80%', height: 16, borderRadius: 4 }} />
                <SkeletonItem style={{ width: '50%', height: 12, borderRadius: 4 }} />
              </View>
            </View>
            <View style={styles.matchSkeletonRight}>
              <SkeletonItem style={{ width: 50, height: 50, borderRadius: 4 }} />
              <SkeletonItem style={{ width: 50, height: 50, borderRadius: 4 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};


// --- Removed local time formatters in favor of matchTimeIST ---

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
      const et = resolveEventTimeForIndiaDisplay(rawTime)
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
}

const mapSocketRowsToTopMatches = (rows: any[], tournament: string): SportsbookMatch[] => {
  return rows
    .map((m: any) => {
      const id = m.gameId ?? m.game_id ?? m.eventId ?? m.event_id
      if (!id) return null
      const raw = m.eventTime ?? m.event_time ?? pickMatchEventTime(m)
      const et = resolveEventTimeForIndiaDisplay(raw) ?? undefined
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

const getLandingGameImage = (item: LandingGame) =>
  item.thumb || item.thumbnail || item.image || item.icon || item.logo || ''

const GameCard = memo(({ game, onPress }: { game: any, onPress: (g: any) => void }) => {
  const imageUrl = useMemo(() => toAbsoluteImageUrl(getLandingGameImage(game)), [game]);
  return (
    <TouchableOpacity style={styles.gameCard} onPress={() => onPress(game)} activeOpacity={0.8}>
      <FastImage source={{ uri: imageUrl }} style={styles.gameCardImage} resizeMode={FastImage.resizeMode.cover} />
    </TouchableOpacity>
  );
}, (prev, next) => {
  const prevId = prev.game._id || prev.game.id || prev.game.code;
  const nextId = next.game._id || next.game.id || next.game.code;
  const prevImg = getLandingGameImage(prev.game);
  const nextImg = getLandingGameImage(next.game);
  return prevId === nextId && prevImg === nextImg;
});

// --- Optimized Atomic UI Components ---

const OddsCell = memo(({ side, pair, isLast }: { side: 'back' | 'lay'; pair: LandingOddsPairColumn | null; isLast?: boolean }) => {
  const raw = pair ? (side === 'back' ? pair.back : pair.lay) : null
  const sz = pair ? (side === 'back' ? pair.backSize : pair.laySize) : null
  const ok = raw != null && raw !== '—' && landingOddsValid(raw)
  const isBack = side === 'back'
  const bg = ok ? (isBack ? '#a7d8fd' : '#f9c9d4') : (isBack ? '#d4ecfe' : '#fce4ea')

  const showVol = (val: unknown) =>
    val != null && val !== '—' && String(val).trim() !== '' && String(val) !== '0.00'

  return (
    <View style={[styles.oddsStripCell, {
      width: 62, backgroundColor: bg,
      height: LANDING_ROW_H, borderLeftWidth: 1, borderLeftColor: 'white',
      borderBottomColor: 'white', borderBottomWidth: 1
    }]}>
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
}, (prev, next) => {
  const pPair = prev.pair;
  const nPair = next.pair;
  const pSide = prev.side;
  const nSide = next.side;

  const pRaw = pPair ? (pSide === 'back' ? pPair.back : pPair.lay) : null;
  const nRaw = nPair ? (nSide === 'back' ? nPair.back : nSide === 'lay' ? nPair.lay : null) : null;
  const pSz = pPair ? (pSide === 'back' ? pPair.backSize : pPair.laySize) : null;
  const nSz = nPair ? (nSide === 'back' ? nPair.backSize : nSide === 'lay' ? nPair.laySize : null) : null;

  return pRaw === nRaw && pSz === nSz && prev.isLast === next.isLast;
})

const MatchTeamRow = memo(({ row, eventTime, leftClusterW, onPress }: { row: SportsbookMatch, eventTime: any, leftClusterW: number, onPress: () => void }) => {
  const pills = marketPillCodesForRow(row)
  const { line1, line2 } = splitEventTitleLines(row.eventName ?? (row as any).event_name ?? row.name ?? row.teams)

  return (
    <Pressable
      style={[styles.matchRow, { height: LANDING_ROW_H }]}
      onPress={onPress}
    >
      <View style={[styles.matchRowLeft, { width: leftClusterW, height: LANDING_ROW_H, borderBottomWidth: 1, borderBottomColor: '#1c2f4a' }]}>
        <View style={styles.matchMeta}>
          <Text style={styles.matchMetaDay}>
            {getDayGroupIST(eventTime) || 'Today'}
          </Text>
          <Text style={styles.matchMetaTime} numberOfLines={1}>{formatTimeOnlyIST(eventTime) || '--:--'}</Text>
          {row.inPlay ?? (row as any).in_play ? <Text style={styles.liveTagStatic}>LIVE</Text> : null}
        </View>
        <View style={styles.matchTeamsBox}>
          <View style={styles.matchInfoTitleRow}>
            {pills.length > 0 && (
              <View style={styles.marketPillsRow}>
                {pills.map(p => (
                  <View key={p} style={styles.marketPill}>
                    <Text style={styles.marketPillText}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View>
            <Text style={styles.matchTeamsLine1} numberOfLines={1}>
              {safeText(line1, '—')}
            </Text>
            {line2 && (
              <Text style={styles.matchTeamsLine2} numberOfLines={1}>
                {line2}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  )
}, (prev, next) => {
  return prev.row.gameId === next.row.gameId &&
    prev.row.eventName === next.row.eventName &&
    prev.row.inPlay === next.row.inPlay &&
    prev.eventTime === next.eventTime &&
    prev.leftClusterW === next.leftClusterW;
})
console.log('sd')

const MatchOddsRow = memo(({ row, stripCols, maxCols, rowKey, onPress }: { row: SportsbookMatch, stripCols: LandingOddsPairColumn[], maxCols: number, rowKey: string, onPress: () => void }) => {
  return (
    <Pressable
      style={[styles.oddsRow, { height: LANDING_ROW_H, borderBottomWidth: 1, borderBottomColor: '#1c2f4a' }]}
      onPress={onPress}
    >
      <View style={styles.oddsStripRowHorizontal}>
        {Array.from({ length: maxCols }, (_, i) => {
          console.log('back mapping i:', i);
          return <OddsCell key={`b-${i}`} side="back" pair={stripCols[i] ?? null} />;
        })}
        {Array.from({ length: maxCols }, (_, i) => {
          console.log('lay mapping i:', i);
          return <OddsCell key={`l-${i}`} side="lay" pair={stripCols[i] ?? null} isLast={i === maxCols - 1} />;
        })}
      </View>
    </Pressable>
  )
}, (prev, next) => {
  // Check if odds count or values changed
  if (prev.maxCols !== next.maxCols || prev.stripCols.length !== next.stripCols.length) return false;

  // Fast loop for price/size checks
  for (let i = 0; i < prev.stripCols.length; i++) {
    const p = prev.stripCols[i];
    const n = next.stripCols[i];
    // If both are null/undefined, they are equal, continue loop
    if (!p && !n) continue;
    // If only one is null, they are different
    if (!p || !n) return false;
    // Both are objects, compare properties
    if (p.back !== n.back || p.lay !== n.lay || p.backSize !== n.backSize || p.laySize !== n.laySize) return false;
  }
  return prev.rowKey === next.rowKey;
})

// --- High-Performance Isolated Match Section ---

const MatchSection = memo(({ sportKey, navigation }: { sportKey: 'cricket' | 'tennis' | 'soccer', navigation: any }) => {
  const Icon = sportKey === 'cricket' ? CricketIcon : sportKey === 'tennis' ? TennisIcon : SoccerIcon
  const displayName = sportKey === 'cricket' ? 'Cricket' : sportKey === 'tennis' ? 'Tennis' : 'Football'

  const [data, setData] = useState<SportsbookMatch[]>([])
  const [loading, setLoading] = useState(true)
  const localRef = useRef<SportsbookMatch[]>([])
  const pendingRawRef = useRef<any[] | null>(null)

  // 1. ISOLATED SOCKET SYNC: Updates here only re-render THIS section
  useEffect(() => {
    let mounted = true;
    const interval = setInterval(() => {
      if (!mounted) return;

      let changed = false;
      if (pendingRawRef.current) {
        const defaults = sportKey === 'cricket' ? { tournament: 'Cricket' as const } : sportKey === 'tennis' ? { tournament: 'Tennis' as const } : { tournament: 'Football' as const };
        const mapped = mapMatchDataRowsToTopMatches(pendingRawRef.current, defaults);
        localRef.current = mapped;
        pendingRawRef.current = null;
        changed = true;
      }

      if (changed || localRef.current !== data) {
        setData(localRef.current);
      }
    }, 1200);

    const remove = addMatchDataListener((kind, payload) => {
      if (kind === 'error') return;
      const { sportName, matches } = normalizeMatchDataUpdatePayload(payload);
      const key = sportName === 'football' ? 'soccer' : sportName;
      if (key !== sportKey || !Array.isArray(matches) || matches.length === 0) return;

      pendingRawRef.current = matches;
      if (loading) {
        setLoading(false);
        const defaults = sportKey === 'cricket' ? { tournament: 'Cricket' as const } : sportKey === 'tennis' ? { tournament: 'Tennis' as const } : { tournament: 'Football' as const };
        const mapped = mapMatchDataRowsToTopMatches(matches, defaults);
        localRef.current = mapped;
        setData(mapped);
      }
    });

    return () => {
      mounted = false;
      remove();
      clearInterval(interval);
    };
  }, [sportKey, loading, data]);

  // 2. ISOLATED REST PREFETCH
  useEffect(() => {
    const prefetch = async () => {
      try {
        const res = await sportsbookService.getRawMatches(sportKey);
        const raw = normalizeRestMatchesList(res);
        const tourney = sportKey === 'cricket' ? 'Cricket' : sportKey === 'tennis' ? 'Tennis' : 'Football';
        const mapped = mapSocketRowsToTopMatches(raw, tourney);
        if (mapped.length > 0) {
          localRef.current = mapped;
          setData(mapped);
          setLoading(false);
        }
      } catch (e) { console.warn(`[MatchSection][${sportKey}] REST Prefetch failed`, e); }
    };
    prefetch();
  }, [sportKey]);

  const winW = useMemo(() => Dimensions.get('window').width, []);
  const leftClusterW = useMemo(() => Math.min(270, Math.round(winW * 0.58)), [winW]);

  // Use a ref to cache expensive odds calculations to avoid re-calculating everything on every data change
  const oddsCacheRef = useRef<Record<string, { stripCols: LandingOddsPairColumn[], eventTime: any }>>({});

  const sortedRows = useMemo(() => {
    const nextOddsCache: Record<string, { stripCols: LandingOddsPairColumn[], eventTime: any }> = {};

    const rows = data
      .map((row, idx) => {
        const id = row.gameId ?? row.game_id ?? row.eventId ?? row.event_id ?? idx;
        const rowKey = `${sportKey}-${id}`;

        // Use cached result if valid and row hasn't changed its odds payload reference
        const cached = oddsCacheRef.current[rowKey];
        if (cached && cached.stripCols && (row as any)._rawOdds === (row as any).matchOdds) {
          // Logic to check if matchOdds are same ref - but matches are usually new objects from socket.
          // We can do a shallow check of price/size instead.
        }

        const eventTime = row.eventTime ?? row.event_time ?? row.openDate ?? row.open_date;
        const oddsPayload = Array.isArray(row.matchOdds) && row.matchOdds.length > 0 ? { matchOdds: row.matchOdds as any[] } : null;
        const stripCols = getLandingOddsStripColumns({ ...row, teams: row.teams ?? row.eventName ?? row.name }, oddsPayload, LANDING_STRIP_MAX_COLS);

        const result = { row, eventTime, stripCols, rowKey };
        nextOddsCache[rowKey] = { stripCols, eventTime };
        return result;
      })
      .sort((a, b) => {
        const aLive = !!(a.row.inPlay ?? (a.row as any).in_play);
        const bLive = !!(b.row.inPlay ?? (b.row as any).in_play);
        if (aLive !== bLive) return aLive ? -1 : 1;
        const ta = typeof a.eventTime === 'string' && !Number.isNaN(new Date(a.eventTime).getTime()) ? new Date(a.eventTime).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = typeof b.eventTime === 'string' && !Number.isNaN(new Date(b.eventTime).getTime()) ? new Date(b.eventTime).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      })
      .slice(0, 25);

    oddsCacheRef.current = nextOddsCache;
    return rows;
  }, [data, sportKey]);

  const maxCols = useMemo(() => Math.max(1, ...sortedRows.map(r => r.stripCols.length)), [sortedRows]);
  const stripPx = useMemo(() => maxCols * ODDS_CELL_W * 2, [maxCols]);

  const openMatchDetail = useCallback((row: SportsbookMatch) => {
    navigation.navigate('MatchDetail', {
      sportName: sportKey,
      gameId: row.gameId ?? row.game_id,
      eventId: row.eventId ?? row.event_id,
      eventName: row.eventName ?? row.event_name ?? row.name,
      seriesName: row.seriesName ?? row.series_name,
    });
  }, [navigation, sportKey]);

  if (loading && data.length === 0) {
    return <MatchSectionSkeleton title={displayName} icon={Icon} />;
  }

  return (
    <View style={styles.matchWrapper}>
      <View style={styles.matchHeader}>
        <View style={styles.matchHeaderLeft}>
          <Icon width={22} height={26} fill="#FFFFFF" />
          <Text style={styles.matchTitle}>{displayName}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('SportsBook')} hitSlop={8} style={styles.matchViewAllPress}>
          <Text style={styles.matchViewAll}>View all</Text>
        </Pressable>
      </View>
      <View style={styles.matchSection}>
        <View style={[styles.matchBlockRow, { width: winW }]}>
          <View style={[styles.matchLeftCol, { width: leftClusterW }]}>
            {sortedRows.map(({ row, eventTime, rowKey }) => (
              <MatchTeamRow key={rowKey} row={row} eventTime={eventTime} leftClusterW={leftClusterW} onPress={() => openMatchDetail(row)} />
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={[styles.oddsOnlyHScrollInner, { width: stripPx }]}>
            <View style={styles.oddsOnlyCol}>
              {sortedRows.map(({ row, stripCols, rowKey }) => (
                <MatchOddsRow key={`${rowKey}-odds`} row={row} stripCols={stripCols} maxCols={maxCols} rowKey={rowKey} onPress={() => openMatchDetail(row)} />
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
});

// --- Main Page Component (Static Sections are Memoized) ---

const HeroSlider = memo(({ onTouchStart, onTouchEnd, heroIndex, heroProgress, heroDirection, heroAnimating, runHeroSlide, setHeroIndex, onSlidePress }: {
  onTouchStart: (e: GestureResponderEvent) => void,
  onTouchEnd: (e: GestureResponderEvent) => void,
  heroIndex: number,
  heroProgress: Animated.Value,
  heroDirection: 1 | -1,
  heroAnimating: boolean,
  runHeroSlide: (d: 1 | -1) => void,
  setHeroIndex: (i: number) => void,
  onSlidePress: (slide: any) => void
}) => {
  const dots = useMemo(() => Array.from({ length: heroSlides.length }, (_, i) => i), []);
  return (
    <ImageBackground source={ImageAssets.herobgMainJpg} style={styles.heroWrap} resizeMode="cover">
      <View style={styles.heroOverlay}>
        <View style={styles.heroCardRow} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {([-1, 0, 1] as const).map(offset => {
            const idx = (heroIndex + offset + heroSlides.length) % heroSlides.length;
            const slide = heroSlides[idx];
            const isCenter = offset === 0;
            return (
              <Animated.View key={`${slide.id}-${offset}`} style={[styles.hero3dCard, isCenter && styles.heroMainCard,
              offset === -1 ? styles.heroPosLeft1 : offset === 1 ? styles.heroPosRight1 : styles.heroPosCenter
              ]}>
                <Pressable style={{ flex: 1 }} onPress={() => isCenter && onSlidePress(slide)}>
                  <FastImage source={slide.image} style={styles.heroCardFill} resizeMode={FastImage.resizeMode.cover}>
                    {isCenter && (
                      <View style={styles.heroMainCardOverlay}>
                        <Text style={styles.heroMainTitle}>{slide.heading}</Text>
                        <Text style={styles.heroMainSubtitle}>{slide.subContent}</Text>
                      </View>
                    )}
                  </FastImage>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
        <View style={styles.heroNav}>
          <Pressable style={styles.heroArrowBtn} onPress={() => runHeroSlide(-1)}><Text style={styles.arrow}>‹</Text></Pressable>
          <View style={styles.dotRow}>{dots.map(i => <Pressable key={i} onPress={() => setHeroIndex(i)} style={[styles.dot, i === heroIndex && styles.dotActive]} />)}</View>
          <Pressable style={styles.heroArrowBtn} onPress={() => runHeroSlide(1)}><Text style={styles.arrow}>›</Text></Pressable>
        </View>
        <Text style={styles.heroHeadline}><Text style={styles.heroHeadlineAccent}>Your Ultimate</Text>{'\n'}Casino & Sports Gaming Hub</Text>
        <View style={styles.heroSubRow}>
          <Text style={styles.heroSubItem}><Text style={styles.heroSubBullet}>•</Text> Instant Deposit</Text>
          <Text style={styles.heroSubItem}><Text style={styles.heroSubBullet}>•</Text> Instant Withdrawal</Text>
        </View>
      </View>
    </ImageBackground>
  );
});

const QuickActions = memo(({ isAuthenticated, onOpenSignup, onOpenHome, onOpenLogin, handleLaunchGame, platformConfig }: {
  isAuthenticated: boolean,
  onOpenSignup?: () => void,
  onOpenHome?: () => void,
  onOpenLogin?: () => void,
  handleLaunchGame: (game: any) => void,
  platformConfig: any
}) => {
  const navigation = useNavigation<any>();

  return (
    <>
      <View style={[styles.heroOverlay, { paddingTop: 0 }]}>
        <View style={[styles.heroCtaRow, isAuthenticated && styles.heroCtaRowLoggedIn]}>
          {!isAuthenticated && <Pressable style={styles.signupBtn} onPress={onOpenSignup}><Text style={styles.signupBtnText}>Sign Up and Play</Text></Pressable>}
          <Pressable
            style={styles.depositBtn}
            onPress={() => {
              if (platformConfig && platformConfig.depositServiceStatus === false) {
                Toast.show({ type: 'error', text1: 'Deposits are temporarily unavailable. Please try again later.' });
                return;
              }
              if (isAuthenticated) {
                if (onOpenHome) onOpenHome();
                else navigation.navigate('Deposit');
              } else {
                if (onOpenLogin) onOpenLogin();
                else navigation.navigate('Login');
              }
            }}
          >
            <Text style={styles.signupBtnText}>Deposit Now</Text>
          </Pressable>
          <View style={styles.iconGroup}>
            {[
              { img: ImageAssets.spade, to: 'Casino' },
              { img: ImageAssets.football, to: 'InPlay' },
              { img: ImageAssets.dice, to: 'Casino' },
              { img: ImageAssets.airplane, action: 'launchAviator' }
            ].map((item, i) => (
              <Pressable
                key={i}
                style={styles.smallIcon}
                onPress={() => {
                  if (item.action === 'launchAviator') {
                    handleLaunchGame({ code: 'aviator', providerCode: 'SPB', name: 'Aviator' })
                  } else if (item.to) {
                    navigation.navigate(item.to)
                  }
                }}
              >
                <Image source={item.img} style={styles.smallIconImage} resizeMode="contain" />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.quickRow}>
        <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('Casino')}>
          <LinearGradient colors={['#9A0C4C', '#0B1A30']} style={styles.quickCard}><Text style={styles.quickTitle}>Casino ›</Text><CasinoVector width={120} height={120} style={styles.quickVector} /></LinearGradient>
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('InPlay')}>
          <LinearGradient colors={['#1D5EA8', '#0B1A30']} style={styles.quickCard}><Text style={styles.quickTitle}>Sport ›</Text><SportVector width={120} height={120} style={styles.quickVector} /></LinearGradient>
        </Pressable>
      </View>
    </>
  );
});

const TopStrip = memo(({ markVideoFailed, videoFailedSet }: {
  markVideoFailed: (name: string) => void,
  videoFailedSet: Set<string>
}) => {
  const navigation = useNavigation<any>();
  return (
    <View style={styles.topStrip}>
      {trendingCategories.map(cat => {
        const isFailed = videoFailedSet.has(cat.name);
        return (
          <Pressable
            key={cat.name}
            style={styles.stripCard}
            onPress={() => {
              if (cat.name === 'Aviator') {
                navigation.navigate('Casino', {
                  searchSelection: {
                    key: 'aviator',
                    provider: 'all',
                    category: 'Crash Type'
                  }
                });
              } else {
                navigation.navigate('Casino', {
                  searchSelection: {
                    key: cat.name.toLowerCase().replace(/ /g, ''),
                    category: cat.name
                  }
                });
              }
            }}
          >
            {/* Always render Image as background layer (fallback/poster) */}
            <Image source={cat.image} style={styles.stripCardImage} resizeMode="cover" />

            {(!isFailed && cat.video) && (
              <Video
                source={cat.video}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.COVER}
                repeat={true}
                muted={true}
                playInBackground={false}
                playWhenInactive={false}
                onError={() => markVideoFailed(cat.name)}
                hideShutterView={true}
                useTextureView={true}
                controls={false}
                bufferConfig={{
                  minBufferMs: 2000,
                  maxBufferMs: 5000,
                  bufferForPlaybackMs: 1000,
                  bufferForPlaybackAfterRebufferMs: 1500
                }}
              />
            )}
            <View style={styles.stripTitleBar}><Text style={styles.stripCardTitle}>{cat.name}</Text></View>
          </Pressable>
        );
      })}
    </View>
  );
});

const TopSportsSection = memo(({ navigation }: { navigation: any }) => {
  return (
    <View style={styles.topSportsWrapper}>
      <View style={styles.topSportsHeader}>
        <Text style={styles.topSportsTitle}>TOP Sports</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SportsBook')}>
          <View style={styles.topSportsGoBtn}>
            <Text style={styles.topSportsGoText}>Go to Sportsbook</Text>
          </View>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topSportsList}>
        {/* {topSportsItems.map(item => {
          const IconComp: any = item.icon;
          const isSvg = typeof IconComp === 'function' || (typeof IconComp === 'object' && IconComp.$$typeof);
          return (
            <TouchableOpacity key={item.id} style={styles.topSportsItem} onPress={() => navigation.navigate(item.to)}>
              <View style={styles.topSportsIconBox}>
                {isSvg ? (
                  <IconComp width={44} height={44} fill="#FFFFFF" />
                ) : (
                  <Image source={IconComp} style={[styles.topSportsIcon, { tintColor: '#FFFFFF' }]} resizeMode="contain" />
                )}
              </View>
              <Text style={styles.topSportsItemTitle} numberOfLines={1}>{item.title}</Text>
            </TouchableOpacity>
          );
        })} */}
      </ScrollView>
    </View>
  )
})

export const LandingPage = ({ onOpenLogin, onOpenSignup, onOpenHome, navigation: propsNav }: LandingPageProps) => {
  const { isAuthenticated, user } = useAuth()
  const navigation = useNavigation<any>()
  const finalNav = propsNav || navigation

  const [gamesLoading, setGamesLoading] = useState(true)
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(false)
  const [stripVideoFailed, setStripVideoFailed] = useState<Set<string>>(new Set())
  const [landingGames, setLandingGames] = useState<{
    liveCasino: LandingGame[];
    slots: LandingGame[];
    trending: LandingGame[];
    roulette: LandingGame[];
    cardGames: LandingGame[];
    chickenRoad: LandingGame[];
    crashGames: LandingGame[];
  }>({ liveCasino: [], slots: [], trending: [], roulette: [], cardGames: [], chickenRoad: [], crashGames: [] })
  const [casinoLobbyGames, setCasinoLobbyGames] = useState<LandingGame[]>([])
  const [platformConfig, setPlatformConfig] = useState<any>(null)

  const [ioChickenRoadGames, setIoChickenRoadGames] = useState<LandingGame[]>([])
  const [spbCrashGames, setSpbCrashGames] = useState<LandingGame[]>([])
  const [allCrashTypeGames, setAllCrashTypeGames] = useState<LandingGame[]>([])

  useEffect(() => {
    let mounted = true
    const loadFallbacks = async () => {
      try {
        const [io, spb, crashCat] = await Promise.all([
          landingService.getGamesByProvider('IO', 'all', 50),
          landingService.getGamesByProvider('SPB', 'all', 50),
          landingService.getGamesByProvider('all', 'Crash Type', 50)
        ])
        if (mounted) {
          setIoChickenRoadGames(io.filter(isChickenRoadStyleGame))
          setSpbCrashGames(spb.filter(isCrashGameStyleGame))
          setAllCrashTypeGames(crashCat)
        }
      } catch (e) { console.warn('[LandingPage] Fallback fetch failed', e) }
    }
    loadFallbacks()
    return () => { mounted = false }
  }, [])

  const chickenRoadResolved = useMemo(() => {
    if (landingGames.chickenRoad.length > 0) return landingGames.chickenRoad
    if (ioChickenRoadGames.length > 0) return ioChickenRoadGames
    return casinoLobbyGames.filter(isChickenRoadStyleGame)
  }, [landingGames.chickenRoad, ioChickenRoadGames, casinoLobbyGames])

  const crashGamesResolved = useMemo(() => {
    if (landingGames.crashGames.length > 0) return landingGames.crashGames
    return mergeDedupeGames(spbCrashGames, allCrashTypeGames)
  }, [landingGames.crashGames, spbCrashGames, allCrashTypeGames])
  useEffect(() => {
    subscribeMatchDataLandingAll()
    return () => { unsubscribeMatchDataLandingAll() }
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchConfig = async () => {
      try {
        const res = await apiClient<any>(API_ENDPOINTS.platformConfig, { method: 'GET' })
        const data = res?.data?.data ?? res?.data
        if (data && !cancelled) setPlatformConfig(data)
      } catch (e) { }
    }
    fetchConfig()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [g, l]: any = await Promise.all([landingService.getLandingGames(), landingService.getCasinoLobbyGames(18)])
        if (mounted) {
          if (g) setLandingGames(g);
          if (l) setCasinoLobbyGames(l);
          setGamesLoading(false);
        }
      } catch (e) { if (mounted) setGamesLoading(false); }
    }
    load()

    // NEW: Global matches loading listener
    const stopMatchesLoading = addMatchDataListener((kind, payload) => {
      if (kind === 'update' && mounted) {
        const { matches } = normalizeMatchDataUpdatePayload(payload);
        if (Array.isArray(matches) && matches.length > 0) {
          setMatchesLoading(false);
        }
      }
    });

    return () => { mounted = false; unsubscribeMatchDataLandingAll(); stopMatchesLoading(); }
  }, [])

  const [heroIndex, setHeroIndex] = useState(0)
  const [heroAnimating, setHeroAnimating] = useState(false)
  const [heroDirection, setHeroDirection] = useState<1 | -1>(1)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const heroProgress = useMemo(() => new Animated.Value(0), [])

  const runHeroSlide = useCallback((direction: 1 | -1) => {
    if (heroAnimating) return
    setHeroDirection(direction); setHeroAnimating(true); heroProgress.setValue(0)
    Animated.timing(heroProgress, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      setHeroIndex(prev => (prev + direction + heroSlides.length) % heroSlides.length); heroProgress.setValue(0); setHeroAnimating(false)
    })
  }, [heroAnimating, heroProgress]);

  useEffect(() => { const t = setInterval(() => runHeroSlide(1), 5000); return () => clearInterval(t); }, [runHeroSlide]);

  const handleLaunchGame = useCallback(async (game: any) => {
    if (!isAuthenticated) {
      const gCode = (game.code || game.gameCode || '').toLowerCase();
      if (gCode === 'aviator') {
        finalNav.navigate('Casino', {
          searchSelection: {
            key: 'aviator',
            provider: 'all',
            category: 'Crash Type'
          }
        });
      } else {
        onOpenLogin ? onOpenLogin() : finalNav.navigate('Login');
      }
      return;
    }
    const isDemoUser = (user as any)?.role === 'demo' || (user as any)?.isDemo === true
    if (isDemoUser) {
      // Allow launch
    }
    const targetCode = game.code || game.gameCode; if (!targetCode) return;
    setLaunchingGame(true);
    try {
      const res = await gameService.launchGame(targetCode, game.providerCode || 'all')
      const d = res.data ?? res; const url = d?.launchURL || d?.url;
      if (url) {
        finalNav.navigate('Game', { url, title: game.name || 'Game' })
      } else {
        Toast.show({ type: 'error', text1: 'Launch Failed', text2: 'No valid URL found for this game.' });
      }
    } catch (err: any) {
      console.warn('[LandingPage] handleLaunchGame error:', err);

      let cleanMsg = err?.message || 'Something went wrong';
      // If it's our verbose apiClient error, try to extract the inner message
      if (cleanMsg.includes(' - {')) {
        try {
          const jsonBody = cleanMsg.split(' - ').pop();
          if (jsonBody) {
            const parsed = JSON.parse(jsonBody);
            cleanMsg = parsed.message || parsed.msg || cleanMsg;
          }
        } catch { /* fallback to original msg */ }
      }
      // Strip common API prefixes
      cleanMsg = cleanMsg.replace(/^API request failed: [0-9]{3} [A-Za-z ]+ - /, '');

      Toast.show({
        type: 'error',
        text1: 'Game Unavailable',
        text2: cleanMsg
      });
    } finally {
      setLaunchingGame(false);
    }
  }, [isAuthenticated, onOpenLogin, finalNav]);

  const renderSection = useCallback((section: any) => {
    if (!section.items || section.items.length === 0) return null
    const isTwoRow = section.title === 'Casino Lobby'
    const items = section.items
    const row1 = isTwoRow ? items.slice(0, Math.ceil(items.length / 2)) : items
    const row2 = isTwoRow ? items.slice(Math.ceil(items.length / 2)) : []

    return (
      <View key={section.title} style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            {section.title !== 'Trending Games' && <LiveIcon width={20} height={20} />}
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          <TouchableOpacity onPress={() => finalNav.navigate('Casino')}>
            <View style={styles.categoryGoBtn}>
              <Text style={styles.categoryGoBtnText}>Go to {section.title}</Text>
            </View>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
          <View style={{ flexDirection: 'column' }}>
            <View style={styles.gameRow}>
              {row1.map((g: any, i: number) => (
                <GameCard key={g._id || g.id || i} game={g} onPress={handleLaunchGame} />
              ))}
            </View>
            {isTwoRow && row2.length > 0 && (
              <View style={[styles.gameRow, { marginTop: 12 }]}>
                {row2.map((g: any, i: number) => (
                  <GameCard key={g._id || g.id || i} game={g} onPress={handleLaunchGame} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }, [handleLaunchGame]);

  const listSections = useMemo(() => {
    const list: any[] = []
    if (!gamesLoading) {
      list.push({ type: 'game-section', title: 'Trending Games', items: landingGames.trending });
      list.push({ type: 'game-section', title: 'Roulette', items: landingGames.roulette });
      list.push({ type: 'game-section', title: 'Card Games', items: landingGames.cardGames });
      list.push({ type: 'game-section', title: 'Casino Lobby', items: casinoLobbyGames });
      list.push({ type: 'game-section', title: 'Live Casino', items: landingGames.liveCasino });
      list.push({ type: 'game-section', title: 'Slots', items: landingGames.slots });
      list.push({ type: 'game-section', title: 'Chicken Road', items: chickenRoadResolved });
      list.push({ type: 'game-section', title: 'Crash Games', items: crashGamesResolved });
      list.push({ type: 'top-sports' });
    } else {
      list.push({ type: 'games-loader' })
    }

    if (!matchesLoading) {
      list.push({ type: 'match-section', sportKey: 'cricket' })
      list.push({ type: 'match-section', sportKey: 'tennis' })
      list.push({ type: 'match-section', sportKey: 'soccer' })
    } else {
      list.push({ type: 'matches-loader' })
    }

    return list
  }, [gamesLoading, matchesLoading, landingGames, casinoLobbyGames, chickenRoadResolved, crashGamesResolved])

  const renderPageItem = useCallback(({ item }: { item: any }) => {
    switch (item.type) {
      case 'game-section':
        return renderSection(item)
      case 'games-loader':
        return <><GameSkeletonRow /><GameSkeletonRow /></>
      case 'matches-loader':
        return (
          <>
            <MatchSectionSkeleton title="Cricket" icon={CricketIcon} />
            <MatchSectionSkeleton title="Tennis" icon={TennisIcon} />
            <MatchSectionSkeleton title="Football" icon={SoccerIcon} />
          </>
        )
      case 'match-section':
        return <MatchSection sportKey={item.sportKey} navigation={finalNav} />
      // case 'top-sports':
      //   return <TopSportsSection navigation={finalNav} />
      default:
        return null
    }
  }, [renderSection, finalNav])

  const ListHeader = useMemo(() => (
    <View style={styles.mainContentArea}>
      <LandingHeader
        onLoginPress={onOpenLogin ?? (() => finalNav.navigate('Login'))}
        onSignupPress={onOpenSignup ?? (() => finalNav.navigate('Login', { initialTab: 'signup' }))}
        onSearchPress={() => finalNav.navigate('Search')}
      />

      <HeroSlider onTouchStart={e => setTouchStartX(e.nativeEvent.pageX)}
        onTouchEnd={e => {
          if (touchStartX === null) return;
          const d = e.nativeEvent.pageX - touchStartX;
          if (d < -40) runHeroSlide(1); else if (d > 40) runHeroSlide(-1);
          setTouchStartX(null);
        }}
        heroIndex={heroIndex} heroProgress={heroProgress} heroDirection={heroDirection}
        heroAnimating={heroAnimating} runHeroSlide={runHeroSlide} setHeroIndex={setHeroIndex}
        onSlidePress={(slide) => {
          if (slide.action === 'launchGame' && slide.gameData) {
            handleLaunchGame(slide.gameData)
          } else if (slide.navigateTo) {
            finalNav.navigate(slide.navigateTo, slide.params)
          }
        }}
      />

      <QuickActions
        isAuthenticated={isAuthenticated}
        onOpenSignup={onOpenSignup ?? (() => finalNav.navigate('Login', { initialTab: 'signup' }))}
        onOpenHome={onOpenHome ?? (() => finalNav.navigate('Deposit'))}
        onOpenLogin={onOpenLogin ?? (() => finalNav.navigate('Login'))}
        handleLaunchGame={handleLaunchGame}
        platformConfig={platformConfig}
      />

      {/* <TopStrip markVideoFailed={name => setStripVideoFailed(p => new Set(p).add(name))} videoFailedSet={stripVideoFailed} /> */}
    </View>
  ), [finalNav, onOpenLogin, onOpenSignup, touchStartX, runHeroSlide, heroIndex, heroProgress, heroDirection, heroAnimating, handleLaunchGame, isAuthenticated, onOpenHome, stripVideoFailed])

  const ListFooter = useMemo(() => <LandingFooter />, [])

  return (
    <View style={styles.page}>
      {launchingGame && <View style={styles.globalLoader}><ActivityIndicator size="large" color="#F97316" /></View>}
      <FlatList
        data={listSections}
        keyExtractor={(item, index) => item.type + (item.sportKey || index)}
        renderItem={renderPageItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </View>
  );
}

export default LandingPage

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#10131c' },
  scroll: { flex: 1 },
  mainContentArea: { backgroundColor: '#040f21', paddingBottom: 20 },
  heroWrap: { gap: 14 },
  heroOverlay: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 18, backgroundColor: 'rgba(7, 21, 43, 0.72)' },
  heroCardRow: { alignItems: 'center', justifyContent: 'center', height: 252, marginTop: 6, marginBottom: 10 },
  hero3dCard: { position: 'absolute', width: 136, height: 200, borderRadius: 18, borderWidth: 2, borderColor: '#8CA1BE', overflow: 'hidden', justifyContent: 'flex-end', elevation: 1 },
  heroCardFill: { flex: 1, justifyContent: 'flex-end' },
  heroMainCard: { width: 210, height: 220, borderRadius: 22, borderWidth: 3, borderColor: '#9CB0CA', zIndex: 2, elevation: 8 },
  heroPosLeft1: { transform: [{ translateX: -126 }, { translateY: 4 }, { scale: 0.84 }], opacity: 0.82, zIndex: 2 },
  heroPosCenter: { transform: [{ translateX: 0 }, { translateY: -16 }, { scale: 1 }], opacity: 1, zIndex: 9, elevation: 20 },
  heroPosRight1: { transform: [{ translateX: 126 }, { translateY: 4 }, { scale: 0.84 }], opacity: 0.82, zIndex: 2 },
  heroMainCardImage: { borderRadius: 20 },
  heroMainCardOverlay: { backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 10 },
  heroMainTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: AppFonts.montserratExtraBold, textAlign: 'center' },
  heroMainSubtitle: { color: '#E8EDF8', fontSize: 11, fontFamily: AppFonts.montserratRegular, textAlign: 'center' },
  heroNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 10 },
  heroArrowBtn: { width: 24, height: 22, alignItems: 'center', justifyContent: 'center' },
  arrow: { color: '#6B7282', fontSize: 24, lineHeight: 22, textAlign: 'center', includeFontPadding: false, transform: [{ translateY: -1 }] },
  dotRow: { flexDirection: 'row', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 20, backgroundColor: '#9098A7' },
  dotActive: { backgroundColor: '#FFF', width: 10, height: 10 },
  heroHeadline: { color: '#FFFFFF', textAlign: 'center', fontFamily: AppFonts.montserratExtraBold, fontSize: 19, lineHeight: 23, marginBottom: 8 },
  heroHeadlineAccent: { color: '#E07B34' },
  heroSubRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 14 },
  heroSubItem: { color: '#EA8D3A', fontSize: 10, lineHeight: 13, fontFamily: AppFonts.montserratSemiBold },
  heroSubBullet: { fontSize: 19, lineHeight: 13, fontFamily: AppFonts.montserratBold },
  heroCtaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 6, marginBottom: 8 },
  heroCtaRowLoggedIn: { justifyContent: 'center', gap: 10 },
  signupBtn: { backgroundColor: '#E07B34', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  depositBtn: { backgroundColor: '#1F2B45', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  signupBtnText: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 13 },
  iconGroup: { flexDirection: 'row', gap: 4 },
  smallIcon: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#1D2638', justifyContent: 'center', alignItems: 'center' },
  smallIconImage: { width: 16, height: 16, tintColor: '#fff' },
  quickRow: { paddingHorizontal: 12, flexDirection: 'row', gap: 10, marginTop: 10 },
  quickCard: { flex: 1, borderRadius: 14, minHeight: 132, padding: 12, justifyContent: 'space-between', overflow: 'hidden', position: 'relative' },
  quickTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 14 },
  quickVector: { position: 'absolute', bottom: -10, left: '50%', marginLeft: -60 },
  topStrip: { paddingHorizontal: 10, marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stripCard: { width: '31.4%', height: 86, borderRadius: 12, backgroundColor: '#111', overflow: 'hidden', position: 'relative' },
  stripCardImage: { ...StyleSheet.absoluteFillObject },
  stripTitleBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, backgroundColor: 'rgba(0, 0, 0, 0.62)', justifyContent: 'center', alignItems: 'center' },
  stripCardTitle: { color: '#FFFFFF', fontSize: 10, fontFamily: AppFonts.montserratBold, textAlign: 'center' },
  sectionWrap: { marginTop: 22, paddingHorizontal: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontFamily: AppFonts.montserratBold },
  categoryGoBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, },
  categoryGoBtnText: { color: '#2383f6', fontSize: 11, fontFamily: AppFonts.montserratSemiBold },
  gameRow: { flexDirection: 'row', gap: 12 },
  scrollContainer: { paddingRight: 12 },
  gameCard: { width: 156, height: 112, borderRadius: 14, backgroundColor: '#1F2C47', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  gameCardImage: { ...StyleSheet.absoluteFillObject, borderRadius: 14, opacity: 0.88 },
  globalLoader: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 9999, justifyContent: 'center', alignItems: 'center' },
  matchWrapper: { marginTop: 16, paddingHorizontal: 14 },
  matchSection: { backgroundColor: '#11161c', width: '100%', marginTop: 8, marginHorizontal: -14, overflow: 'visible' },
  matchBlockRow: { flexDirection: 'row', alignItems: 'flex-start' },
  matchLeftCol: { flexShrink: 0 },
  oddsOnlyHScrollInner: { flexGrow: 0, paddingRight: 1 },
  oddsOnlyCol: { flexDirection: 'column' },
  oddsRow: { backgroundColor: '#0b1620', borderBottomWidth: 0.7, borderBottomColor: 'white', justifyContent: 'center' },
  matchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  matchHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchTitle: {
    color: '#FFFFFF', fontSize: 16,
    fontFamily: AppFonts.montserratBold
  },
  matchViewAllPress: { paddingVertical: 4, paddingHorizontal: 4 },
  matchViewAll: {
    color: '#60A5FA', fontSize: 14,
    fontFamily: AppFonts.montserratSemiBold
  },
  matchRow: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: '#11161c', borderBottomWidth: 0.7,
    borderBottomColor: '#1c2f4a', width: '100%'
  },
  matchRowLeft: {
    flexDirection: 'row', alignItems: 'stretch',
    alignSelf: 'stretch', minWidth: 0
  },
  matchMeta: {
    width: 76, paddingVertical: 8, paddingHorizontal: 6,
    justifyContent: 'flex-end',
    alignSelf: 'stretch', borderRightWidth: 0.8, borderRightColor: '#1c2f4a'
  },
  liveTag: {
    color: '#FFF', backgroundColor: '#D4322E', fontSize: 9, fontFamily: AppFonts.montserratExtraBold, alignSelf: 'flex-start',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, marginBottom: 6, overflow: 'hidden'
  },
  liveTagStatic: {
    color: '#FFF', backgroundColor: '#D4322E', fontSize: 9, fontFamily: AppFonts.montserratExtraBold, alignSelf: 'flex-start',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, marginTop: 4, overflow: 'hidden'
  },
  matchMetaDay: { color: '#9CA3AF', fontSize: 10, fontFamily: AppFonts.montserratRegular, marginBottom: 2 },
  matchMetaTime: { color: '#FFFFFF', fontSize: 10, fontFamily: AppFonts.montserratSemiBold },
  topSportsWrapper: { marginTop: 20, marginBottom: 10, paddingHorizontal: 12 },
  topSportsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  topSportsTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: AppFonts.montserratBold },
  topSportsGoBtn: { backgroundColor: '#D5702A', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  topSportsGoText: { color: '#FFF', fontSize: 12, fontFamily: AppFonts.montserratSemiBold },
  topSportsList: { paddingRight: 20 },
  topSportsItem: { width: 100, alignItems: 'center', marginRight: 15 },
  topSportsIconBox: {
    width: 80, height: 80, backgroundColor: '#132238', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: '#1c2f4a'
  },
  topSportsIcon: { width: 44, height: 44 },
  topSportsItemTitle: { color: '#FFFFFF', fontSize: 13, fontFamily: AppFonts.montserratSemiBold, textAlign: 'center' },
  matchTeamsBox: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, justifyContent: 'center' },
  matchInfoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  marketPillsRow: { flexDirection: 'row', gap: 4 },
  marketPill: { backgroundColor: '#1F2937', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  marketPillText: { color: '#9CA3AF', fontSize: 10, fontFamily: AppFonts.montserratBold },
  matchTeamsLine1: { color: '#FFFFFF', fontSize: 13, fontFamily: AppFonts.montserratBold, marginBottom: 1 },
  matchTeamsLine2: { color: '#9CA3AF', fontSize: 12, fontFamily: AppFonts.montserratRegular },
  oddsStripRowHorizontal: { flexDirection: 'row', alignItems: 'center' },
  oddsStripCell: { height: LANDING_ROW_H, justifyContent: 'center', alignItems: 'center', borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.1)' },
  oddsStripCellLast: { borderRightWidth: 0 },
  oddsStripPrice: { color: '#111827', fontSize: 13, fontFamily: AppFonts.montserratBold },
  oddsStripVol: { color: '#374151', fontSize: 9, fontFamily: AppFonts.montserratRegular },
  oddsDash: { color: '#9CA3AF', fontSize: 15 },
  matchSectionSkeletonList: { backgroundColor: '#11161c', borderRadius: 12, overflow: 'hidden', padding: 12, gap: 12 },
  matchSkeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 12 },
  matchSkeletonLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  matchSkeletonRight: { flexDirection: 'row', gap: 6 },
})
