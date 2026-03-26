import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { ImageAssets } from '../../components/ImageAssets'
import { AppFonts } from '../../components/AppFonts'
import { LandingHeader } from '../../components/common/LandingHeader'
import { useAuth } from '../../hooks/useAuth'
import { API_BASE_URL, apiClient } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { gameService } from '../../services/gameService'

type ProviderCategory = {
  code?: string
  name?: string
  thumb?: string
  thumbnail?: string
  image?: string
  icon?: string
  logo?: string
}
type Provider = { code?: string; name?: string; totalGames?: number; categories?: ProviderCategory[] }
type CasinoGame = {
  code?: string
  gameCode?: string
  name?: string
  providerCode?: string
  thumbnail?: string
  thumb?: string
}

const BANNER_IMAGES = [
  ImageAssets.casinoBnrImgPng,
  ImageAssets.casinoBnrImg2Png,
  ImageAssets.casinoBnrImg3Png,
  ImageAssets.casinoBnrImg4Png,
  ImageAssets.casinoBnrImg5Png,
  ImageAssets.casinoBnrImg6Png,
]

const FALLBACK_GAME_IMAGE = ImageAssets.homeBnr7Png
const PAGE_SIZE = 20

const toAbsoluteImageUrl = (rawUrl: string) => {
  const src = rawUrl.trim()
  if (!src) return ''
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  if (src.startsWith('//')) return `https:${src}`
  if (src.startsWith('/')) return `${API_BASE_URL}${src}`
  return `${API_BASE_URL}/${src}`
}

const getCategoryImage = (cat: ProviderCategory) => {
  const raw = cat.thumb || cat.thumbnail || cat.image || cat.icon || cat.logo || ''
  return typeof raw === 'string' ? raw.trim() : ''
}

