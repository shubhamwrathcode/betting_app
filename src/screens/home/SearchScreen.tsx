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
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120, flexGrow: 1 }]}
      >
        <View style={styles.searchBox}>
          <Image source={ImageAssets.search} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search games and matches"
            placeholderTextColor="#8FA1BC"
            style={styles.searchInput}
            autoFocus
          />
        </View>

        {!hasSearchText ? (
          <Text style={styles.helpText}>Enter at least {SEARCH_MIN_CHARS} characters to search</Text>
        ) : searchLoading ? (
          <Text style={styles.helpText}>Searching...</Text>
        ) : (
          <>
            {results.games.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Games</Text>
                <FlatList
                  data={results.games}
                  keyExtractor={(game, idx) => `${game.code || game.gameCode || idx}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollList}
                  renderItem={({ item: game }) => {
                    const img = gameImage(game)
                    return (
                      <Pressable
                        style={styles.horizontalGameCard}
                        onPress={() => applyGameFilterFromSearch(game)}
                      >
                        <Image
                          source={img ? { uri: toAbsoluteImageUrl(img) } : ImageAssets.gameItemsliderPng}
                          style={styles.horizontalGameImage}
                        />
                        <Text style={styles.resultName} numberOfLines={1}>
                          {getGameName(game)}
                        </Text>
                      </Pressable>
                    )
                  }}
                />
              </View>
            ) : null}

            {results.matches.length > 0 ? (
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
            ) : null}

            {results.games.length === 0 && results.matches.length === 0 ? (
              <Text style={styles.helpText}>No games or matches found</Text>
            ) : null}
          </>
        )}

        <View style={styles.block}>
          <View style={styles.blockHeader}>
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
          {trendingLoading ? (
            <Text style={styles.helpText}>Loading trending...</Text>
          ) : (
            <FlatList
              data={trendingGames}
              keyExtractor={(game, idx) => `${game.code || game.gameCode || idx}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollList}
              renderItem={({ item: game }) => {
                const img = gameImage(game)
                return (
                  <Pressable
                    style={styles.horizontalTrendCard}
                    onPress={() => applyGameFilterFromSearch(game)}
                  >
                    <Image
                      source={img ? { uri: toAbsoluteImageUrl(img) } : ImageAssets.gameItemsliderPng}
                      style={styles.horizontalTrendImage}
                    />
                  </Pressable>
                )
              }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#071229' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 12, paddingBottom: 20 },
  header: {
    paddingHorizontal: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 20  },
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
  horizontalScrollList: { paddingRight: 20, gap: 12, paddingTop: 10 },
  horizontalGameCard: { width: 146, gap: 8 },
  horizontalGameImage: { width: '100%', height: 104, borderRadius: 10, backgroundColor: '#18243A' },
  resultName: { color: '#E6EEFC', fontFamily: AppFonts.montserratMedium, fontSize: 12, marginTop: 4 },
  matchItem: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#15233A',
  },
  matchName: { color: '#E6EEFC', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  horizontalTrendCard: { width: 146, height: 104, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1F2C47' },
  horizontalTrendImage: { width: '100%', height: '100%' },
})

export default SearchScreen
