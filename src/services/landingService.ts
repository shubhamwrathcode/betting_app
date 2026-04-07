import { apiClient } from '../api/client'
import { API_ENDPOINTS } from '../api/endpoints'

export type LandingGame = {
  code?: string
  name?: string
  providerCode?: string
  thumbnail?: string
  thumb?: string
  image?: string
  icon?: string
  logo?: string
  category?: Array<{ code?: string; name?: string }>
}

type LandingGamesPayload = {
  liveCasino?: LandingGame[]
  slots?: LandingGame[]
  trending?: LandingGame[]
  roulette?: LandingGame[]
  cardGames?: LandingGame[]
  chickenRoad?: LandingGame[]
  crashGames?: LandingGame[]
}

type LandingGamesResponse = {
  data?: LandingGamesPayload | { data?: LandingGamesPayload }
} & LandingGamesPayload

type GamesListResponse = {
  data?: {
    games?: LandingGame[]
    data?: {
      games?: LandingGame[]
    }
  }
  games?: LandingGame[]
}

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

export const landingService = {
  async getLandingGames() {
    const res = await apiClient<LandingGamesResponse>(API_ENDPOINTS.gamesLanding)
    const source =
      res?.data && typeof res.data === 'object'
        ? 'data' in res.data && res.data.data && typeof res.data.data === 'object'
          ? res.data.data
          : res.data
        : res
    const data = (source ?? {}) as LandingGamesPayload
    return {
      liveCasino: asArray<LandingGame>(data?.liveCasino),
      slots: asArray<LandingGame>(data?.slots),
      trending: asArray<LandingGame>(data?.trending),
      roulette: asArray<LandingGame>(data?.roulette),
      cardGames: asArray<LandingGame>(data?.cardGames),
      chickenRoad: asArray<LandingGame>((data as any)?.chickenRoad || (data as any)?.chicken_road),
      crashGames: asArray<LandingGame>((data as any)?.crashGames || (data as any)?.crash_games),
    }
  },

  async getCasinoLobbyGames(limit = 18) {
    return this.getGamesByProvider('EZ', 'all', limit)
  },

  async getGamesByProvider(providerCode: string, category: string = 'all', limit = 50) {
    const endpoint = `${API_ENDPOINTS.gamesList}?providerCode=${providerCode}&category=${category}&page=1&limit=${limit}`
    const res = await apiClient<GamesListResponse>(endpoint)
    const list = res?.data?.games ?? res?.data?.data?.games ?? res?.games
    return asArray<LandingGame>(list)
  },
}
