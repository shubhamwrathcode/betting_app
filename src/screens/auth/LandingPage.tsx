import React, { useCallback, useEffect, useMemo, useState } from 'react'
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
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
import Video, { ResizeMode } from 'react-native-video'
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

const safeText = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallback
}

const getLandingGameImage = (item: LandingGame) =>
  item.thumb || item.thumbnail || item.image || item.icon || item.logo || ''

const toAbsoluteImageUrl = (rawUrl: string) => {
  const src = rawUrl.trim()
  if (!src) return ''
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  if (src.startsWith('//')) return `https:${src}`
  if (src.startsWith('/')) return `${API_BASE_URL}${src}`
  return `${API_BASE_URL}/${src}`
}

const formatMatchTime = (input: unknown) => {
  if (typeof input !== 'string' || !input) return 'Today\n--:--'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return 'Today\n--:--'
  const day = d.toLocaleDateString('en-IN', { weekday: 'long' })
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${day}\n${time.toLowerCase()}`
}

const extractOdds = (match: SportsbookMatch) => {
  const selection = Array.isArray(match.selections) ? match.selections[0] : undefined
  const backs = Array.isArray(selection?.back) ? selection.back : []
  const lays = Array.isArray(selection?.lay) ? selection.lay : []

  return [0, 1, 2, 3, 4].map(index => {
    const back = backs[index]
    const lay = lays[index]
    const price = back?.price ?? lay?.price
    const size = back?.stack ?? lay?.stack
    return {
      price: price != null ? String(price) : '-',
      size: size != null ? String(size) : '-',
    }
  })
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
  const [matchesError, setMatchesError] = useState<string | null>(null)
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

  useEffect(() => {
    let mounted = true
    const loadMatches = async () => {
      try {
        const [cricket, tennis, soccer] = await Promise.all([
          sportsbookService.getCricketMatches(),
          sportsbookService.getTennisMatches(),
          sportsbookService.getSoccerMatches(),
        ])
        if (!mounted) return
        setCricketMatches(cricket.slice(0, 10))
        setTennisMatches(tennis.slice(0, 10))
        setFootballMatches(soccer.slice(0, 10))
        setMatchesError(null)
      } catch (error) {
        if (!mounted) return
        setCricketMatches([])
        setTennisMatches([])
        setFootballMatches([])
        setMatchesError(error instanceof Error ? error.message : 'Failed to load matches')
      } finally {
        if (mounted) setMatchesLoading(false)
      }
    }
    loadMatches()
    return () => {
      mounted = false
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
      return (
        <TouchableOpacity
          key={idx}
          style={[styles.gameCard, isSmall && styles.gameCardSmall]}
          onPress={() => handleLaunchGame(game)}
          activeOpacity={0.8}
        >
          {imgUrl ? (
            <Image
              source={{ uri: toAbsoluteImageUrl(imgUrl) }}
              style={styles.gameCardImage}
              resizeMode="cover"
            />
          ) : null}
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

  const renderMatchBlock = (title: string, data: SportsbookMatch[]) => {
    const isCricket = title.includes('Cricket')
    const isTennis = title.includes('Tennis')
    const isFootball = title.includes('Football')

    const Icon = isCricket ? CricketIcon : isTennis ? TennisIcon : SoccerIcon
    const displayName = isCricket ? 'Cricket' : isTennis ? 'Tennis' : isFootball ? 'Football' : title

    return (
      <View style={styles.matchWrapper}>
        <View style={styles.matchHeader}>
          <View style={styles.matchHeaderLeft}>
            <Icon width={20} height={24} fill="#FFFFFF" />
            <Text style={styles.matchTitle}>{displayName}</Text>
          </View>
          <View style={styles.matchHeaderRight}>
            <View style={styles.matchBadge}><Text style={styles.matchBadgeText}>+ Live</Text></View>
            <View style={styles.matchBadge}><Text style={styles.matchBadgeText}>+ Virtual</Text></View>
            <View style={styles.matchBadge}><Text style={styles.matchBadgeText}>+ Premium</Text></View>
          </View>
        </View>

        <View style={styles.matchSection}>
          {data.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>No matches at the moment.</Text>
            </View>
          ) : (
            data.map((row, rowIndex) => {
              const eventTime = row.eventTime ?? row.event_time ?? row.openDate ?? row.open_date
              const odds = extractOdds(row)
              return (
                <View key={`${title}-${row.gameId ?? row.game_id ?? row.eventId ?? row.event_id ?? rowIndex}`} style={styles.matchRow}>
                  <View style={styles.matchMeta}>
                    {row.inPlay ?? row.in_play ? <Text style={styles.liveTag}>LIVE</Text> : null}
                    <Text style={styles.matchMetaTime}>{formatMatchTime(eventTime)}</Text>
                  </View>
                  <View style={styles.matchTeamsBox}>
                    <Text style={styles.matchLeague}>{safeText(row.seriesName ?? row.series_name, 'Match')}</Text>
                    <Text style={styles.matchTeams}>
                      {safeText(row.eventName ?? row.event_name ?? row.name, 'Team A vs Team B')}
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.oddsContainer}>
                    {odds.map((odd, i) => (
                      <View key={`${row.eventId ?? row.gameId}-${i}`} style={[styles.oddCol, i > 2 && styles.oddColPink]}>
                        <Text style={styles.oddValue}>{odd.price}</Text>
                        <Text style={styles.oddSize}>{odd.size}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )
            })
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
      <View style={[styles.mainContentArea, isAuthenticated && { paddingTop: insets.top }]}>
        {!isAuthenticated && <LandingHeader onLoginPress={onOpenLogin} onSignupPress={onOpenSignup} />}

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
            <View style={styles.heroCtaRow}>
              <Pressable style={styles.signupBtn} onPress={onOpenSignup}>
                <Text style={styles.signupBtnText}>Sign Up and Play</Text>
              </Pressable>
              <Pressable style={styles.depositBtn} onPress={onOpenHome}>
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
          {trendingCategories.map((cat, idx) => (
            <Pressable key={cat.name} style={styles.stripCard} onPress={onOpenLogin}>
              <Video
                source={cat.video}
                style={styles.stripCardImage}
                paused={false}
                repeat={true}
                muted={true}
                playInBackground={true}
                playWhenInactive={true}
                resizeMode={ResizeMode.COVER}
                poster={Image.resolveAssetSource(cat.image).uri}
              />
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
          sections.map(renderSection)
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
        ) : matchesError ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{matchesError}</Text>
          </View>
        ) : (
          <>
            {renderMatchBlock('Cricket Matches', cricketMatches)}
            {renderMatchBlock('Tennis Matches', tennisMatches)}
            {renderMatchBlock('Football Matches', footballMatches)}
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
  matchWrapper: { marginTop: 16 },
  matchSection: {
    backgroundColor: '#11151c', paddingVertical: 4,
    width: '100%',
    marginTop: 10
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginHorizontal: 16,
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
  matchHeaderRight: {
    flexDirection: 'row',
    gap: 6,
  },
  matchBadge: {
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(31, 41, 55, 0.4)',
  },
  matchBadgeText: {
    color: '#E5E7EB',
    fontSize: 11,
    fontFamily: AppFonts.montserratSemiBold,
  },
  matchRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#1B2D49', backgroundColor: '#0A152A', marginBottom: 4 },
  matchMeta: { width: 66, padding: 6, borderRightWidth: 1, borderRightColor: '#1B2D49', justifyContent: 'center' },
  liveTag: { color: '#FFF', backgroundColor: '#D4322E', fontSize: 9, fontFamily: AppFonts.montserratExtraBold, alignSelf: 'flex-start', paddingHorizontal: 5, borderRadius: 3, marginBottom: 4 },
  matchMetaTime: { color: '#D8DDEE', fontSize: 11, fontFamily: AppFonts.montserratRegular },
  matchTeamsBox: { flex: 1, padding: 8, borderRightWidth: 1, borderRightColor: '#1B2D49', justifyContent: 'center' },
  matchLeague: { color: '#E4E9F7', fontSize: 10, fontFamily: AppFonts.montserratRegular, marginBottom: 3 },
  matchTeams: { color: '#FFFFFF', fontSize: 13, fontFamily: AppFonts.montserratSemiBold, lineHeight: 18 },
  oddsContainer: { flexDirection: 'row' },
  oddCol: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#CDEEFF',
    paddingVertical: 6,
  },
  oddColPink: { backgroundColor: '#F0D9E4' },
  oddValue: { color: '#152136', fontSize: 13, fontFamily: AppFonts.montserratExtraBold },
  oddSize: { color: '#1A2B45', fontSize: 10, fontFamily: AppFonts.montserratRegular },
})