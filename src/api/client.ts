import AsyncStorage from '@react-native-async-storage/async-storage'

// Expert-level Fallback: In-memory store for tokens if native module fails to load
let memoryToken: string | null = null

type RuntimeEnv = {
  EXPO_PUBLIC_BETTING_API_URL?: string
  BETTING_API_URL?: string
}

const runtimeEnv = (globalThis as { process?: { env?: RuntimeEnv } }).process?.env

export const API_BASE_URL =
  runtimeEnv?.EXPO_PUBLIC_BETTING_API_URL ||
  runtimeEnv?.BETTING_API_URL ||
  'https://gamingbackend.wrathcode.com'

type RequestConfig = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  token?: string
  body?: unknown
  skipAuth?: boolean
}

// Global method to set token from AuthContext
export const setMemoryToken = (token: string | null) => {
  memoryToken = token
}

export const apiClient = async <T>(
  endpoint: string,
  config: RequestConfig = {},
): Promise<T> => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  
  let authHeader = {}
  
  if (!config.skipAuth) {
    if (config.token) {
      authHeader = { Authorization: `Bearer ${config.token}` }
    } else if (memoryToken) {
      // High-end Expert fallback: use memory token if available
      authHeader = { Authorization: `Bearer ${memoryToken}` }
    } else {
      try {
        const storedData = await AsyncStorage.getItem('user_auth')
        if (storedData) {
          const parsed = JSON.parse(storedData)
          const token = parsed.token || parsed.accessToken
          if (token) {
            authHeader = { Authorization: `Bearer ${token}` }
          }
        }
      } catch (e) {
        // Don't log full error to avoid console clutter if rebuild is pending
        console.warn('AsyncStorage not ready (rebuild required). Using memory fallback.')
      }
    }
  }

  const response = await fetch(url, {
    method: config.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
    },
    ...(config.body ? { body: JSON.stringify(config.body) } : {}),
  })

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}${
        bodyText ? ` - ${bodyText}` : ''
      }`,
    )
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>
  }
  const text = await response.text()
  if (!text) {
    return {} as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}
