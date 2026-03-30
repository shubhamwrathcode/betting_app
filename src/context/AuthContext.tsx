import React, { createContext, PropsWithChildren, useMemo, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { setMemoryToken } from '../api/client'

type UserData = {
  _id?: string
  username?: string
  mobile?: string
  fullName?: string
  email?: string
  profileImage?: string
  updatedAt?: string
  wallet?: {
    balance: number
  }
}

type AuthContextValue = {
  isAuthenticated: boolean
  user: UserData | null
  login: (userData: any, token: string) => Promise<void>
  logout: () => Promise<void>
  /** Merge into current user and persist (e.g. after profile update). */
  updateUser: (partial: Partial<UserData>) => Promise<void>
  loading: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [isAuthenticated, setAuthenticated] = useState(false)
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  // Hydrate auth state on startup
  useEffect(() => {
    const hydrate = async () => {
      try {
        const stored = await AsyncStorage.getItem('user_auth')
        if (stored) {
          const { user: storedUser, token } = JSON.parse(stored)
          if (token) {
            setUser(storedUser)
            setAuthenticated(true)
            setMemoryToken(token) // Update memory fallback
          }
        }
      } catch (err) {
        // Suppress warning during hydrate if native module missing
        // Rebuild will fix the storage, memory token handles the current session
      } finally {
        setLoading(false)
      }
    }
    hydrate()
  }, [])

  const value = useMemo(
    () => ({
      isAuthenticated,
      user,
      loading,
      login: async (userData: any, token: string) => {
        try {
          // Always set memory fallback first to satisfy the current session 
          // even if native module is not yet linked
          setMemoryToken(token)
          setUser(userData)
          setAuthenticated(true)

          // Try to persist, but don't fail session if native module missing
          await AsyncStorage.setItem('user_auth', JSON.stringify({ user: userData, token }))
        } catch (err) {
          console.warn('Persistence failed (Rebuild required). Session will only last until app restart.')
        }
      },
      logout: async () => {
        try {
          setMemoryToken(null)
          await AsyncStorage.removeItem('user_auth')
          setUser(null)
          setAuthenticated(false)
        } catch (err) {
          console.warn('Storage cleanup failed')
        }
      },
      updateUser: async (partial: Partial<UserData>) => {
        try {
          const stored = await AsyncStorage.getItem('user_auth')
          if (stored) {
            const parsed = JSON.parse(stored)
            const nextUser = { ...(parsed.user || {}), ...partial } as UserData
            await AsyncStorage.setItem('user_auth', JSON.stringify({ ...parsed, user: nextUser }))
            setUser(nextUser)
            return
          }
        } catch {
          console.warn('updateUser persistence failed')
        }
        setUser(prev => ({ ...(prev || {}), ...partial } as UserData))
      },
    }),
    [isAuthenticated, user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
