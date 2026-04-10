import React, { createContext, PropsWithChildren, useMemo, useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Toast from 'react-native-toast-message'
import { setMemoryToken } from '../api/client'
import { reset as resetNavigation } from '../navigation/navigationRef'

type UserData = {
  _id?: string
  id?: string // Some APIs use id, others _id
  username?: string
  mobile?: string
  fullName?: string
  email?: string
  profileImage?: string
  updatedAt?: string
  isDemo?: boolean
  expiresAt?: string
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

  const handleLogout = useCallback(async () => {
    try {
      // CLEAR EVERYTHING
      setMemoryToken(null)
      await AsyncStorage.removeItem('user_auth')
      setUser(null)
      setAuthenticated(false)
      
      // RESET NAVIGATION IMMEDIATELY to clear any open games/modals
      resetNavigation('MainTabs')
    } catch (err) {
      console.warn('Storage cleanup failed')
    }
  }, [])

  // Timer for demo session expiration
  useEffect(() => {
    let timer: any = null;
    
    // STRICTLY for demo login users only
    if (isAuthenticated && user?.isDemo === true && user?.expiresAt) {
      const expirationTime = new Date(user.expiresAt).getTime();
      const currentTime = new Date().getTime();
      const timeLeft = expirationTime - currentTime;
      
      console.log(`[Auth] Demo session expires at: ${user.expiresAt}. Time remaining: ${Math.round(timeLeft/1000)}s`);

      if (timeLeft <= 0) {
        console.log('[Auth] Demo session already expired, logging out…');
        handleLogout();
      } else {
        // Set a timer to logout exactly when it expires
        timer = setTimeout(() => {
          console.log('[Auth] Demo session expired, logging out automatically…');
          Toast.show({
            type: 'info',
            text1: 'Demo Expired',
            text2: 'Session expired. Please log in again.'
          });
          handleLogout();
        }, timeLeft);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAuthenticated, user?.expiresAt, user?.isDemo, handleLogout]);

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
      logout: handleLogout,
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