const CasinoScreen = () => {
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const sliderRef = useRef<FlatList<number> | null>(null)
  const bannerWidth = Math.max(260, Dimensions.get('window').width - 24)

  const [bannerIndex, setBannerIndex] = useState(0)
  const [providers, setProviders] = useState<Provider[]>([])
  const [providersLoading, setProvidersLoading] = useState(true)
  const [categoryThumbErrors, setCategoryThumbErrors] = useState<Set<string>>(new Set())
  const [providerModalOpen, setProviderModalOpen] = useState(false)
  const [providerSearch, setProviderSearch] = useState('')
  const [selectedProviderCode, setSelectedProviderCode] = useState('all')
  const [selectedCategoryCode, setSelectedCategoryCode] = useState('lobby')

  const [games, setGames] = useState<CasinoGame[]>([])
  const [gamesPage, setGamesPage] = useState(1)
  const [hasMoreGames, setHasMoreGames] = useState(true)
  const [gamesLoading, setGamesLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [launchingGame, setLaunchingGame] = useState(false)

  useEffect(() => {
    let mounted = true
    const loadProviders = async () => {
      try {
        const res = await apiClient<any>(API_ENDPOINTS.gamesProviders, { skipAuth: true })
        if (!mounted) return
        const source = Array.isArray(res?.data?.providers)
          ? res.data.providers
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.providers)
              ? res.providers
              : []
        setProviders(source)
      } catch {
        if (mounted) setProviders([])
      } finally {
        if (mounted) setProvidersLoading(false)
      }
    }
    loadProviders()
    return () => {
      mounted = false
    }
  }, [])

  const categoriesForProvider = useMemo(() => {
    const lobby: ProviderCategory[] = [{ code: 'lobby', name: 'Lobby', thumb: '' }]
    if (selectedProviderCode === 'all') {
      const seen = new Set<string>(['lobby'])
      const all: ProviderCategory[] = [...lobby]
      providers.forEach(p => {
        ;(p.categories || []).forEach(c => {
          const code = String(c?.code || '').trim()
          if (!code || seen.has(code)) return
          seen.add(code)
          all.push(c)
        })
      })
      return all
    }
    const selected = providers.find(p => p.code === selectedProviderCode)
    return [...lobby, ...((selected?.categories || []) as ProviderCategory[])]
  }, [providers, selectedProviderCode])

  const selectedProviderName = useMemo(() => {
    if (selectedProviderCode === 'all') return 'Provider'
    return providers.find(p => p.code === selectedProviderCode)?.name || 'Provider'
  }, [providers, selectedProviderCode])

  const filteredProviders = useMemo(() => {
    const q = providerSearch.trim().toLowerCase()
    if (!q) return providers
    return providers.filter(p => (p.name || '').toLowerCase().includes(q))
  }, [providers, providerSearch])

  const fetchGames = useCallback(
    async (page: number, append: boolean) => {
      const categoryParam = selectedCategoryCode === 'lobby' ? 'all' : selectedCategoryCode
      const providerParam =
        selectedProviderCode.toLowerCase() === 'all' ? 'ALL' : selectedProviderCode
      const endpoint = `${API_ENDPOINTS.gamesList}?providerCode=${encodeURIComponent(
        providerParam,
      )}&category=${encodeURIComponent(categoryParam)}&page=${page}&limit=${PAGE_SIZE}`

      const res = await apiClient<any>(endpoint, { skipAuth: true })
      const list = Array.isArray(res?.data?.games)
        ? res.data.games
        : Array.isArray(res?.data?.data?.games)
          ? res.data.data.games
          : Array.isArray(res?.games)
            ? res.games
            : []
      setGames(prev => (append ? [...prev, ...list] : list))
      setHasMoreGames(list.length >= PAGE_SIZE)
      setGamesPage(page)
    },
    [selectedProviderCode, selectedCategoryCode],
  )

  useEffect(() => {
    let mounted = true
    setGamesLoading(true)
    setGames([])
    setGamesPage(1)
    setHasMoreGames(true)
    fetchGames(1, false)
      .catch(() => {
        if (mounted) {
          setGames([])
          setHasMoreGames(false)
        }
      })
      .finally(() => {
        if (mounted) setGamesLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [fetchGames])

  const handleLoadMore = async () => {
    if (loadingMore || gamesLoading || !hasMoreGames) return
    setLoadingMore(true)
    try {
      await fetchGames(gamesPage + 1, true)
    } catch {
      setHasMoreGames(false)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleLaunchGame = async (game: CasinoGame) => {
    if (!isAuthenticated) {
      Toast.show({
        type: 'error',
        text1: 'Authentication Required',
        text2: 'Please login to play games',
      })
      navigation.navigate('Login', { initialTab: 'login' })
      return
    }
    const gameCode = game.gameCode || game.code
    const providerCode = game.providerCode || 'all'
    if (!gameCode) return
    setLaunchingGame(true)
    try {
      const res = await gameService.launchGame(gameCode, providerCode)
      const d = res.data ?? (res as any).response?.data ?? (res as any).result ?? res
      const launchURL =
        d?.launchURL ||
        d?.launchUrl ||
        d?.url ||
        d?.gameUrl ||
        d?.gameURL ||
        d?.iframeUrl ||
        (typeof d === 'string' ? d : null)
      if (!launchURL) throw new Error('Launch URL missing')
      navigation.navigate('Game', { url: launchURL, title: game.name || 'Game' })
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Launch Failed',
        text2: 'Could not start the game',
      })
    } finally {
      setLaunchingGame(false)
    }
  }

  const renderGameItem = ({ item }: { item: CasinoGame }) => {
    const img = item.thumbnail || item.thumb
    return (
      <Pressable style={styles.gameCard} onPress={() => handleLaunchGame(item)}>
        <Image
          source={img ? { uri: toAbsoluteImageUrl(img) } : FALLBACK_GAME_IMAGE}
          defaultSource={FALLBACK_GAME_IMAGE}
          style={styles.gameImage}
        />
        <View style={styles.playOverlay}>
          <Image source={ImageAssets.playbtnPng} style={styles.playIcon} />
        </View>
        <Text style={styles.gameName} numberOfLines={1}>
          {item.name || item.code || 'Game'}
        </Text>
      </Pressable>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {!isAuthenticated ? (
        <LandingHeader
          onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
          onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        />
      ) : null}

      {launchingGame ? (
        <View style={styles.globalLoader}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={styles.loaderText}>Starting Game...</Text>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: 90 }]}
        scrollEventThrottle={16}
        onScroll={e => {
          const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent
          const distanceFromBottom =
            contentSize.height - (contentOffset.y + layoutMeasurement.height)
          if (distanceFromBottom < 220) {
            handleLoadMore()
          }
        }}
      >
        <View style={styles.bannerWrap}>
          <FlatList
            ref={sliderRef}
            data={BANNER_IMAGES}
            horizontal
            pagingEnabled
            bounces={false}
            style={{ width: bannerWidth, alignSelf: 'center' }}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, idx) => `banner-${idx}`}
            getItemLayout={(_, index) => ({
              length: bannerWidth,
              offset: bannerWidth * index,
              index,
            })}
            onMomentumScrollEnd={e => {
              const w = e.nativeEvent.layoutMeasurement.width
              const x = e.nativeEvent.contentOffset.x
              setBannerIndex(Math.round(x / w))
            }}
            renderItem={({ item: img, index: idx }) => (
              <View key={idx} style={[styles.bannerSlide, { width: bannerWidth }]}>
                <Image
                  source={img}
                  resizeMode="cover"
                  style={[styles.bannerImage, { width: bannerWidth }]}
                />
              </View>
            )}
          />
          <View style={styles.dotRow}>
            {BANNER_IMAGES.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  sliderRef.current?.scrollToOffset({ offset: i * bannerWidth, animated: true })
                  setBannerIndex(i)
                }}
                style={[styles.dot, i === bannerIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        <View style={styles.filterRow}>
          <Pressable style={styles.searchBtn}>
            <Image source={ImageAssets.search} style={styles.searchIcon} />
          </Pressable>
          <Pressable style={styles.providerBtn} onPress={() => setProviderModalOpen(true)}>
            <Image source={ImageAssets.spade} style={styles.providerIcon} />
            <Text style={styles.providerText}>{selectedProviderName}</Text>
            <Image source={ImageAssets.down} style={styles.providerArrow} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categoriesForProvider.map(cat => {
            const active = selectedCategoryCode === cat.code
            const key = cat.code || cat.name || 'cat'
            const thumb = getCategoryImage(cat)
            const hasThumb = thumb.length > 0 && !categoryThumbErrors.has(key)
            console.log(cat,'===image===')
            return (
              <Pressable
                key={cat.code || 'cat'}
                onPress={() => setSelectedCategoryCode(cat.code || 'lobby')}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
              >
                {hasThumb ? (
                  <Image
                    source={{ uri: toAbsoluteImageUrl(thumb) }}
                    style={styles.categoryThumb}
                    resizeMode="contain"
                    onError={() =>
                      setCategoryThumbErrors(prev => {
                        const next = new Set(prev)
                        next.add(key)
                        return next
                      })
                    }
                  />
                ) : (
                  <Image
                    source={cat.code === 'lobby' ? ImageAssets.gamepad : ImageAssets.honorofkingsfill}
                    style={[styles.categoryFallbackIcon, active && styles.categoryFallbackIconActive]}
                    resizeMode="contain"
                  />
                )}
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                  {cat.name || cat.code}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>
          {selectedProviderCode === 'all' ? 'All Games' : selectedProviderName} -{' '}
          {categoriesForProvider.find(c => c.code === selectedCategoryCode)?.name || 'Lobby'}
        </Text>

        {gamesLoading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color="#2E90FA" />
            <Text style={styles.emptyText}>Loading games...</Text>
          </View>
        ) : games.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No games in this category.</Text>
          </View>
        ) : (
          <View style={styles.gamesGrid}>
            {games?.map((game, idx) => (
              <View
                key={`${game.providerCode || 'all'}-${game.gameCode || game.code || idx}`}
                style={styles.gameCell}
              >
                {renderGameItem({ item: game })}
              </View>
            ))}
          </View>
        )}

        {loadingMore ? (
          <View style={styles.footerLoading}>
            <ActivityIndicator color="#2E90FA" />
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={providerModalOpen} transparent animationType="fade" onRequestClose={() => setProviderModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setProviderModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <TextInput
              value={providerSearch}
              onChangeText={setProviderSearch}
              placeholder="Search providers"
              placeholderTextColor="#8EA2BF"
              style={styles.searchInput}
            />
            <ScrollView>
              <Pressable
                style={styles.providerItem}
                onPress={() => {
                  setSelectedProviderCode('all')
                  setSelectedCategoryCode('lobby')
                  setProviderModalOpen(false)
                }}
              >
                <Text style={styles.providerItemText}>All</Text>
              </Pressable>
              {providersLoading ? (
                <ActivityIndicator color="#2E90FA" style={{ marginTop: 12 }} />
              ) : (
                filteredProviders.map(p => (
                  <Pressable
                    key={p.code || p.name || 'provider'}
                    style={styles.providerItem}
                    onPress={() => {
                      setSelectedProviderCode(p.code || 'all')
                      setSelectedCategoryCode('lobby')
                      setProviderModalOpen(false)
                    }}
                  >
                    <Text style={styles.providerItemText}>{p.name || p.code}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040f21' },
  content: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 0 },
  bannerWrap: { marginVertical: 10 },
  bannerSlide: { justifyContent: 'center', },
  bannerImage: {
    height: 250,
    borderRadius: 16,
  },
  dotRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 },
  dot: { width: 10, height: 10, borderRadius: 8, backgroundColor: '#49576B' },
  dotActive: { backgroundColor: '#2E90FA', width: 24 },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  searchBtn: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#3A4657',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: { width: 20, height: 20, tintColor: '#D8E1EF' },
  providerBtn: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#3A4657',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  providerIcon: { width: 16, height: 16, tintColor: '#E7853A' },
  providerText: { flex: 1, color: '#E4ECFA', fontSize: 15, fontFamily: AppFonts.montserratSemiBold },
  providerArrow: { width: 18, height: 18, tintColor: '#A8B7CD' },
  categoryRow: { gap: 8, paddingBottom: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#29384F',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  categoryChipActive: { backgroundColor: '#E07B34' },
  categoryThumb: {
    width: 20,
    height: 20,
    borderRadius: 3,
  },
  categoryFallbackIcon: {
    width: 16,
    height: 16,
    tintColor: '#AFC0D9',
  },
  categoryFallbackIconActive: {
    tintColor: '#FFFFFF',
  },
  categoryText: { color: '#E1E8F5', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  categoryTextActive: { color: '#FFFFFF' },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 28 / 2,
    fontFamily: AppFonts.montserratBold,
    marginTop: 10,
    marginBottom: 12,
  },
  gamesRow: { justifyContent: 'space-between' },
  gamesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gameCell: { width: '48%' },
  gameCard: { width: '100%', marginBottom: 14 },
  gameImage: { width: '100%', height: 145, borderRadius: 14, backgroundColor: '#0F1B2F' },
  playOverlay: {
    position: 'absolute',
    top: 52,
    left: '50%',
    marginLeft: -16,
    width: 32,
    height: 32,
  },
  playIcon: { width: 32, height: 32, resizeMode: 'contain' },
  gameName: {
    marginTop: 8,
    color: '#F6FAFF',
    fontSize: 14,
    fontFamily: AppFonts.montserratMedium,
  },
  emptyWrap: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyText: { color: '#AAB9CF', fontSize: 13, fontFamily: AppFonts.montserratRegular },
  footerLoading: { paddingVertical: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  modalCard: {
    backgroundColor: '#101A2E',
    borderRadius: 12,
    maxHeight: '70%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#273752',
  },
  searchInput: {
    backgroundColor: '#1C2A43',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    color: '#FFF',
    marginBottom: 10,
    fontFamily: AppFonts.montserratRegular,
  },
  providerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#22304A',
  },
  providerItemText: { color: '#E8EEFB', fontSize: 14, fontFamily: AppFonts.montserratSemiBold },
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
})

export default CasinoScreen
