import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import FastImage from 'react-native-fast-image'
import { apiClient, API_BASE_URL } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { AppFonts } from '../../components/AppFonts'
import { ImageAssets } from '../../components/ImageAssets'

type SearchGame = {
  code?: string
  gameCode?: string
  game_code?: string
  name?: string
  gameName?: string
  game_name?: string
  providerCode?: string
  provider_code?: string
  thumb?: string
  thumbnail?: string
  image?: string
  icon?: string
  logo?: string
  category?: Array<{ code?: string; name?: string }>
  categoryCode?: string
  category_code?: string
}

type SearchMatch = {
  eventName?: string
  event_name?: string
  name?: string
}

const SEARCH_MIN_CHARS = 3
const SEARCH_LIMIT = 15
const DEBOUNCE_MS = 350
const GRID_COLUMNS = 2

const toAbsoluteImageUrl = (rawUrl: string) => {
  const src = rawUrl.trim()
  if (!src) return ''
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  if (src.startsWith('//')) return `https:${src}`
  if (src.startsWith('/')) return `${API_BASE_URL}${src}`
  return `${API_BASE_URL}/${src}`
}

const gameImage = (game: SearchGame) =>
  game.thumb || game.thumbnail || game.image || game.icon || game.logo || ''

const getGameCode = (game: SearchGame) =>
  game.gameCode || game.game_code || game.code || ''

const getProviderCode = (game: SearchGame) =>
  game.providerCode || game.provider_code || 'all'

const getGameName = (game: SearchGame) =>
  game.name || game.gameName || game.game_name || game.code || 'Game'

const getGameCategoryCode = (game: SearchGame) =>
  game.category?.[0]?.code ||
  game.category?.[0]?.name ||
  game.categoryCode ||
  game.category_code ||
  'lobby'

const parseSearchResponse = (res: any) => {
  const raw = res?.data ?? res
  const games = Array.isArray(raw?.games)
    ? raw.games
    : Array.isArray(raw?.data?.games)
      ? raw.data.games
      : []
  const matches = Array.isArray(raw?.matches)
    ? raw.matches
    : Array.isArray(raw?.data?.matches)
      ? raw.data.matches
      : []
  if (games.length || matches.length) return { games, matches }
  if (Array.isArray(raw)) return { games: raw, matches: [] }
  return { games: [], matches: [] }
}

