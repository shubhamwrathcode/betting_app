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

const getAuthHeader = async (config: RequestConfig): Promise<Record<string, string>> => {
  if (config.skipAuth) return {}
  if (config.token) return { Authorization: `Bearer ${config.token}` }
  if (memoryToken) return { Authorization: `Bearer ${memoryToken}` }
  try {
    const storedData = await AsyncStorage.getItem('user_auth')
    if (storedData) {
      const parsed = JSON.parse(storedData)
      const token = parsed.token || parsed.accessToken
      if (token) return { Authorization: `Bearer ${token}` }
    }
  } catch {
    console.warn('AsyncStorage not ready (rebuild required). Using memory fallback.')
  }
  return {}
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
  const authHeader = await getAuthHeader(config)

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

export const apiClientMultipart = async <T>(
  endpoint: string,
  formData: FormData,
  config: Omit<RequestConfig, 'body'> = {},
): Promise<T> => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  const authHeader = await getAuthHeader(config)
  const response = await fetch(url, {
    method: config.method ?? 'POST',
    headers: {
      ...authHeader,
    },
    body: formData,
  })
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}${bodyText ? ` - ${bodyText}` : ''}`,
    )
  }
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>
  }
  const text = await response.text()
  if (!text) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}
