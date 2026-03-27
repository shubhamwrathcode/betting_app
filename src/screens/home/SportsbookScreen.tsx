import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { WebView } from 'react-native-webview'
import { LandingHeader } from '../../components/common/LandingHeader'
import { AppFonts } from '../../components/AppFonts'
import { useAuth } from '../../hooks/useAuth'
import { apiClient } from '../../api/client'

const SportsbookScreen = () => {
  const navigation = useNavigation<any>()
  const { isAuthenticated } = useAuth()
  const launchCalledRef = useRef(false)
  const [launchURL, setLaunchURL] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      setError('Please login to open SportsBook.')
      return
    }
    if (launchCalledRef.current) return
    launchCalledRef.current = true

    const loadSportsbook = async () => {
      try {
        const res = await apiClient<any>('/api/v1/games/launch-sportsbook', {
          method: 'POST',
          body: {
            platform: 'mobile',
            gameCode: null,
            providerCode: 'BT',
          },
        })
        const data = res?.data ?? res?.response?.data ?? res
        const url = data?.launchURL || data?.launchUrl || data?.url || null
        if (!url) {
          setError(res?.message || 'Could not launch SportsBook')
          return
        }
        setLaunchURL(String(url))
      } catch (err: any) {
        setError(err?.message || 'Failed to load SportsBook')
      } finally {
        setLoading(false)
      }
    }
    loadSportsbook()
  }, [isAuthenticated])

  return (
    <View style={styles.container}>
      <LandingHeader
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#2E90FA" />
          <Text style={styles.stateText}>Loading SportsBook...</Text>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          {/* <Pressable style={styles.backBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}>
            <Text style={styles.backBtnText}>Back to Home</Text>
          </Pressable> */}
        </View>
      ) : null}

      {!loading && !error ? (
        <View style={styles.webWrap}>
          <WebView
            source={{ uri: launchURL || '' }}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webLoading}>
                <ActivityIndicator size="small" color="#2E90FA" />
              </View>
            )}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040f21' },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  stateText: {
    color: '#C7D4E8',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 13,
  },
  errorText: {
    color: '#F8C6C6',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 13,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: 8,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2E90FA',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#FFF',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 12,
  },
  webWrap: { flex: 1, paddingBottom: 74 },
  webView: { flex: 1, backgroundColor: '#040f21' },
  webLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#040f21',
  },
})

export default SportsbookScreen