const SearchScreen = () => {
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()

  const [query, setQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [results, setResults] = useState<{ games: SearchGame[]; matches: SearchMatch[] }>({
    games: [],
    matches: [],
  })
  const [trendingGames, setTrendingGames] = useState<SearchGame[]>([])
  const [trendingLoading, setTrendingLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    const loadTrending = async () => {
      setTrendingLoading(true)
      try {
        const res = await apiClient<any>(API_ENDPOINTS.gamesLanding, { skipAuth: true })
        const data = res?.data ?? res
        const list = Array.isArray(data?.trending)
          ? data.trending
          : Array.isArray(data?.data?.trending)
            ? data.data.trending
            : []
        if (mounted) setTrendingGames(list)
      } catch {
        if (mounted) setTrendingGames([])
      } finally {
        if (mounted) setTrendingLoading(false)
      }
    }
    loadTrending()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (query.trim().length < SEARCH_MIN_CHARS) {
      setResults({ games: [], matches: [] })
      return
    }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const q = encodeURIComponent(query.trim())
        const endpoint = `/api/v1/search?q=${q}&query=${q}&limit=${SEARCH_LIMIT}`
        const res = await apiClient<any>(endpoint, { skipAuth: true })
        setResults(parseSearchResponse(res))
      } catch {
        setResults({ games: [], matches: [] })
      } finally {
        setSearchLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const hasSearchText = useMemo(() => query.trim().length >= SEARCH_MIN_CHARS, [query])
  const gameCardWidth = '48%'

  const applyGameFilterFromSearch = (game: SearchGame) => {
    navigation.navigate('MainTabs', {
      screen: 'Casino',
      params: {
        searchSelection: {
          providerCode: getProviderCode(game) || 'all',
          categoryCode: getGameCategoryCode(game) || 'lobby',
          gameName: getGameName(game),
          key: Date.now(),
        },
      },
    })
  }

  const activeGames = hasSearchText ? results.games : trendingGames

  const renderHeader = () => (
    <View style={styles.resultsHeader}>
      {!hasSearchText ? (
        <View style={styles.trendingHeader}>
          <Text style={styles.blockTitle}>Trending games</Text>
          <Pressable
            onPress={() =>
              navigation.navigate('MainTabs', {
                screen: 'Casino',
                params: {
                  searchSelection: {
                    providerCode: 'all',
                    categoryCode: 'lobby',
                    gameName: '',
                    key: Date.now(),
                  },
                },
              })
            }
          >
            <Text style={styles.viewAllText}>View all</Text>
          </Pressable>
        </View>
      ) : searchLoading ? (
        <View style={styles.statusBox}>
          <ActivityIndicator size="small" color="#F0A769" />
          <Text style={styles.helpText}>Searching...</Text>
        </View>
      ) : (
        <>
          {results.matches.length > 0 && (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Matches</Text>
              {results.matches.map((match, idx) => (
                <Pressable
                  key={`match-${idx}`}
                  style={styles.matchItem}
                  onPress={() => navigation.navigate('MainTabs', { screen: 'SportsBook' })}
                >
                  <Text style={styles.matchName}>
                    {match.eventName || match.event_name || match.name || 'Match'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {results.games.length > 0 && (
            <Text style={[styles.blockTitle, { marginTop: 24, marginBottom: 12 }]}>Games</Text>
          )}

          {results.games.length === 0 && results.matches.length === 0 && (
            <Text style={styles.helpText}>No games or matches found</Text>
          )}
        </>
      )}
    </View>
  )

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.fixedHeaderArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Search</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Image source={ImageAssets.search} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search games and matches"
            placeholderTextColor="#8FA1BC"
            style={styles.searchInput}
          />
        </View>
      </View>

      <View style={{ flex: 1, }}>
        <FlatList
          data={activeGames}
          keyExtractor={(item, idx) => `${getGameCode(item)}-${idx}`}
          numColumns={GRID_COLUMNS}
          ListHeaderComponent={renderHeader}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40, flexGrow: 1 }]}
          columnWrapperStyle={styles.gridRow}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={10}
          onEndReachedThreshold={0.5}
          renderItem={({ item: game }) => {
            const img = gameImage(game)
            return (
              <Pressable
                style={styles.gameCardItem}
                onPress={() => applyGameFilterFromSearch(game)}
              >
                <View style={styles.imageContainer}>
                  <FastImage
                    source={img ? { uri: toAbsoluteImageUrl(img) } : ImageAssets.gameItemsliderPng}
                    style={styles.gameImage}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                </View>
                {hasSearchText && (
                  <Text style={styles.resultName} numberOfLines={1}>
                    {getGameName(game)}
                  </Text>
                )}
              </Pressable>
            )
          }}
          ListEmptyComponent={() =>
            !hasSearchText && !trendingLoading ? <Text style={styles.helpText}>No trending games available</Text> : null
          }
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#071229' },
  content: { paddingHorizontal: 12, paddingBottom: 20 },
  header: {
    paddingHorizontal: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 20 },
  closeText: { color: '#9CB1D0', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  searchBox: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#1A2840',
    borderWidth: 1,
    borderColor: '#2A3B58',
    paddingHorizontal: 10,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchIcon: { width: 18, height: 18, tintColor: '#A9BAD3' },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 13,
  },
  helpText: {
    marginTop: 12,
    color: '#8FA1BC',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 12,
  },
  block: { marginTop: 16 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blockTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 14 },
  viewAllText: { color: '#F0A769', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  fixedHeaderArea: { paddingHorizontal: 12, paddingBottom: 10 },
  resultsHeader: { paddingHorizontal: 12, paddingBottom: 10 },
  trendingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 12 },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  gridRow: { justifyContent: 'space-between', paddingHorizontal: 12 },
  gameCardItem: { width: '48%', marginBottom: 16 },
  imageContainer: { width: '100%', height: 138, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1F2C47' },
  gameImage: { width: '100%', height: '100%' },
  resultName: { color: '#E6EEFC', fontFamily: AppFonts.montserratMedium, fontSize: 12, marginTop: 6, paddingHorizontal: 2 },
  matchItem: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#15233A',
  },
  matchName: { color: '#E6EEFC', fontFamily: AppFonts.montserratMedium, fontSize: 13 },
})

export default SearchScreen
