import { apiClient } from '../api/client'
import { API_ENDPOINTS } from '../api/endpoints'

export type SportsbookMatch = {
  gameId?: string
  game_id?: string
  eventId?: string
  event_id?: string
  eventName?: string
  event_name?: string
  name?: string
  inPlay?: boolean
  in_play?: boolean
  eventTime?: string
  event_time?: string
  openDate?: string
  open_date?: string
  seriesName?: string
  series_name?: string
  selections?: Array<{
    back?: Array<{ price?: number | string; stack?: number | string; open?: boolean }>
    lay?: Array<{ price?: number | string; stack?: number | string; open?: boolean }>
  }>
}

type MatchesResponse = {
  data?:
    | SportsbookMatch[]
    | {
        data?: SportsbookMatch[]
        matches?: SportsbookMatch[]
        rows?: SportsbookMatch[]
        games?: SportsbookMatch[]
      }
  matches?: SportsbookMatch[]
}

const toMatches = (res: MatchesResponse): SportsbookMatch[] => {
  const top = res?.data
  if (Array.isArray(top)) return top
  if (top && typeof top === 'object') {
    if (Array.isArray(top.data)) return top.data
    if (Array.isArray(top.matches)) return top.matches
    if (Array.isArray(top.rows)) return top.rows
    if (Array.isArray(top.games)) return top.games
  }
  if (Array.isArray(res?.matches)) return res.matches
  return []
}

export const sportsbookService = {
  async getCricketMatches() {
    return toMatches(await apiClient<MatchesResponse>(API_ENDPOINTS.sportsbookCricketMatches, { skipAuth: true }))
  },
  async getTennisMatches() {
    return toMatches(await apiClient<MatchesResponse>(API_ENDPOINTS.sportsbookTennisMatches, { skipAuth: true }))
  },
  async getSoccerMatches() {
    return toMatches(await apiClient<MatchesResponse>(API_ENDPOINTS.sportsbookSoccerMatches, { skipAuth: true }))
  },
  /** Returns raw API response — for normalizeRestMatchesList (website pattern) */
  async getRawMatches(sport: string): Promise<any> {
    const endpointMap: Record<string, string> = {
      cricket: API_ENDPOINTS.sportsbookCricketMatches,
      tennis: API_ENDPOINTS.sportsbookTennisMatches,
      soccer: API_ENDPOINTS.sportsbookSoccerMatches,
    }
    const endpoint = endpointMap[sport]
    if (!endpoint) return { data: [] }
    try {
      // Public endpoint used by web landing contract.
      return await apiClient<any>(endpoint, { skipAuth: true })
    } catch (publicErr) {
      // Backend fallbacks: some deployments expose only protected generic list endpoints.
      const sportAliases = sport === 'soccer' ? ['soccer', 'football'] : [sport]
      const fallbackCandidates: string[] = []
      for (const alias of sportAliases) {
        const encoded = encodeURIComponent(alias)
        fallbackCandidates.push(`/api/v1/sportsbook/matches?sport=${encoded}&fresh=1`)
        fallbackCandidates.push(`/api/v1/sportsbook/matches?sport=${encoded}`)
        fallbackCandidates.push(`/api/v1/sportsbook/matches?eventType=${encoded}&fresh=1`)
        fallbackCandidates.push(`/api/v1/sportsbook/matches?eventType=${encoded}`)
      }

      for (const fallbackEndpoint of fallbackCandidates) {
        try {
          const res = await apiClient<any>(fallbackEndpoint, { skipAuth: false })
          console.log(`[SportsbookService] Fallback success for "${sport}" via ${fallbackEndpoint}`)
          return res
        } catch {
          // try next candidate
        }
      }

      console.warn(`[SportsbookService] All fallbacks failed for "${sport}"`)
      throw publicErr
    }
  },
}
