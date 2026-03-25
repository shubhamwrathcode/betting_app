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
    return toMatches(await apiClient<MatchesResponse>(API_ENDPOINTS.sportsbookCricketMatches))
  },
  async getTennisMatches() {
    return toMatches(await apiClient<MatchesResponse>(API_ENDPOINTS.sportsbookTennisMatches))
  },
  async getSoccerMatches() {
    return toMatches(await apiClient<MatchesResponse>(API_ENDPOINTS.sportsbookSoccerMatches))
  },
}
