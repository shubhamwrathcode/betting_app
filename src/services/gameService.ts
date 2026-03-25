import { apiClient } from '../api/client'
import { API_ENDPOINTS } from '../api/endpoints'
import { ApiResponse } from '../types/api'
import { Platform } from 'react-native'

export const gameService = {
  launchGame: (gameCode: string, providerCode: string) =>
    apiClient<ApiResponse<any>>(API_ENDPOINTS.gamesLaunch, {
      method: 'POST',
      body: { 
        gameCode, 
        providerCode, 
        platform: Platform.OS === 'ios' ? 'ios' : 'mobile' 
      },
    }),
}
